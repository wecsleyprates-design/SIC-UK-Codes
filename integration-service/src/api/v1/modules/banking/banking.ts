import {
	executeOtherTasksOnApplicationEdit,
	getRawIntegrationDataFromS3,
	sendWebhookEvent,
	sendEventToGatherWebhookData,
	prepareIntegrationDataForScore
} from "#common/index";
import {
	ERROR_CODES,
	INTEGRATION_ID,
	kafkaEvents,
	kafkaTopics,
	getEnumKeyByValue,
	TASK_STATUS,
	CONNECTION_STATUS,
	TaskCodeEnum,
	TaskStatus,
	QUEUES,
	EVENTS,
	type ConnectionStatus,
	WEBHOOK_EVENTS,
	DIRECTORIES,
	FEATURE_FLAGS,
	ROLES,
	PLAID_WEBHOOK_CODE,
	PLAID_WEBHOOK_STATUS,
	INTEGRATION_TASK,
	INTEGRATION_CATEGORIES
} from "#constants/index";
import {
	BusinessDetails,
	getBusinessApplicants,
	getBusinessDetails,
	getInvitationDetails,
	setApplicationEditData
} from "#helpers/api";
import {
	db,
	getCase,
	getFlagValue,
	logger,
	producer,
	sqlQuery,
	sqlSequencedTransaction,
	sqlTransaction
} from "#helpers/index";
import { Plaid } from "#lib/index";
import { decryptData, encryptData, getCachedSignedUrl, roundNum } from "#utils/index";
import { deduplicateBankAccounts, normalizePlaidLinkedBankAccounts } from "#helpers/bankAccountHelper";
import { StatusCodes } from "http-status-codes";
import { v4 as uuidv4 } from "uuid";
import { BankingApiError } from "./error";

import {
	AssetReportCreateResponse,
	AssetReportRefreshResponse,
	AssetsProductReadyWebhook,
	AuthGetResponse,
	ItemAddResultWebhook,
	ItemPublicTokenExchangeResponse,
	LinkSessionFinishedWebhook,
	Products
} from "plaid";
import { TaskManager } from "../tasks/taskManager";
import dayjs from "dayjs";
import type IBanking from "./types";
import {
	AddBankStatementBody,
	BankingTaskAction,
	IAdditionalAccountInfoBody,
	IAdditionalAccountInfoResponse,
	IUploadedStatement,
	type IAllBankingAccountsResponse
} from "./types";
import BankAccount from "./models/bankAccount";
import BankAccountBalance from "./models/bankAccountBalance";
import BankAccountTransaction from "./models/bankAccountTransaction";
import RelTaskBankAccount from "./models/relTaskBankAccount";
import { HydrateFromWarehouse } from "#decorators/hydrateFromWarehouse";
import { getConnectionByTaskId, getOrCreateConnection, platformFactory } from "#helpers/platformHelper";
import { Equifax } from "#lib/equifax";
import { checkAndTriggerRiskAlert, triggerSectionCompletedKafkaEventWithRedis } from "#common/common-new";
import utc from "dayjs/plugin/utc";
import currency from "currency.js";
import BullQueue from "#helpers/bull-queue";
import { BankAccountBalanceDaily } from "./models";
import Fuse, { IFuseOptions } from "fuse.js";
import { UserInfo } from "#types/common";
import BankAccountVerification from "./models/bankAccountVerification";
import type {
	IBusinessIntegrationTask,
	IBusinessIntegrationTaskEnriched,
	IDBConnection,
	SqlQueryResult
} from "#types/db";
import type { UUID } from "crypto";
import { ManualBanking } from "#lib/manual/manualBanking";
import { strategyPlatformFactory } from "#helpers/strategyPlatformFactory";
import { BusinessScoreTriggerRepository } from "#core/scoreTrigger";

dayjs.extend(utc);

type ChangedField = { field_name: string; old_value: any; new_value: any; metadata: any };

export class Banking {
	async plaidLinkInit({ businessID }, { authorization }, { invitation_id: invitationID }) {
		try {
			let userToken: string, connection: IDBConnection;
			let customerID: string | undefined = undefined;
			let products = [Products.Assets, Products.Auth];

			if (invitationID) {
				const invitationDetails = await getInvitationDetails(invitationID);
				customerID = invitationDetails.customer_id;
			}

			const { plaid, plaidEnv } = await this.checkAndCreateNewPlaidInstance({ customer_id: customerID });

			try {
				connection = await Plaid.getPlaidConnection(businessID);
			} catch (error) {
				throw new BankingApiError("Bank connection does not exist", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
			}

			const { access_token_responses } = connection?.configuration || [];
			const isPlaidLinked =
				connection?.connection_status === CONNECTION_STATUS.SUCCESS && access_token_responses?.length > 0;
			const message = isPlaidLinked
				? "A plaid account has already been linked."
				: "Plaid link flow has been initiated.";
			const plaidLinkStatus = isPlaidLinked ? true : false;
			if (connection?.configuration?.link_token_response?.expiration) {
				const expirationTime = new Date(connection.configuration.link_token_response.expiration).getTime();
				const currentTime = new Date().getTime();
				if (currentTime < expirationTime) {
					return {
						data: {
							response: connection?.configuration?.link_token_response,
							is_plaid_linked: plaidLinkStatus
						},
						message: message
					};
				}
			}

			if (connection?.configuration?.user_token_response?.user_token) {
				userToken = connection?.configuration?.user_token_response?.user_token;
			} else {
				let userTokenData: any = await plaid.createUserToken(connection?.business_id);
				userTokenData = { ...userTokenData, environment: plaidEnv };
				if (connection?.configuration) {
					connection.configuration.user_token_response = userTokenData;
				} else {
					connection.configuration = { user_token_response: userTokenData };
				}

				userToken = userTokenData.user_token;

				// save user token as soon as we get
				await sqlQuery({
					sql: `UPDATE integrations.data_connections SET configuration = $1 WHERE id = $2`,
					values: [JSON.stringify(connection?.configuration), connection.id]
				});
			}

			const businessDetails = await getBusinessDetails(businessID, authorization);

			// TODO: add internal API calls to pull business + applicant/owner data ( see createLinkToken implementation for required data)
			let response: any = await plaid.createLinkToken(businessID, businessDetails.data, products, userToken);
			response = { ...response, environment: plaidEnv };
			connection.configuration.link_token_response = response;
			const connection_status =
				connection?.connection_status === CONNECTION_STATUS.SUCCESS
					? CONNECTION_STATUS.SUCCESS
					: CONNECTION_STATUS.INITIALIZED;
			const connectionHistory = {
				id: uuidv4(),
				connection_id: connection.id,
				log: JSON.stringify(connection?.configuration),
				connection_status: connection_status,
				created_at: new Date().toISOString()
			};
			const updateConnectionQuery = `UPDATE integrations.data_connections SET connection_status = $1, configuration = $2 WHERE id = $3`;

			const insertConnectionHistory = `INSERT INTO integrations.data_connections_history SELECT * FROM json_populate_recordset(null::integrations.data_connections_history, $1)`;

			await sqlTransaction(
				[updateConnectionQuery, insertConnectionHistory],
				[
					[connectionHistory.connection_status, JSON.stringify(connection?.configuration), connection.id],
					[JSON.stringify([connectionHistory])]
				]
			);

			return {
				data: {
					response,
					is_plaid_linked: plaidLinkStatus
				},
				message: message
			};
		} catch (error) {
			throw error;
		}
	}

	async enqueueLinkWebhook(data: LinkSessionFinishedWebhook | ItemAddResultWebhook) {
		// Ignore ITEM_ADD_RESULT webhook_code for now; may handle in the future if needed.
		if (data.webhook_code === PLAID_WEBHOOK_CODE.ITEM_ADD_RESULT) {
			return;
		}
		const queue = new BullQueue(QUEUES.TASK);
		const jobId = `{link_webhook}:${data.webhook_code}:${data.link_session_id}`;
		// Enqueue with a short delay to handle debouncing
		await queue.addJob(EVENTS.LINK_WEBHOOK, data, {
			jobId,
			removeOnComplete: true,
			removeOnFail: false,
			delay: 5000 /* ms */
		});
	}

	async handleLinkWebhook(
		data: any | IBanking.ExtendedItemAddResultWebhook | IBanking.ExtendedLinkSessionFinishedWebhook
	) {
		const { link_token, webhook_code, link_session_id, environment } = data;
		// logger.debug(`Handling Link Webhook of Link Session: ${link_session_id} and Link Token: ${link_token} in environment ${environment}`);

		const getDataConnectionQuery = `SELECT * FROM integrations.data_connections WHERE platform_id = $1 AND (configuration -> 'link_token_response' ->> 'link_token' = $2 OR configuration -> 'link_token_response' ->> 'link_session_id' = $3) LIMIT 1`;
		const getDataConnectionResult = await sqlQuery({
			sql: getDataConnectionQuery,
			values: [INTEGRATION_ID.PLAID, link_token, link_session_id]
		});
		// logger.debug(`getDataConnectionResult of handleLinkWebhook: ${JSON.stringify(getDataConnectionResult)}`);

		if (getDataConnectionResult.rowCount === 0) {
			throw new BankingApiError(
				"Invalid Link Token or Plaid Connection Does Not Exist",
				StatusCodes.UNPROCESSABLE_ENTITY,
				ERROR_CODES.INVALID
			);
		}
		const plaid = await Plaid.getPlaid({ business_id: getDataConnectionResult.rows[0].business_id });

		const connectionId = getDataConnectionResult.rows[0].id;
		let connectionStatus: ConnectionStatus = getDataConnectionResult.rows[0].connection_status;
		let response: ItemPublicTokenExchangeResponse | any;
		let responseArray = getDataConnectionResult?.rows[0]?.configuration || {};
		if (!responseArray?.access_token_responses) {
			responseArray.access_token_responses = [];
			if (responseArray.access_token) {
				const accessTokenInformation: any = await plaid.itemGetInformation(responseArray.access_token);
				const existingAccessToken = {
					access_token: responseArray.access_token,
					environment:
						responseArray?.environment ??
						responseArray?.user_token_response?.environment ??
						responseArray?.link_token_response?.environment,
					institution_id: accessTokenInformation?.item?.institution_id ?? "",
					institution_name: accessTokenInformation?.item?.institution_name ?? ""
				};
				responseArray.access_token_responses.push(existingAccessToken);
			}
		}

		const now = new Date().toISOString();

		if (webhook_code === PLAID_WEBHOOK_CODE.ITEM_ADD_RESULT) {
			data as IBanking.ExtendedItemAddResultWebhook;
			const { public_token } = data;
			// logger.debug(`Handling Link Webhook Type :  ${webhook_code} and Public Token: ${public_token}`);
		} else if (webhook_code === PLAID_WEBHOOK_CODE.SESSION_FINISHED) {
			data as IBanking.ExtendedLinkSessionFinishedWebhook;
			const { public_tokens } = data;
			// logger.debug(`Handling Link Webhook Type :  ${webhook_code} and Public Tokens: ${JSON.stringify(public_tokens)}`);
			if (data.status == PLAID_WEBHOOK_STATUS.SUCCESS) {
				for (const public_token of public_tokens) {
					try {
						// logger.debug(`Exchanging Public Token ${public_token} For Access Token`);
						response = await plaid.exchangeToken(public_token);
						const accessTokenInformation: any = await plaid.itemGetInformation(response.access_token);
						try {
							await this.fetchAndInsertAccounts(getDataConnectionResult.rows[0].business_id, response.access_token);
							// logger.info("Deposit accounts insertion executed successfully.");
						} catch (error) {
							// logger.error("Error executing deposit account method:", error);
						}
						response = {
							...response,
							environment:
								responseArray?.environment ??
								responseArray?.user_token_response?.environment ??
								responseArray?.link_token_response?.environment
						};
						response.institution_id = accessTokenInformation?.item?.institution_id;
						response.institution_name = accessTokenInformation?.item?.institution_name;
						responseArray.access_token_responses.push(response);
					} catch (error) {
						logger.error(error);
						connectionStatus = CONNECTION_STATUS.FAILED;
						const connectionId = getDataConnectionResult.rows[0].id;
						const connectionHistory = {
							id: uuidv4(),
							connection_id: connectionId,
							log: JSON.stringify(error),
							connection_status: connectionStatus,
							created_at: now
						};
						const insertConnectionHistory = `INSERT INTO integrations.data_connections_history SELECT * FROM json_populate_recordset(null::integrations.data_connections_history, $1)`;

						const updateConnectionQuery = `UPDATE integrations.data_connections SET connection_status = $1, configuration = $2 WHERE id = $3`;

						await sqlTransaction(
							[updateConnectionQuery, insertConnectionHistory],
							[
								[getDataConnectionResult.rows[0].connection_status, JSON.stringify(responseArray), connectionId],
								[JSON.stringify([connectionHistory])]
							]
						);
					}
				}
				connectionStatus = CONNECTION_STATUS.SUCCESS;
				const connectionHistory = {
					id: uuidv4(),
					connection_id: connectionId,
					log: JSON.stringify(responseArray),
					connection_status: connectionStatus, // Assuming success if no error occurs
					created_at: now
				};
				const insertConnectionHistory = `INSERT INTO integrations.data_connections_history SELECT * FROM json_populate_recordset(null::integrations.data_connections_history, $1)`;

				const updateConnectionQuery = `UPDATE integrations.data_connections SET connection_status = $1, configuration = $2 WHERE id = $3`;

				await sqlTransaction(
					[updateConnectionQuery, insertConnectionHistory],
					[[connectionStatus, JSON.stringify(responseArray), connectionId], [JSON.stringify([connectionHistory])]]
				);

				if (
					responseArray?.link_token_response?.link_session_id == link_session_id &&
					responseArray?.link_token_response?.case_id
				) {
					const getAllCreatedTasks = `SELECT dbit.* FROM integrations.data_business_integrations_tasks dbit
						INNER JOIN integrations.business_score_triggers bst on bst.id = dbit.business_score_trigger_id
						INNER JOIN data_cases ON data_cases.score_trigger_id = bst.id
						WHERE data_cases.id = $1
						AND integration_task_id = $2
						ORDER BY dbit.created_at DESC`;
					const { rows } = await sqlQuery({
						sql: getAllCreatedTasks,
						values: [responseArray.link_token_response.case_id, INTEGRATION_TASK.fetch_assets_data]
					});
					let tasks: any[] = rows;

					for (const task of tasks) {
						const queue = new BullQueue(QUEUES.TASK);
						const jobId = `{fetch_asset_report}:${task.id}:${BankingTaskAction.CREATE_ASSET_REPORT}`;
						// Enqueue with a short delay to handle debouncing
						await queue.addJob(EVENTS.FETCH_ASSET_REPORT, task.id, {
							jobId,
							removeOnComplete: true,
							removeOnFail: false,
							delay: 500 /* ms */
						});
					}
				}
			}
		}
	}

	async checkUserAccess(businessID: string, authorization: string, userInfo: UserInfo) {
		if (userInfo?.role?.code === ROLES.APPLICANT) {
			const records = await getBusinessApplicants(businessID, authorization);
			const applicants = records.map(applicant => applicant.id);
			if (!applicants.includes(userInfo?.user_id)) {
				throw new BankingApiError(
					"You are not allowed to access details of this business.",
					StatusCodes.UNAUTHORIZED,
					ERROR_CODES.UNAUTHENTICATED
				);
			}
		}
	}

	async fetchAndInsertAccounts(businessID: UUID, accessToken: string): Promise<void> {
		try {
			const plaid = await Plaid.getPlaid({ business_id: businessID });

			// Fetch account details using Plaid API
			const response: AuthGetResponse = await plaid.plaidAuthGet({ access_token: accessToken });

			if (!response.accounts.length) {
				throw new BankingApiError("No accounts found", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
			}

			// Retrieve the latest Business Integration Task
			const businessIntegrationTask = await TaskManager.getLatestTaskForBusiness(
				businessID,
				INTEGRATION_ID.PLAID,
				"fetch_assets_data",
				false
			);
			const businessIntegrationTaskId = businessIntegrationTask?.id;
			if (!businessIntegrationTaskId) {
				throw new BankingApiError("Business integration task not found.", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
			}

			// Get existing encrypted bank accounts in the DB
			const bankAccounts = await BankAccount.findByBusinessId(businessID);
			const uniqueDepositAccounts = new Set();
			const depositAccounts: IBanking.BankAccountRecord[] = [];

			for (const accountRecord of bankAccounts) {
				const account = accountRecord.getRecord();
				if (
					account.deposit_account &&
					!uniqueDepositAccounts.has(
						decryptData(account.bank_account) + account.bank_name + account.type + account.subtype
					)
				) {
					depositAccounts.push(account);
					uniqueDepositAccounts.add(
						decryptData(account.bank_account) + account.bank_name + account.type + account.subtype
					);
				}
			}

			// Filter and map accounts for insertion
			const accountsToInsert: any = response.accounts
				.map(account => {
					const achDetails = response.numbers.ach.find(n => n.account_id === account.account_id);
					if (!achDetails || !achDetails.account) {
						logger.warn(`Skipping account due to missing ACH details: ${account.account_id}`);
						return null;
					}
					const encryptedAccount = achDetails?.account ? encryptData(achDetails.account) : undefined;

					if (uniqueDepositAccounts.has(achDetails?.account + account.name + account.type + account.subtype))
						return null; // Compare using decrypted values

					uniqueDepositAccounts.add(achDetails?.account + account.name + account.type + account.subtype); // Store unencrypted version for comparison

					return {
						id: uuidv4(),
						business_integration_task_id: businessIntegrationTaskId,
						bank_account: encryptedAccount,
						bank_name: account.name,
						official_name: account.official_name || "",
						institution_name: "ACH",
						verification_status: achDetails?.wire_routing ? "VERIFIED" : "UNVERIFIED",
						balance_current: account.balances?.current || 0,
						balance_available: account.balances?.available || 0,
						balance_limit: account.balances?.limit || 0,
						currency: account.balances?.iso_currency_code || "USD",
						type: account.type,
						subtype: account.subtype || "",
						mask: account.mask || "",
						routing_number: achDetails?.routing ? encryptData(achDetails.routing) : undefined,
						wire_routing_number: achDetails?.wire_routing ? encryptData(achDetails.wire_routing) : undefined,
						deposit_account: true,
						created_at: new Date().toISOString()
					};
				})
				.filter(Boolean); // Remove null values

			if (accountsToInsert.length) {
				await db<IBanking.BankAccountRecord>("integration_data.bank_accounts")
					.insert(accountsToInsert)
					.onConflict(["id"])
					.merge();
			}
		} catch (error) {
			throw error;
		}
	}
	/**
	 * Inserts deposit accounts from Plaid into the database for the given business.
	 *
	 *
	 * @param businessID - The business identifier.
	 * @returns void
	 * @throws BankingApiError if any required data is missing.
	 */
	async fetchAndInsertAllAccounts(businessID: UUID): Promise<void> {
		try {
			// Retrieve Plaid connection for the business
			const plaidConnection = await Plaid.getPlaidConnection(businessID);
			if (!plaidConnection) {
				throw new BankingApiError("Bank connection does not exist", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
			}

			// Extract all access tokens from the connection
			const accessTokenConfigurations: IBanking.AccessTokenConfigurationObject[] = plaidConnection.configuration
				?.access_token_responses
				? Object.values(plaidConnection.configuration.access_token_responses)
				: [plaidConnection.configuration];

			// Iterate over each access token and fetch & insert unique accounts
			for (const config of accessTokenConfigurations) {
				const accessToken = config?.access_token;
				if (!accessToken) {
					throw new BankingApiError("Access token not found.", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
				}

				await this.fetchAndInsertAccounts(businessID, accessToken);
			}
		} catch (error) {
			throw error;
		}
	}

	async setDepositAccountInfo({ businessID }, { accountData }, authorization: string, userInfo: UserInfo) {
		try {
			await this.checkUserAccess(businessID, authorization, userInfo);

			// Get business integration task
			const businessIntegrationTask = await TaskManager.getLatestTaskForBusiness(
				businessID,
				INTEGRATION_ID.PLAID,
				"fetch_assets_data",
				false
			);
			const businessIntegrationTaskId = businessIntegrationTask?.id;
			if (!businessIntegrationTaskId) {
				throw new BankingApiError("Business integration task not found.", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
			}

			const existingAccounts = await db("integration_data.bank_accounts")
				.where({ business_integration_task_id: businessIntegrationTaskId })
				.andWhere({ bank_name: accountData.bank_name || null })
				.andWhere({ type: accountData.type })
				.andWhere({ subtype: accountData.subtype || null })
				.andWhere({ deposit_account: true })
				.select("*");

			const matchedAccount = existingAccounts.find(row => decryptData(row.bank_account) === accountData.account_number);

			if (matchedAccount) {
				await db("integration_data.bank_accounts")
					.where({ business_integration_task_id: businessIntegrationTaskId })
					.andWhere({ deposit_account: true })
					.update({ is_selected: false });

				await db("integration_data.bank_accounts").where({ id: matchedAccount.id }).update({ is_selected: true });

				return {
					id: matchedAccount.id,
					message: "Existing deposit account marked as selected."
				};
			}

			const accountID = uuidv4();

			await db("integration_data.bank_accounts")
				.where({ business_integration_task_id: businessIntegrationTaskId })
				.andWhere({ deposit_account: true })
				.update({ is_selected: false });

			const [inserted] = await db("integration_data.bank_accounts")
				.insert({
					id: accountID,
					business_integration_task_id: businessIntegrationTaskId,
					bank_account: encryptData(accountData.account_number),
					bank_name: accountData.bank_name || null,
					official_name: accountData.official_name || null,
					institution_name: accountData.institution_name || accountData.bankName || "ACH",
					verification_status: accountData.wire_routing_number ? "VERIFIED" : "UNVERIFIED",
					balance_current: accountData.balance_current || null,
					balance_available: accountData.balance_available || null,
					balance_limit: accountData.balance_limit || null,
					currency: accountData.currency || null,
					mask: accountData.account_number.substring(accountData.account_number.length - 4),
					type: accountData.type,
					subtype: accountData.subtype || null,
					routing_number: encryptData(accountData.routing_number),
					wire_routing_number: accountData.wire_routing_number ? encryptData(accountData.wire_routing_number) : null,
					account_holder_name: accountData.account_holder_name ?? null,
					account_holder_type: accountData.account_holder_type ?? null,
					deposit_account: true,
					is_selected: true
				})
				.returning("*")
				.onConflict("id")
				.merge();

			if (inserted) {
				if (!userInfo?.is_guest_owner) {
					await triggerSectionCompletedKafkaEventWithRedis({
						businessId: businessID,
						section: "Banking Deposit Account",
						userId: userInfo.user_id as UUID
					});
				}

				await sendEventToGatherWebhookData([WEBHOOK_EVENTS.BUSINESS_UPDATED], { business_id: businessID });

				return {
					id: inserted.id,
					message: "New deposit account inserted and marked as selected."
				};
			}
		} catch (error) {
			throw error;
		}
	}

	async getDepositAccountInfo({ businessID }, authorization: string, userInfo: UserInfo) {
		try {
			// Fetch and filter deposit accounts
			let depositAccounts = await this.getFilteredDepositAccounts(businessID);

			// If no deposit accounts found, fetch new data and retry
			if (!depositAccounts.length) {
				await this.fetchAndInsertAllAccounts(businessID);
				depositAccounts = await this.getFilteredDepositAccounts(businessID);
			}

			// Format and return response
			return this.formatDepositAccountResponse(depositAccounts);
		} catch (error) {
			throw error;
		}
	}

	/**
	 * Fetch and filter unique deposit accounts for a business.
	 */
	async getFilteredDepositAccounts(businessID: string): Promise<IBanking.BankAccountRecord[]> {
		const bankAccounts = await BankAccount.findByBusinessId(businessID);
		const uniqueDepositAccounts = new Set();
		const depositAccounts: IBanking.BankAccountRecord[] = [];

		for (const accountRecord of bankAccounts) {
			const account = accountRecord.getRecord();
			if (account.deposit_account && (account.type === "depository" || account.subtype === null)) {
				let decryptedAccountNumber;
				let decryptedRoutingNumber;
				try {
					decryptedAccountNumber = decryptData(account.bank_account);
				} catch (error) {
					decryptedAccountNumber = account.bank_account; // Fallback to original value
				}
				try {
					decryptedRoutingNumber = decryptData(account.routing_number);
				} catch (error) {
					decryptedRoutingNumber = account.routing_number; // Fallback to original value
				}

				const uniqueKey = decryptedAccountNumber + decryptedRoutingNumber + account.type + account.subtype;

				if (!uniqueDepositAccounts.has(uniqueKey)) {
					depositAccounts.push(account);
					uniqueDepositAccounts.add(uniqueKey);
				}
			}
		}
		return depositAccounts;
	}

	/**
	 * Format deposit account response into the expected structure.
	 */
	async formatDepositAccountResponse(depositAccounts: IBanking.BankAccountRecord[]) {
		return {
			accounts: depositAccounts.map(account => ({
				account_id: account.id,
				balances: {
					available: account.balance_available || null,
					current: account.balance_current || null,
					limit: account.balance_limit || null,
					iso_currency_code: account.currency || "USD",
					unofficial_currency_code: null
				},
				mask: account.mask || "",
				name: account.bank_name || null,
				official_name: account.official_name || "",
				subtype: account.subtype || null,
				account_holder_name: account.account_holder_name ?? null,
				account_holder_type: account.account_holder_type ?? null,
				type: account.type || null
			})),
			numbers: {
				ach: depositAccounts.map(account => {
					return {
						account: account.bank_account ? decryptData(account.bank_account) : null,
						account_id: account.id,
						routing: account.routing_number ? decryptData(account.routing_number) : null,
						wire_routing: account.wire_routing_number ? decryptData(account.wire_routing_number) : null
					};
				}),
				eft: [],
				international: [],
				bacs: []
			}
		};
	}

	async getDepositAccount({ businessID }) {
		const bankAccounts = await BankAccount.findByBusinessId(businessID);
		for (const accountRecord of bankAccounts) {
			const account = accountRecord.getRecord();
			if (account.deposit_account && account.is_selected) {
				return {
					accounts: [
						{
							account_id: account.id,
							balances: {
								available: account.balance_available || null,
								current: account.balance_current || null,
								limit: account.balance_limit || null
							},
							mask: account.mask || null,
							name: account.bank_name || null,
							official_name: account.official_name || null,
							subtype: account.subtype,
							type: account.type,
							account_holder_name: account.account_holder_name ?? null,
							account_holder_type: account.account_holder_type ?? null,
							institution_name: account.institution_name,
							verification_status: account.verification_status
						}
					],
					numbers: {
						ach: [
							{
								account: decryptData(account.bank_account),
								account_number: account.bank_account,
								account_id: account.id,
								routing: decryptData(account.routing_number),
								wire_routing: account.wire_routing_number ? decryptData(account.wire_routing_number) : null
							}
						],
						bacs: [],
						eft: [],
						international: []
					}
				};
			}
		}
		return {};
	}

	// When a business continues with pre-connected plaid account, we need to pull new data from plaid
	// TODO: update the logic to re use freshly pulled data from plaid
	async getMostRecentBankingTask(businessID: UUID, platformID = INTEGRATION_ID.PLAID) {
		const mostRecentTasks = await TaskManager.getPaginatedTasks({
			business_id: businessID,
			query: {
				task_status: TASK_STATUS.SUCCESS,
				platform_id: platformID,
				task_code: getEnumKeyByValue(TaskCodeEnum, TaskCodeEnum.fetch_assets_data)
			}
		});
		if (mostRecentTasks?.tasks?.length > 0) return mostRecentTasks.tasks[0];

		// Has never completed a banking task, does it have any CREATED tasks?
		const createdTasks = await TaskManager.getPaginatedTasks({
			business_id: businessID,
			query: {
				filter: `task_status in ${TaskManager.IN_PROGRESS_TASK_STATUSES.join(",")}`,
				platform_id: platformID,
				task_code: getEnumKeyByValue(TaskCodeEnum, TaskCodeEnum.fetch_assets_data)
			}
		});
		if (createdTasks?.tasks?.length > 0) {
			logger.info(`Found created task for business ${businessID} - ${createdTasks.tasks[0].id}`);
			return createdTasks.tasks[0];
		}
		throw new BankingApiError("No banking tasks found - cannot REFRESH", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
	}

	async refreshBankingAssets(body: any, { businessID }: { businessID: UUID }): Promise<void> {
		let connection: IDBConnection;

		try {
			connection = await Plaid.getPlaidConnection(businessID);
		} catch (error) {
			throw new BankingApiError("Bank connection does not exist", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
		}

		const accessTokenconfigurations: IBanking.AccessTokenConfigurationObject[] = Array.isArray(
			connection?.configuration?.access_token_responses
		)
			? Object.values(connection.configuration.access_token_responses)
			: [connection.configuration];

		for (const config of accessTokenconfigurations) {
			const { access_token } = config || {};
			const { asset_report_token } = connection?.configuration || {};
			if (connection.connection_status !== CONNECTION_STATUS.SUCCESS || !access_token || !asset_report_token) {
				logger.error(`businessId=${businessID} Bank connection is not in an appropriate state: ${connection}`);
				throw new BankingApiError(
					"Bank connection is not in an appropriate state",
					StatusCodes.NOT_FOUND,
					ERROR_CODES.NOT_FOUND
				);
			}
			// Get most recently successful banking task
			const task = await this.getMostRecentBankingTask(businessID);

			if (task?.task_status === TASK_STATUS.SUCCESS) {
				// Calculate the number of days that have passed since the most recent successful banking task
				// this value is used if the request does not contain a days value
				const daysSince = Math.abs(dayjs(task.updated_at).diff(dayjs(), "days") || 0) + 1;

				const refreshDays = body?.days ?? daysSince;

				const newTask = await TaskManager.createTask({
					connection_id: task.connection_id,
					integration_task_id: task.integration_task_id,
					business_score_trigger_id: task.business_score_trigger_id,
					task_status: TASK_STATUS.CREATED,
					reference_id: asset_report_token,
					metadata: {
						...task.metadata,
						refreshDays,
						taskAction: BankingTaskAction.REFRESH_ASSET_REPORT
					}
				});
				await this.fetchAssetReport(newTask.id, BankingTaskAction.REFRESH_ASSET_REPORT);
				/*
					Intentionally not "getting" the report here --- the webhook will handle this
					Otherwise, we'll be getting the last report generated and processing instead of whatever we're requesting 
				*/
			} else {
				await this.fetchAssetReport(task.id, BankingTaskAction.CREATE_ASSET_REPORT);
			}
		}
	}

	/**
	 * Handles the exchange of a public token with Plaid and manages connection updates.
	 *
	 * @param {Object} body - The request body containing various connection details.
	 * @param {string} [body.public_token] - The public token to be exchanged.
	 * @param {string} [body.connection_phase] - The current phase of the connection process.
	 * @param {UUID} [body.case_id] - The ID of the related case.
	 * @param {string} [body.removed_institution_name] - Name of the institution being removed.
	 * @param {string} [body.link_session_id] - The link session ID.
	 * @param {Object} params - The parameters passed to the function.
	 * @param {string} params.businessID - The business ID extracted from the URL.
	 * @param {Object} headers - Request headers.
	 * @param {Object} userInfo - Information about the user.
	 * @param {string} userInfo.user_id - The ID of the user initiating the request.
	 *
	 * @returns {Promise<void>} Resolves after handling the token exchange and updates.
	 * @throws Will throw an error if any operation fails.
	 */
	async plaidTokenExchange(
		body: {
			public_token?: string;
			connection_phase?: string;
			case_id?: UUID;
			removed_institution_name?: string;
			link_session_id?: string;
		},
		{ businessID },
		headers,
		userInfo: UserInfo
	) {
		try {
			if (!body.link_session_id && !body.removed_institution_name) {
				throw new BankingApiError(
					"Missing required parameters: Either link_session_id or removed_institution_name is compulsary",
					StatusCodes.BAD_REQUEST,
					ERROR_CODES.INVALID
				);
			}

			// Get Plaid instance and connection details.
			const plaid = await Plaid.getPlaid({ business_id: businessID });
			let connection: IDBConnection;
			try {
				connection = await Plaid.getPlaidConnection(businessID);
			} catch (error) {
				throw new BankingApiError("Bank connection does not exist", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
			}

			const connectionId = connection.id;
			const connectionConfiguration = connection?.configuration || {};
			let connectionStatus: ConnectionStatus = CONNECTION_STATUS.SUCCESS;
			let response: any;

			// Handle public token exchange.
			if (body.public_token) {
				try {
					if (!connectionConfiguration?.access_token_responses) {
						connectionConfiguration.access_token_responses = [];
					}

					response = await plaid.exchangeToken(body.public_token);
					const accessTokenInformation: any = await plaid.itemGetInformation(response.access_token);

					response = {
						...response,
						environment:
							connectionConfiguration?.environment ??
							connectionConfiguration?.user_token_response?.environment ??
							connectionConfiguration?.link_token_response?.environment
					};
					response.institution_id = accessTokenInformation?.item?.institution_id;
					response.institution_name = accessTokenInformation?.item?.institution_name;

					connectionConfiguration.access_token_responses.push(response);
				} catch (error) {
					logger.error(error);
					connectionStatus = CONNECTION_STATUS.FAILED;
				}
			}

			// Handle removal of institutions.
			if (body.removed_institution_name && connectionConfiguration?.access_token_responses) {
				const institutionName = body.removed_institution_name;
				const { matchingAccessTokenResponses, nonMatchingAccessTokenResponses } =
					connectionConfiguration.access_token_responses.reduce(
						(result, response) => {
							if (response.institution_name === institutionName) {
								result.matchingAccessTokenResponses.push(response);
							} else {
								result.nonMatchingAccessTokenResponses.push(response);
							}
							return result;
						},
						{ matchingAccessTokenResponses: [], nonMatchingAccessTokenResponses: [] }
					);

				connectionConfiguration.access_token_responses = nonMatchingAccessTokenResponses;

				if (
					connection?.configuration?.asset_report_response?.asset_report_token ||
					connection?.configuration?.asset_report_token
				) {
					let assetReportToken: string;
					if (connection?.configuration?.asset_report_token) {
						assetReportToken = connection?.configuration?.asset_report_token;
						delete connection?.configuration?.asset_report_token;
					} else {
						assetReportToken = connection?.configuration?.asset_report_response?.asset_report_token;
					}
					try {
						await plaid.assetReportRevokeToken(assetReportToken);
					} catch (error) {
						logger.error(
							`Error revoking existing asset report token while removing institute: ${body.removed_institution_name}`
						);
					}
				}

				for (const { access_token } of matchingAccessTokenResponses) {
					if (access_token) {
						try {
							await plaid.revokePlaidLink(access_token);
						} catch (error) {
							logger.error(`Error revoking access token for institute: ${body.removed_institution_name}`);
						}
					}
				}
			}

			const accessTokenExists =
				connectionConfiguration.access_token_responses && connectionConfiguration.access_token_responses.length > 0;

			// Update link session ID and case ID in configuration.
			if (body.link_session_id && connectionConfiguration.link_token_response) {
				connectionConfiguration.link_token_response.link_session_id = body.link_session_id;
				connectionConfiguration.link_token_response.case_id = body.case_id || "";
			}

			// Log connection history.
			const connectionHistory = {
				id: uuidv4(),
				connection_id: connectionId,
				log: JSON.stringify(connectionConfiguration),
				connection_status: connectionStatus,
				created_at: new Date().toISOString()
			};

			const updateConnectionQuery = `UPDATE integrations.data_connections SET connection_status = $1, configuration = $2 where ID = $3`;
			const insertConnectionHistory = `INSERT INTO integrations.data_connections_history SELECT * FROM json_populate_recordset(null::integrations.data_connections_history, $1)`;

			await sqlTransaction(
				[updateConnectionQuery, insertConnectionHistory],
				[
					[connectionStatus, JSON.stringify(connectionConfiguration), connectionId],
					[JSON.stringify([connectionHistory])]
				]
			);

			let tasks: any[] = [];

			// Execute specific tasks based on connection phase.
			if (Object.hasOwn(body, "connection_phase") && body.connection_phase === "POST_ONBOARDING") {
				tasks = await executeOtherTasksOnApplicationEdit(INTEGRATION_ID.PLAID, businessID, headers.authorization, {
					action: "connected",
					integration_category: "Banking",
					integration_platform: "Plaid"
				});
			} else if (body.case_id && body.removed_institution_name) {
				const getAllCreatedTasks = `SELECT dbit.* FROM integrations.data_business_integrations_tasks dbit
						INNER JOIN integrations.business_score_triggers bst on bst.id = dbit.business_score_trigger_id
						INNER JOIN data_cases ON data_cases.score_trigger_id = bst.id
						WHERE data_cases.id = $1
						AND integration_task_id = $2
						ORDER BY dbit.created_at DESC`;
				const { rows } = await sqlQuery({
					sql: getAllCreatedTasks,
					values: [body.case_id, INTEGRATION_TASK.fetch_assets_data]
				});
				tasks = rows;
			}

			if (body.case_id && accessTokenExists) {
				const getTaskIdStatusQuery = `
				WITH task_to_update AS (
					SELECT integrations.data_business_integrations_tasks.id
					FROM integrations.data_business_integrations_tasks
					LEFT JOIN data_cases ON data_cases.score_trigger_id = integrations.data_business_integrations_tasks.business_score_trigger_id
					WHERE data_cases.business_id = $1
						AND data_cases.id = $2
						AND integrations.data_business_integrations_tasks.integration_task_id = $3
				)
				UPDATE integrations.data_business_integrations_tasks
				SET task_status = $4
				WHERE id IN (SELECT id FROM task_to_update)
				`;
				await sqlQuery({
					sql: getTaskIdStatusQuery,
					values: [businessID, body.case_id, INTEGRATION_TASK.fetch_assets_data, TASK_STATUS.IN_PROGRESS]
				});
			}

			// Send audit messages and Kafka events if not in POST_ONBOARDING phase.
			if (body.connection_phase !== "POST_ONBOARDING") {
				const auditMessage = {
					business_id: businessID,
					case_id: body.case_id,
					integration_category: "Banking",
					integration_platform: "Plaid",
					applicant_id: userInfo.user_id
				};

				const customerDetailsQuery = `SELECT integrations.business_score_triggers.customer_id 
                FROM integrations.business_score_triggers
                LEFT JOIN public.data_cases 
                ON integrations.business_score_triggers.id = public.data_cases.score_trigger_id
                WHERE public.data_cases.id = $1`;

				const { rows } = await sqlQuery({
					sql: customerDetailsQuery,
					values: [auditMessage.case_id]
				});

				const customerID = rows.length ? rows[0].customer_id : null;

				if (customerID) {
					await sendWebhookEvent(customerID, WEBHOOK_EVENTS.INTEGRATION_CONNECTED, auditMessage);
				}

				await producer.send({
					topic: kafkaTopics.NOTIFICATIONS,
					messages: [
						{
							key: auditMessage.business_id,
							value: {
								event: kafkaEvents.INTEGRATION_CONNECTED_AUDIT,
								...auditMessage
							}
						}
					]
				});

				try {
					if (!userInfo?.is_guest_owner) {
						await triggerSectionCompletedKafkaEventWithRedis({
							businessId: businessID,
							section: "Banking",
							userId: userInfo.user_id as UUID,
							customerId: customerID
						});
					}
				} catch (err: any) {
					logger.error(`Error sending Kafka event for section 'Banking': ${err.message}`);
				}
			}

			// Only fetch asset report if connection is associated with an access token.
			// If connection is no longer associated with an access token, remove institution
			// references from associated rel_task_bank_account records.
			if (accessTokenExists) {
				// Enqueue asset report tasks.
				for (const task of tasks) {
					const queue = new BullQueue(QUEUES.TASK);
					const jobId = `{fetch_asset_report}:${task.id}:${BankingTaskAction.CREATE_ASSET_REPORT}`;
					await queue.addJob(EVENTS.FETCH_ASSET_REPORT, task.id, {
						jobId,
						removeOnComplete: true,
						removeOnFail: false,
						delay: 500
					});
				}
			} else if (body.case_id && body.removed_institution_name) {
				logger.info(
					`No access tokens found. Clearing bank account ids from rel_task_bank_account records for case: ${body.case_id}`
				);
				for (const task of tasks) {
					await RelTaskBankAccount.upsertRecords(task.id, []);
				}
			}
		} catch (error) {
			throw error;
		}
	}

	/**
	 * Called when reaching out to Plaid to ask them to create or refresh an asset report
	 * @param {String} businessIntegrationTaskId system generated business integration task id
	 * @param {String} action - BankingTaskAction
	 */
	async fetchAssetReport(businessIntegrationTaskID, action = BankingTaskAction.CREATE_ASSET_REPORT) {
		// These calls will throw if task or connection not found
		logger.info(
			{
				task_id: businessIntegrationTaskID,
				action
			},
			`[FETCH ASSET REPORT] Starting to fetch asset report`
		);
		const task = await TaskManager.getEnrichedTask(businessIntegrationTaskID);
		let connection: IDBConnection;
		try {
			connection = await Plaid.getPlaidConnection(task?.business_id);
		} catch (error) {
			throw new BankingApiError("Bank connection does not exist", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
		}

		const plaid = await Plaid.getPlaid({ business_id: task.business_id });
		let access_tokens: string[] = [];
		const accessTokenconfigurations: IBanking.AccessTokenConfigurationObject[] = Array.isArray(
			connection?.configuration?.access_token_responses
		)
			? Object.values(connection.configuration.access_token_responses)
			: [connection.configuration];

		for (const config of accessTokenconfigurations) {
			const { access_token } = config || {};
			if (access_token && !access_tokens.includes(access_token)) {
				access_tokens.push(access_token);
			}
		}
		if (access_tokens.length === 0) {
			logger.warn(
				{
					task_id: businessIntegrationTaskID,
					business_id: task.business_id
				},
				`[FETCH ASSET REPORT] No access tokens found, retrying in 10 seconds`
			);
			const queue = new BullQueue(QUEUES.TASK);
			const jobId = `{fetch_asset_report}:${businessIntegrationTaskID}:${BankingTaskAction.CREATE_ASSET_REPORT}`;
			await queue.addJob(EVENTS.FETCH_ASSET_REPORT, businessIntegrationTaskID, {
				jobId,
				removeOnComplete: true,
				removeOnFail: false,
				delay: 10000 /* ms */
			});
			throw new BankingApiError(
				"Access Tokens Are Missing FetchAssetReport Retry In 10 Seconds",
				StatusCodes.NOT_FOUND,
				ERROR_CODES.NOT_FOUND
			);
		}

		logger.info(
			{
				task_id: businessIntegrationTaskID,
				business_id: task.business_id,
				num_access_tokens: access_tokens.length,
				action
			},
			`[FETCH ASSET REPORT] Found access tokens, proceeding with ${action}`
		);

		let taskStatus: TaskStatus = TASK_STATUS.INITIALIZED;
		let response: AssetReportCreateResponse | AssetReportRefreshResponse | undefined;

		try {
			switch (action) {
				case "CREATE_ASSET_REPORT":
					if (
						connection?.configuration?.asset_report_response?.asset_report_token ||
						connection?.configuration?.asset_report_token
					) {
						let assetReportToken: string;
						if (connection?.configuration?.asset_report_token) {
							assetReportToken = connection?.configuration?.asset_report_token;
							delete connection?.configuration?.asset_report_token;
						} else {
							assetReportToken = connection?.configuration?.asset_report_response?.asset_report_token;
						}
						try {
							await plaid.assetReportRevokeToken(assetReportToken);
						} catch (error) {
							logger.error(
								{ error },
								"fetchAssetReport: Error revoking existing asset report token while creating new asset report token"
							);
						}
					}
					const createAssetPayload = {
						business_integration_task_id: businessIntegrationTaskID,
						access_tokens: access_tokens,
						business_id: task.business_id,
						use_fast_assets: true
					};
					task.metadata = { ...task.metadata, taskAction: action };
					response = await plaid.createAssetReport(createAssetPayload);
					break;
				case "REFRESH_ASSET_REPORT":
					let refreshDays: number | undefined = task?.metadata?.refreshDays;
					let mostRecentTask: IBusinessIntegrationTaskEnriched | undefined;
					if (!refreshDays) {
						mostRecentTask = await this.getMostRecentBankingTask(task.business_id);
						if (mostRecentTask?.task_status === TASK_STATUS.SUCCESS) {
							// Calculate the number of days that have passed since the most recent successful banking task
							// this value is used if the request does not contain a days value
							refreshDays = Math.abs(dayjs(task.updated_at).diff(dayjs(), "days") || 0) + 1;
						}
					}
					task.metadata = { ...task.metadata, previousTask: mostRecentTask?.id, refreshDays, taskAction: action };
					const assetReportToken =
						connection?.configuration?.asset_report_response?.asset_report_token ||
						connection?.configuration?.asset_report_token;
					const refreshAssetPayload = {
						business_integration_task_id: businessIntegrationTaskID,
						asset_report_token: assetReportToken,
						business_id: task.business_id
					};
					try {
						response = await plaid.refreshAssetReport(refreshAssetPayload, refreshDays);
					} catch (error) {
						logger.error({ error }, "fetchAssetReport: Could not refresh asset report, attempting create instead");
						return this.fetchAssetReport(businessIntegrationTaskID, BankingTaskAction.CREATE_ASSET_REPORT);
					}
					break;
				default:
					throw new BankingApiError("Invalid asset report action", StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
			}
		} catch (error) {
			logger.error({ error }, `fetchAssetReport: businessID: ${task.business_id}, taskID: ${task.id}`);
			taskStatus = TASK_STATUS.ERRORED;
		}

		if (connection?.configuration) {
			connection.configuration.asset_report_response = {
				...response,
				environment:
					connection?.configuration?.environment ??
					connection?.configuration?.user_token_response?.environment ??
					connection?.configuration?.link_token_response?.environment
			};
		}
		const businessTask = {
			id: businessIntegrationTaskID,
			task_status: taskStatus,
			reference_id: response?.asset_report_id,
			metadata: JSON.stringify({ ...task.metadata, ...response })
		};
		const businessTaskEvent = {
			id: uuidv4(),
			business_integration_task_id: businessIntegrationTaskID,
			task_status: taskStatus
		};

		const updateTaskStatusQuery = `UPDATE integrations.data_business_integrations_tasks SET task_status = $1, metadata = $2, reference_id = $3 WHERE id = $4`;
		const insertBusinessTaskEvent = `INSERT INTO integrations.business_integration_tasks_events (id, business_integration_task_id, task_status) VALUES ($1, $2, $3)`;
		const updateConnectionQuery = `UPDATE integrations.data_connections SET configuration = $1 WHERE id = $2`;

		await sqlSequencedTransaction(
			[updateTaskStatusQuery, insertBusinessTaskEvent, updateConnectionQuery],
			[
				[businessTask.task_status, businessTask.metadata, businessTask.reference_id, businessTask.id],
				Object.values(businessTaskEvent),
				[connection.configuration, connection.id]
			]
		);
	}

	async enqueueAssetReportWebhook(data: AssetsProductReadyWebhook) {
		const reportType = data.report_type ?? "full";
		// Delay logic:
		// - Fast reports: 500ms (process ASAP for quick onboarding decisions)
		// - Full reports: 15s (allows fast report to complete processing and populate initial data before full report attempts processing)
		// Fast reports typically arrive sooner from Plaid and should be processed first due to lower data volume.
		// The longer delay for full reports provides a buffer to avoid race conditions where both webhooks
		// attempt to update the same task status simultaneously.
		const delay = reportType === "full" ? 15000 : 500;

		const queue = new BullQueue(QUEUES.TASK);
		const jobId = `{asset_report}:${data.asset_report_id}:${reportType}`;
		await queue.addJob(EVENTS.PLAID_ASSET_REPORT, data, {
			jobId,
			removeOnComplete: true,
			removeOnFail: false,
			delay
		});
	}

	async handleAssetReportWebhook(data: IBanking.ExtendedAssetsProductReadyWebhook) {
		const reportType = (data as { report_type?: string }).report_type?.toLowerCase() ?? "full";

		let taskStatus: TaskStatus = TASK_STATUS.IN_PROGRESS;
		const log = {
			webhook_code: data.webhook_code,
			webhook_type: data.webhook_type,
			error: data.error,
			asset_report_id: data.asset_report_id
		};
		const insertTaskEventsQuery = `INSERT INTO integrations.business_integration_tasks_events (id, business_integration_task_id, task_status, log) VALUES ($1, $2, $3, $4)`;

		if (data.webhook_code !== PLAID_WEBHOOK_CODE.PRODUCT_READY) {
			taskStatus = TASK_STATUS.FAILED;

			// Send message to case service to update case status to Under Manual Review
			const getCaseQuery = `SELECT public.data_cases.id, bst.business_id, dbit.business_score_trigger_id  FROM public.data_cases 
				RIGHT JOIN integrations.data_business_integrations_tasks dbit ON dbit.business_score_trigger_id = public.data_cases.score_trigger_id
				inner join integrations.business_score_triggers bst on bst.id = dbit.business_score_trigger_id
				where dbit.reference_id = $1`;
			const getCaseResult = await sqlQuery({ sql: getCaseQuery, values: [data.asset_report_id] });

			const caseRecord = getCaseResult.rows[0] as unknown as {
				id: UUID;
				business_id: UUID;
				metadata: any;
				business_score_trigger_id: UUID;
			};

			if (caseRecord) {
				await checkAndTriggerRiskAlert("integrations", caseRecord.business_id, caseRecord.business_score_trigger_id);
			}

			const message = {
				case_id: caseRecord.id,
				integration_category: "Banking"
			};

			await producer.send({
				topic: kafkaTopics.CASES,
				messages: [
					{
						key: caseRecord.business_id,
						value: {
							event: kafkaEvents.INTEGRATION_TASK_FAILED,
							business_id: caseRecord.business_id,
							...message
						}
					}
				]
			});

			const auditMessage = {
				business_id: caseRecord.business_id,
				case_id: caseRecord.id,
				integration_category: "Banking",
				integration_platform: "Plaid"
			};

			// Create an audit log
			await producer.send({
				topic: kafkaTopics.NOTIFICATIONS,
				messages: [
					{
						key: caseRecord.business_id,
						value: {
							event: kafkaEvents.INTEGRATION_DATA_FETCH_FAILED_AUDIT,
							...auditMessage
						}
					}
				]
			});
		}

		/* Only update task statuses for tasks that are for Plaid & not yet done --- the reference_id is the asset_report_id for a task  */
		const updateTaskStatusQuery = `UPDATE integrations.data_business_integrations_tasks AS tasks
			SET task_status = $1
			FROM integrations.data_connections AS connections
			WHERE tasks.connection_id = connections.id
			AND tasks.reference_id = $2
			AND connections.platform_id = $3
			RETURNING tasks.*;`;
		const selectTaskQuery = `SELECT tasks.* FROM integrations.data_business_integrations_tasks AS tasks
			INNER JOIN integrations.data_connections AS connections ON tasks.connection_id = connections.id
			WHERE tasks.reference_id = $1 AND connections.platform_id = $2
			ORDER BY tasks.created_at DESC LIMIT 1`;

		let task: IBusinessIntegrationTask | undefined;
		if (taskStatus === TASK_STATUS.IN_PROGRESS && (reportType === "fast" || reportType === "full")) {
			const selectResult = await sqlQuery({
				sql: selectTaskQuery,
				values: [data.asset_report_id, INTEGRATION_ID.PLAID]
			});
			const selectedTask = (selectResult.rows as unknown as IBusinessIntegrationTask[])[0];
			if (reportType === "full" && selectedTask?.task_status === TASK_STATUS.SUCCESS) {
				task = selectedTask;
			} else {
				const result = await sqlQuery({
					sql: updateTaskStatusQuery,
					values: [taskStatus, data.asset_report_id, INTEGRATION_ID.PLAID]
				});
				task = (result.rows as unknown as IBusinessIntegrationTask[]).sort((a, b) =>
					dayjs(b.created_at).diff(dayjs(a.created_at))
				)[0];
			}
		} else {
			const result = await sqlQuery({
				sql: updateTaskStatusQuery,
				values: [taskStatus, data.asset_report_id, INTEGRATION_ID.PLAID]
			});
			task = (result.rows as unknown as IBusinessIntegrationTask[]).sort((a, b) =>
				dayjs(b.created_at).diff(dayjs(a.created_at))
			)[0];
		}

		if (task && taskStatus === TASK_STATUS.IN_PROGRESS) {
			const isFastReport = reportType === "fast";

			// Skip processing if this is a full report and the task is already SUCCESS (fast report already processed it)
			// This prevents duplicate processing and ensures data consistency
			if (reportType === "full" && task.task_status === TASK_STATUS.SUCCESS) {
				logger.info(
					{
						taskId: task.id,
						assetReportId: data.asset_report_id,
						connectionId: task.connection_id
					},
					"Skipping full asset report processing; task already completed by fast report"
				);
				return;
			}

			if (!(reportType === "full" && task.task_status === TASK_STATUS.SUCCESS)) {
				await sqlQuery({ sql: insertTaskEventsQuery, values: [uuidv4(), task.id, TASK_STATUS.IN_PROGRESS, log] });
			}

			const plaid = await Plaid.getPlaid({ connection_id: task.connection_id });
			const isPlaidSucceed = await plaid.pullAssetReportFromPlaid(task.metadata, task.id, { fastReport: isFastReport });
			if (!isPlaidSucceed) {
				logger.error(
					{
						taskId: task.id,
						assetReportId: data.asset_report_id,
						connectionId: task.connection_id,
						reportType,
						webhookCode: data.webhook_code
					},
					"Error pulling asset report from Plaid"
				);
				return;
			}

			taskStatus = TASK_STATUS.SUCCESS;
			const selectBusinessIdQuery = `SELECT integrations.data_connections.business_id , trigger_type FROM integrations.data_connections 
			LEFT JOIN integrations.data_business_integrations_tasks ON integrations.data_business_integrations_tasks.connection_id = data_connections.id
			LEFT JOIN integrations.business_score_triggers ON integrations.business_score_triggers.id = integrations.data_business_integrations_tasks.business_score_trigger_id
			WHERE integrations.data_business_integrations_tasks.id = $1`;
			const [_, business] = await sqlTransaction(
				[updateTaskStatusQuery, selectBusinessIdQuery, insertTaskEventsQuery],
				[[taskStatus, data.asset_report_id, INTEGRATION_ID.PLAID], [task.id], [uuidv4(), task.id, taskStatus, log]]
			);

			try {
				await TaskManager.updateConnectionStatus(task.connection_id as UUID, CONNECTION_STATUS.SUCCESS);
			} catch (error: unknown) {
				logger.error({ error }, `businessId=${business.rows[0].business_id} Error updating connection status`);
			}

			if (!isFastReport) {
				await prepareIntegrationDataForScore(task.id, business.rows[0].trigger_type);
			}
		}
	}

	async getBankingInformation(
		params: { caseID; businessID; beforeDate?: any },
		query: { caseID?: UUID; score_trigger_id?: UUID }
	) {
		if (!params.caseID && !params.businessID) {
			throw new BankingApiError("Invalid request", StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
		}

		let response: IBanking.BankingResponse[] = [];
		let task: IBusinessIntegrationTask | undefined;

		const getTaskForScoreTrigger = async (scoreTrigger, businessID) =>
			TaskManager.findOneTask({
				business_id: businessID,
				query: {
					score_trigger_id: scoreTrigger
				}
			});

		const depositAccountInfo = await this.getDepositAccount({ businessID: params.businessID });

		if (query.score_trigger_id) {
			// Get first task created_at with this score_trigger_id
			task = await getTaskForScoreTrigger(query.score_trigger_id, params.businessID);
			params.beforeDate = dayjs.utc(task.created_at).toDate();
		} else if (params.caseID || query.caseID) {
			let caseID = params.caseID || query.caseID;
			const caseObject = await getCase(caseID).catch(() => {
				logger.error(`Could not get case created_at for caseID=${caseID}`);
				return undefined;
			});
			if (caseObject?.created_at) {
				params.beforeDate = dayjs.utc(caseObject.created_at).toDate();
			}
		}

		// get business and owner details
		let data = await getBusinessDetails(params.businessID);

		const businessDetails = data.data as BusinessDetails;

		const namesArr: string[] = [];
		if (businessDetails && Object.keys(businessDetails).length) {
			// push business-names
			businessDetails.business_names &&
				businessDetails.business_names.forEach(business => {
					namesArr.push(business.name);
				});

			businessDetails.owners &&
				businessDetails.owners.forEach(owner => {
					namesArr.push(`${owner.first_name} ${owner.last_name}`);
				});
		}

		const plaidS3Data =
			(await getRawIntegrationDataFromS3(params.businessID, "asset_reports", DIRECTORIES.BANKING, "PLAID", false)) ||
			{};

		let validAccounts = {};
		if (plaidS3Data && plaidS3Data.report) {
			const { report } = plaidS3Data;

			const options: IFuseOptions<any> = {
				threshold: 0.3, // Adjust the threshold to control the fuzziness, 0 is perfect-match and 1 is any-match
				includeMatches: true,
				includeScore: true,
				isCaseSensitive: false
			};

			const fuse = new Fuse(namesArr, options);

			for (const i in report.items) {
				for (const account of report.items[i].accounts) {
					// mark = invalid for every account
					validAccounts[account.account_id] = false;

					if (account.name && fuse.search(account.name).length) {
						validAccounts[account.account_id] = true;
					} else if (account.official_name && fuse.search(account.official_name).length) {
						validAccounts[account.account_id] = true;
					} else if (account.owners && account.owners.length) {
						// check for owners
						account.owners.forEach(owner => {
							owner.names &&
								owner.names.forEach(name => {
									if (name && fuse.search(name).length) {
										validAccounts[account.account_id] = true;
									}
								});
						});
					}
				}
			}
		}

		const endDate = params.beforeDate ? dayjs.utc(params.beforeDate).toDate() : new Date();
		const startDate = dayjs.utc(endDate).subtract(3, "months").toDate();
		let bankAccounts: BankAccount[];
		// Check if a specific case ID is provided in the query
		if (query.caseID) {
			// fetch banking task associated with the case ID
			const bankingTask: IBusinessIntegrationTask = await db<IBusinessIntegrationTask>(
				"integrations.data_business_integrations_tasks"
			)
				.select("integrations.data_business_integrations_tasks.*")
				.join("integrations.data_connections", "data_connections.id", "data_business_integrations_tasks.connection_id")
				.join(
					"integrations.business_score_triggers",
					"business_score_triggers.id",
					"data_business_integrations_tasks.business_score_trigger_id"
				)
				.join("public.data_cases", "data_cases.score_trigger_id", "business_score_triggers.id")
				.where("integrations.data_connections.business_id", params.businessID)
				.where("data_cases.id", query.caseID)
				.where("data_connections.platform_id", INTEGRATION_ID.PLAID)
				.first();

			if (!bankingTask) {
				throw new BankingApiError("Banking task not found", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
			}

			// check if task data is present in rel_task_bank_accounts table
			const taskBankAccount: IBanking.TaskBankAccounts = await db("integration_data.rel_task_bank_account")
				.where("business_integration_task_id", bankingTask.id)
				.first();
			if (taskBankAccount) {
				bankAccounts = await BankAccount.findRelBankAccountByTaskId(bankingTask.id, {
					deposite: true,
					businessId: params.businessID,
					is_additional_account: true
				});
			} else {
				// this means this was onboarded previously so there's no linking of task and bank account in rel table
				// so we have to fetch all bank accounts associated with the given business ID
				bankAccounts = await BankAccount.findByBusinessId(params.businessID);
			}
		} else {
			// Fetch all bank accounts associated with the given business ID
			bankAccounts = await BankAccount.findByBusinessId(params.businessID);
		}
		// Removes duplicate bank accounts, preferring Plaid versions over manual ones
		bankAccounts = await deduplicateBankAccounts(bankAccounts);

		// Iterate through each account and fetch transactions and balances -- optionally filter transactions by beforeDate
		for (const accountRecord of bankAccounts) {
			const account = accountRecord.getRecord();
			// Remove platform_id from response as it's internal only
			const { platform_id, ...accountWithoutPlatformId } = account;

			const transactions = await BankAccountTransaction.findTransactionsBetweenDatesForPlaidAccount(
				account.bank_account,
				startDate,
				endDate
			).then(transactions => BankAccountTransaction.unwrap(transactions));

			const bankAccountVerification = await BankAccountVerification.findByBankAccountId(account.id);

			const dailyBalanceObjects = await BankAccountBalanceDaily.findForDates(account.id, startDate, endDate);
			if (dailyBalanceObjects.length) {
				const dailyBalances = BankAccountBalanceDaily.unwrap(dailyBalanceObjects);

				const monthlyBalances = BankAccountBalanceDaily.toBankAccountBalanceRecord(dailyBalances);
				const sum = monthlyBalances.reduce((acc, dailyBalance) => acc.add(dailyBalance.balance), currency(0));
				// Find most recent "available" and "current" balances in the Daily balances
				const [mostRecentCurrent, mostRecentAvailable] = dailyBalances.reduce(
					(acc, record) => {
						const isNewest = dayjs.utc(record.date).isAfter(acc[0]?.date);
						if (isNewest) {
							acc[0] = record;
							if (record.available !== null) {
								// If the balance is available, set it as the most recent available balance
								acc[1] = record;
							}
						}
						return acc;
					},
					[dailyBalances[0], dailyBalances[0]]
				);

				response.push({
					...accountWithoutPlatformId,
					balance_available: mostRecentAvailable?.available ?? mostRecentCurrent?.current,
					balance_current: mostRecentCurrent?.current,
					average_balance: roundNum(sum.value / monthlyBalances.length, 2),
					transactions: transactions,
					balances: monthlyBalances,
					match: validAccounts[account.bank_account] || false,
					depositAccountInfo: account.deposit_account ? depositAccountInfo : null,
					is_additional_account: account.is_additional_account ?? false,
					verification_result: bankAccountVerification.record ?? null,
					...(account.institution_name === "ACH" || account?.is_additional_account === true
						? {
								bank_account: decryptData(account.bank_account),
								routing: decryptData(account.routing_number),
								wire_routing: account.wire_routing_number ? decryptData(account.wire_routing_number) : null
							}
						: {})
				});
			} else {
				const monthlyBalances = await BankAccountBalance.findByBankAccountId(account.id);
				const sum = monthlyBalances.reduce((acc, balance) => acc.add(balance.getRecord().balance), currency(0));
				response.push({
					...accountWithoutPlatformId,
					average_balance: roundNum(sum.value / monthlyBalances.length, 2),
					transactions: transactions,
					balances: monthlyBalances,
					match: validAccounts[account.bank_account] || false,
					depositAccountInfo: account.deposit_account ? depositAccountInfo : null,
					is_additional_account: account.is_additional_account ?? false,
					verification_result: bankAccountVerification.record ?? null,
					...(account.institution_name === "ACH" || account?.is_additional_account === true
						? {
								bank_account: decryptData(account.bank_account),
								routing: decryptData(account.routing_number),
								wire_routing: account.wire_routing_number ? decryptData(account.wire_routing_number) : null
							}
						: {})
				});
			}
		}

		return {
			data: normalizePlaidLinkedBankAccounts(response),
			message: "Banking information fetched successfully."
		};
	}

	public async getBankingTradeLines(params: { businessID: UUID }, query: { case_id: UUID; score_trigger_id: UUID }) {
		try {
			// TODO: Handle check for customerID in token === customerID of the case
			const { businessID } = params;
			let plaidTask: IBusinessIntegrationTaskEnriched, equifaxTask: IBusinessIntegrationTaskEnriched;

			if (Object.hasOwn(query, "case_id")) {
				plaidTask = await TaskManager.getLatestTaskForBusiness(
					businessID,
					INTEGRATION_ID.PLAID,
					"fetch_assets_data",
					true,
					"",
					query.case_id
				);
				equifaxTask = await TaskManager.getLatestTaskForBusiness(
					businessID,
					INTEGRATION_ID.EQUIFAX,
					"fetch_public_records",
					false,
					"integration_data.request_response.response",
					query.case_id
				);
			} else if (Object.hasOwn(query, "score_trigger_id")) {
				plaidTask = await TaskManager.getTaskForBusiness(
					businessID,
					INTEGRATION_ID.PLAID,
					"fetch_assets_data",
					true,
					"",
					query.score_trigger_id
				);
				equifaxTask = await TaskManager.getTaskForBusiness(
					businessID,
					INTEGRATION_ID.EQUIFAX,
					"fetch_public_records",
					false,
					"integration_data.request_response.response",
					query.score_trigger_id
				);
			} else {
				plaidTask = await TaskManager.getLatestTaskForBusiness(
					businessID,
					INTEGRATION_ID.PLAID,
					"fetch_assets_data",
					true
				);
				equifaxTask = await TaskManager.getLatestTaskForBusiness(
					businessID,
					INTEGRATION_ID.EQUIFAX,
					"fetch_public_records",
					false,
					"integration_data.request_response.response"
				);
			}

			// We just want any of the plaid task to be completed and fetch_assets_data is one of the very first task that gets executed, so if fetch_assets_data is not completed yet then we wont show the data
			if (!plaidTask) {
				return {
					data: {},
					message: "No trade lines found."
				};
			}
			if (!equifaxTask) {
				return {
					data: { trade_lines: {} },
					message: "No data available at the moment."
				};
			}
			const { efx_raw_response } = await this.getBankingTradeLinesRows(equifaxTask);
			if (
				!efx_raw_response.length ||
				!Object.keys(efx_raw_response[0].response).length ||
				!Object.hasOwn(efx_raw_response[0].response, "creditSummaryFields")
			) {
				// connection exists but data is not pulled yet or it failed to pull the data
				// "Trade lines / Credit summary has not been fetched yet."
				return {
					data: { trade_lines: {} },
					message: "No data available at the moment."
				};
			}

			const requiredTradeLinesKeys = [
				"non_financial_acc_reported_24_months_count",
				"max_non_financial_balance_24_months",
				"og_credit_limit_non_financial_acc_reported_24_months",
				"max_acc_limit_non_financial_acc_reported_24_months",
				"non_financial_acc_cycles_due_or_charge_off_24_months_count",
				"new_non_financial_acc_opened_3_months",
				"total_non_financial_charge_off_amount_24_monts",
				"satisfactory_non_financial_acc_percentage_24_months",
				"worst_non_financial_payment_status_24_months"
			];
			let efxResponse;
			try {
				efxResponse = JSON.parse(efx_raw_response[0].response.creditSummaryFields);
			} catch (e) {
				// Check if the response is accessible without parsing
				if (Object.hasOwn(efx_raw_response[0].response, "creditSummaryFields")) {
					efxResponse = efx_raw_response[0].response.creditSummaryFields;
				} else {
					logger.error("Error parsing JSON response for credit summary: " + e);
					return {
						data: { trade_lines: {} },
						message: "No data available at the moment."
					};
				}
			}

			const requiredTradeLinesKeysFound = requiredTradeLinesKeys.some(
				tradeLineKey => Object.hasOwn(efxResponse, tradeLineKey) || efxResponse[tradeLineKey] !== null
			);

			if (!requiredTradeLinesKeysFound) {
				// connection exists but no equfiax matches or data returned from equifax is null
				// "Trade lines / Credit summary has been fetched and equates to null."
				return {
					data: { trade_lines: {} },
					message: "No data available at the moment."
				};
			}

			const response = {
				// Key wise Unknown ranges and nulls have been marked to 'N/A'
				trade_lines: {
					non_financial_acc_reported_24_months_count:
						efxResponse?.non_financial_acc_reported_24_months_count === 999999999
							? "N/A"
							: efxResponse?.non_financial_acc_reported_24_months_count === null
								? "N/A"
								: efxResponse?.non_financial_acc_reported_24_months_count,
					max_non_financial_balance_24_months:
						efxResponse?.max_non_financial_balance_24_months === 999999999
							? "N/A"
							: efxResponse?.max_non_financial_balance_24_months === null
								? "N/A"
								: efxResponse?.max_non_financial_balance_24_months,
					og_credit_limit_non_financial_acc_reported_24_months:
						efxResponse?.og_credit_limit_non_financial_acc_reported_24_months === 999999999
							? "N/A"
							: efxResponse?.og_credit_limit_non_financial_acc_reported_24_months === null
								? "N/A"
								: efxResponse?.og_credit_limit_non_financial_acc_reported_24_months,
					max_acc_limit_non_financial_acc_reported_24_months:
						efxResponse?.max_acc_limit_non_financial_acc_reported_24_months === 999999999
							? "N/A"
							: efxResponse?.max_acc_limit_non_financial_acc_reported_24_months === null
								? "N/A"
								: efxResponse?.max_acc_limit_non_financial_acc_reported_24_months,
					non_financial_acc_cycles_due_or_charge_off_24_months_count:
						efxResponse?.non_financial_acc_cycles_due_or_charge_off_24_months_count === 99
							? "N/A"
							: efxResponse?.non_financial_acc_cycles_due_or_charge_off_24_months_count === null
								? "N/A"
								: efxResponse?.non_financial_acc_cycles_due_or_charge_off_24_months_count,
					new_non_financial_acc_opened_3_months:
						efxResponse?.new_non_financial_acc_opened_3_months === 99
							? "N/A"
							: efxResponse?.new_non_financial_acc_opened_3_months === null
								? "N/A"
								: efxResponse?.new_non_financial_acc_opened_3_months,
					total_non_financial_charge_off_amount_24_monts:
						efxResponse?.total_non_financial_charge_off_amount_24_monts === 999999999
							? "N/A"
							: efxResponse?.total_non_financial_charge_off_amount_24_monts === null
								? "N/A"
								: efxResponse?.total_non_financial_charge_off_amount_24_monts,
					satisfactory_non_financial_acc_percentage_24_months:
						efxResponse?.satisfactory_non_financial_acc_percentage_24_months === 999.99
							? "N/A"
							: efxResponse?.satisfactory_non_financial_acc_percentage_24_months === null
								? "N/A"
								: efxResponse?.satisfactory_non_financial_acc_percentage_24_months,
					worst_non_financial_payment_status_24_months:
						efxResponse?.worst_non_financial_payment_status_24_months === 99
							? "N/A"
							: efxResponse?.worst_non_financial_payment_status_24_months === null
								? "N/A"
								: efxResponse?.worst_non_financial_payment_status_24_months
				}
			};

			return {
				data: response,
				message: "Banking trade lines has been fetched successfully."
			};
		} catch (err) {
			throw err;
		}
	}

	@HydrateFromWarehouse({
		isEmptyFn: sqlResult => {
			// Attempt hydration on an empty result set if either we dont have additional data from verdata other than whats store in public_Records table OR
			// If we dont have additional data from equifax
			if (
				(sqlResult.efx_raw_response.length && sqlResult.efx_raw_response[0].request_id === null) ||
				!sqlResult.efx_raw_response.length ||
				!Object.hasOwn(sqlResult.efx_raw_response[0].response, "creditSummaryFields")
			) {
				return true;
			}
			return false;
		},
		checkFn: equifaxTask =>
			Promise.resolve(!equifaxTask.request_id || !Object.hasOwn(equifaxTask.response, "creditSummaryFields")),
		hydrateFn: async function (this: Banking, _, equifaxTask) {
			const dbConnection = await getConnectionByTaskId(equifaxTask.id);
			if (dbConnection) {
				const equifax = await strategyPlatformFactory<Equifax>({ dbConnection });
				await equifax.fetchCreditSummary(equifaxTask, equifax);
			}
		}
	})
	private async getBankingTradeLinesRows(equifaxTask: IBusinessIntegrationTaskEnriched) {
		try {
			const getTradeLinesQuery: string = `SELECT request_id, response FROM integration_data.request_response 
				WHERE integration_data.request_response.request_id = '${equifaxTask.id}'`;
			const tradeLinesRecords = await sqlQuery({ sql: getTradeLinesQuery });

			return { efx_raw_response: tradeLinesRecords.rows };
		} catch (err) {
			throw err;
		}
	}

	/**
	 * Purge banking data for the supplied connectionId
	 * @param connectionId
	 * @deprecated
	 */
	private async purgeForConnection(connectionId: string): Promise<void> {
		logger.warn(`Purging banking data for connection ${connectionId}`);
		await BankAccountTransaction.purgeByConnectionId(connectionId);
		await BankAccountBalance.purgeByConnectionId(connectionId);
		await BankAccount.purgeByConnectionId(connectionId, false);
	}

	/**
	 * Revokes the Plaid connection for a given business.
	 *
	 * @param {Object} params - The parameters for the API request.
	 * @param {string} params.businessID - The ID of the business.
	 * @param {Object} headers - The headers for the API request.
	 * @param {string} headers.authorization - The authorization token.
	 * @param {Object} userInfo - The user information.
	 * @param {string} userInfo.user_id - The ID of the user.
	 * @returns {Object} - The response object containing the revoked connection status and additional data.
	 * @throws {BankingApiError} - If there is an error during the API request.
	 */
	async revokePlaidConnection(params, query, headers, userInfo) {
		try {
			const { businessID } = params;
			const records = await getBusinessApplicants(params.businessID, headers.authorization);
			const applicants = records.map(applicant => applicant.id);

			if (!applicants.includes(userInfo.user_id)) {
				throw new BankingApiError(
					"You are not allowed to access details of this business",
					StatusCodes.UNAUTHORIZED,
					ERROR_CODES.UNAUTHENTICATED
				);
			}

			const getConnection = `SELECT * FROM integrations.data_connections 
				WHERE business_id = $1 AND 
					platform_id = (
						SELECT id FROM integrations.core_integrations_platforms WHERE code = $2
					)`;
			const getConnectionStatusResult: SqlQueryResult = await sqlQuery({
				sql: getConnection,
				values: [businessID, "plaid"]
			});

			if (!getConnectionStatusResult.rows.length) {
				throw new BankingApiError("Bank connection does not exist", StatusCodes.NOT_FOUND, ERROR_CODES.INVALID);
			}
			if (getConnectionStatusResult.rows[0].connection_status === CONNECTION_STATUS.REVOKED) {
				throw new BankingApiError("Connection is already revoked.", StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
			}

			if (getConnectionStatusResult.rows[0].connection_status === CONNECTION_STATUS.CREATED) {
				throw new BankingApiError("Connection is in created state only.", StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
			}

			let sendEvent = false;
			let customerID: string = "";
			const payload = {
				business_id: params.businessID,
				integration_category: "Banking",
				integration_platform: "Plaid"
			};
			if (query && query.invitation_id) {
				// fetch customer-id related to invitation-id
				const data = await getInvitationDetails(query.invitation_id);

				if (!data || !data.customer_id) {
					throw new BankingApiError("Invitation details not found", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
				}

				customerID = data.customer_id;
				sendEvent = true;
			}

			const plaid = await Plaid.getPlaid({ business_id: params.businessID });

			// TODO: add internal API calls to pull business + applicant/owner data ( see createLinkToken implementation for required data)
			const configurations = Array.isArray(getConnectionStatusResult?.rows[0]?.configuration?.access_token_responses)
				? getConnectionStatusResult.rows[0].configuration.access_token_responses
				: [getConnectionStatusResult.rows[0].configuration];

			const responses: any[] = [];

			for (const { access_token } of configurations) {
				if (access_token) {
					try {
						const response = await plaid.revokePlaidLink(access_token);
						responses.push(response);
					} catch (ex) {
						logger.error(`Error revoking plaid connection: ${JSON.stringify(ex)}`);
					}
				}
			}

			const assetReportToken =
				getConnectionStatusResult?.rows[0]?.configuration?.asset_report_response?.asset_report_token ??
				getConnectionStatusResult?.rows[0]?.configuration?.asset_report_token;

			if (assetReportToken) {
				try {
					const response = await plaid.assetReportRevokeToken(assetReportToken);
					responses.push(response);
				} catch (ex) {
					logger.error(`Error revoking plaid connection: ${JSON.stringify(ex)}`);
				}
			}
			const updatedConfig = getConnectionStatusResult?.rows[0]?.configuration?.user_token_response
				? { user_token_response: getConnectionStatusResult?.rows[0]?.configuration?.user_token_response }
				: {};
			const updateConnectionQuery = `UPDATE integrations.data_connections SET configuration = $1 WHERE id = $2`;
			await sqlQuery({ sql: updateConnectionQuery, values: [updatedConfig, getConnectionStatusResult?.rows[0]?.id] });

			await TaskManager.updateConnectionStatus(
				getConnectionStatusResult.rows[0].id,
				CONNECTION_STATUS.REVOKED,
				responses
			);
			if (responses.length === 0) {
				if (sendEvent) {
					await sendWebhookEvent(customerID, WEBHOOK_EVENTS.INTEGRATION_FAILED, payload);
				}
				throw new BankingApiError(
					"Failed to revoke plaid connection",
					StatusCodes.INTERNAL_SERVER_ERROR,
					ERROR_CODES.UNKNOWN_ERROR
				);
			}

			if (sendEvent) {
				await sendWebhookEvent(customerID, WEBHOOK_EVENTS.INTEGRATION_DISCONNECTED, payload);
			}

			await executeOtherTasksOnApplicationEdit(INTEGRATION_ID.PLAID, businessID, headers.authorization, {
				action: "revoked",
				integration_category: "Banking",
				integration_platform: "Plaid"
			});

			return {
				data: {
					responses,
					is_plaid_linked: false
				}
			};
		} catch (error) {
			throw error;
		}
	}

	manuallyCalculateBalanceForMonthAsOfDate = (
		transactions: IBanking.BankAccountTransactionRecord[],
		endingAt: string,
		startingBalance = 0
	): number => {
		const startOfMonth = dayjs(endingAt).startOf("month");
		const filteredTransactions = transactions
			? transactions.filter(transaction => {
					return dayjs(transaction.created_at).isAfter(startOfMonth);
				})
			: [];
		const balance = filteredTransactions.reduce(
			(total, transaction) => total.add(transaction.amount),
			currency(startingBalance)
		);
		return balance.value;
	};

	async checkAndCreateNewPlaidInstance(query?: {
		invitation_id?: string;
		customer_id?: string;
	}): Promise<{ plaid: Plaid; plaidEnv: "sandbox" | "default" }> {
		let usePlaidSandbox = false;
		let customerID: string | null = null;

		if (query && query.invitation_id) {
			// fetch customer-id related to invitation-id
			const data = await getInvitationDetails(query.invitation_id);

			if (!data || !data.customer_id) {
				throw new BankingApiError("Invitation details not found", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
			}

			customerID = data.customer_id;
		}

		if (query && query.customer_id) {
			customerID = query.customer_id;
		}

		if (customerID) {
			usePlaidSandbox = await getFlagValue(FEATURE_FLAGS.PLAID_SANDBOX_ENV_IN_PROD, {
				key: "customer",
				kind: "customer",
				customer_id: customerID
			});
		}

		if (usePlaidSandbox) {
			return { plaid: new Plaid("sandbox"), plaidEnv: "sandbox" };
		}

		return { plaid: new Plaid(), plaidEnv: "default" };
	}

	async getAdditionalAccountInfo(
		{ businessID }: { businessID: UUID },
		{ case_id }: { case_id?: UUID }
	): Promise<{ accounts: IAdditionalAccountInfoResponse[] }> {
		const allAdditionalAccounts = await this.findAllAdditionalAccounts(businessID, case_id);

		const results: IAdditionalAccountInfoResponse[] = [];
		for (const account of BankAccount.unwrap(allAdditionalAccounts)) {
			results.push({
				id: account.id as UUID,
				bank_account: decryptData(account.bank_account),
				routing_number: decryptData(account.routing_number),
				wire_routing_number: account.wire_routing_number ? decryptData(account.wire_routing_number) : null,
				bank_name: account.bank_name,
				official_name: account.official_name,
				institution_name: account.institution_name,
				mask: account.mask,
				type: account.type,
				subtype: account.subtype as string,
				account_holder_name: account.account_holder_name ?? null,
				account_holder_type: account.account_holder_type ?? null,
				verification_status: account.verification_status as string
			});
		}

		return {
			accounts: results
		};
	}

	async getAllBankingAccounts(
		{ businessID }: { businessID: UUID },
		{ case_id }: { case_id?: UUID }
	): Promise<{ accounts: IAllBankingAccountsResponse[] }> {
		const allAdditionalAccounts = await this.findAllAccounts(businessID, case_id);

		const results: IAllBankingAccountsResponse[] = [];
		for (const account of BankAccount.unwrap(allAdditionalAccounts) as IBanking.BankAccountRecord[]) {
			results.push({
				id: account.id as UUID,
				bank_account: decryptData(account.bank_account),
				routing_number: decryptData(account.routing_number),
				wire_routing_number: account.wire_routing_number ? decryptData(account.wire_routing_number) : null,
				bank_name: account.bank_name,
				official_name: account.official_name,
				institution_name: account.institution_name,
				mask: account.mask,
				type: account.type,
				subtype: account.subtype as string,
				account_holder_name: account.account_holder_name ?? null,
				account_holder_type: account.account_holder_type ?? null,
				verification_status: account.verification_status as string,
				is_additional_account: account.is_additional_account ?? false,
				is_deposit_account: account.deposit_account ?? false
			});
		}

		return {
			accounts: results
		};
	}

	/**
	 * When given a businessId & optional caseId, return all accounts for the business owned by the customer associated with the case
	 * When no case is given, return all accounts for the business
	 * @param businessID
	 * @param caseID
	 * @returns BankAccount[]
	 */
	private async findAllAccounts(businessID: UUID, caseID?: UUID): Promise<BankAccount[]> {
		let allAccounts: BankAccount[] = [];
		if (caseID) {
			const caseRecord = await getCase(caseID);
			const businessScoreTriggerRepository = new BusinessScoreTriggerRepository();
			const businessScoreTrigger = await businessScoreTriggerRepository.getById(caseRecord.score_trigger_id);
			allAccounts = await BankAccount.findByBusinessAndCustomerId<BankAccount>(
				businessID,
				businessScoreTrigger.customer_id ?? null
			);
		} else {
			allAccounts = await BankAccount.findByBusinessId<BankAccount>(businessID);
		}
		return allAccounts;
	}

	/**
	 * When given a businessId & caseId, return all additional accounts for the business owned by the customer associated with the case
	 * When no case is given, return all additional accounts for the business
	 * @param businessID
	 * @param caseID
	 * @returns BankAccount[] (filtered to only include additional accounts)
	 */
	private async findAllAdditionalAccounts(businessID: UUID, caseID?: UUID): Promise<BankAccount[]> {
		const allAccountObjects: BankAccount[] = await this.findAllAccounts(businessID, caseID);
		return allAccountObjects.filter(account => account.getRecord().is_additional_account);
	}

	async setAdditionalAccountInfo(
		{ businessID }: { businessID: UUID },
		{ accountData, case_id }: IAdditionalAccountInfoBody,
		{ authorization }: { authorization: string },
		userInfo: UserInfo
	) {
		await this.checkUserAccess(businessID, authorization, userInfo);

		const allAdditionalAccounts = await this.findAllAdditionalAccounts(businessID, case_id);

		const existingAccount = allAdditionalAccounts
			.map(acct => acct.getRecord())
			.find(
				account =>
					decryptData(account.bank_account) === accountData.bank_account &&
					decryptData(account.routing_number) === accountData.routing_number
			);

		if (existingAccount) {
			throw new BankingApiError(
				"This account is already added as an additional account",
				StatusCodes.BAD_REQUEST,
				ERROR_CODES.INVALID
			);
		}

		if (userInfo?.is_guest_owner && userInfo.issued_for && Object.keys(userInfo.issued_for).length > 0) {
			const changedFields = this.buildChangedFields(accountData, null);
			if (changedFields.length) {
				await this.setApplicationEditData(businessID, case_id, userInfo, changedFields);
			}
		}
		const manualBanking = await ManualBanking.getInstance(businessID);
		await manualBanking.addAccount(accountData, (userInfo?.issued_for?.user_id ?? userInfo?.user_id) as UUID, case_id);
	}

	/**
	 * Builds the changed fields for the application edit data
	 * @param newAccountData - The new account data
	 * @param existingAccount - The existing account data
	 * @returns The changed fields
	 */
	private buildChangedFields(
		newAccountData: IAdditionalAccountInfoBody["accountData"] | null,
		existingAccount: IBanking.BankAccountRecord | null
	): Array<ChangedField> {
		const changedFields: Array<ChangedField> = [];

		const mode: "is_inserted" | "is_updated" | "is_deleted" =
			newAccountData === null ? "is_deleted" : existingAccount === null ? "is_inserted" : "is_updated";

		// Limit comparison to only the fields that are relvant to the operation
		const accountKeys: (keyof IBanking.BankAccountRecord)[] = [
			"bank_name",
			"official_name",
			"bank_account",
			"routing_number",
			"subtype"
		];

		for (const key in accountKeys) {
			let oldValue = existingAccount?.[key] ?? null;
			let newValue = newAccountData?.[key] ?? null;

			if (["bank_account", "routing_number"].includes(key)) {
				oldValue = oldValue ? decryptData(oldValue) : null;
			}
			if (oldValue != newValue) {
				changedFields.push({
					field_name: key,
					old_value: oldValue,
					new_value: newValue,
					metadata: { [mode]: true }
				});
			}
		}
		return changedFields;
	}

	private async setApplicationEditData(
		businessID: UUID,
		case_id: UUID,
		userInfo: UserInfo,
		changedFields: Array<ChangedField>
	) {
		await setApplicationEditData(businessID, {
			case_id,
			customer_id: userInfo?.issued_for?.customer_id,
			stage_name: "banking",
			user_name: `${userInfo?.issued_for?.first_name ?? ""} ${userInfo?.issued_for?.last_name ?? ""}`.trim(),
			created_by: userInfo?.issued_for?.user_id,
			data: changedFields
		});
	}

	async updateAdditionalAccountInfo(
		{ businessID }: { businessID: UUID },
		{ accountData, case_id, account_id }: IAdditionalAccountInfoBody & { account_id: UUID },
		{ authorization }: { authorization: string },
		userInfo: UserInfo
	) {
		await this.checkUserAccess(businessID, authorization, userInfo);

		const allAdditionalAccounts = BankAccount.unwrap(await this.findAllAdditionalAccounts(businessID, case_id));

		const account = allAdditionalAccounts.find(account => account.id === account_id);
		if (!account) {
			throw new BankingApiError(
				"No additional account found with the given ID",
				StatusCodes.NOT_FOUND,
				ERROR_CODES.NOT_FOUND
			);
		}

		const existingAccount = allAdditionalAccounts.find(
			account =>
				account.id !== account_id &&
				decryptData(account.bank_account) === accountData.bank_account &&
				decryptData(account.routing_number) === accountData.routing_number
		);

		if (existingAccount) {
			throw new BankingApiError(
				"This account is already added as an additional account",
				StatusCodes.BAD_REQUEST,
				ERROR_CODES.INVALID
			);
		}

		if (userInfo?.is_guest_owner && userInfo.issued_for && Object.keys(userInfo.issued_for).length > 0) {
			const changedFields = this.buildChangedFields(accountData, account);

			if (changedFields.length) {
				await this.setApplicationEditData(businessID, case_id, userInfo, changedFields);
			}
		}
		// Keep bank account records immutable and delete + re-add
		// Preserve deposit_account and is_selected flags if the account being updated has them
		const isDepositAccount = account.deposit_account === true;
		const isSelected = account.is_selected === true;

		const manualBanking = await ManualBanking.getInstance(businessID);
		await manualBanking.deleteAccount(account_id, case_id);
		await manualBanking.addAccount(accountData, (userInfo?.issued_for?.user_id ?? userInfo?.user_id) as UUID, case_id, {
			deposit_account: isDepositAccount,
			is_selected: isSelected
		});
	}

	async deleteAdditionalAccountInfo(
		{ businessID }: { businessID: UUID },
		{ case_id, account_id }: { account_id: UUID; case_id: UUID },
		{ authorization }: { authorization: string },
		userInfo: UserInfo
	) {
		await this.checkUserAccess(businessID, authorization, userInfo);

		const allAdditionalAccounts: IBanking.BankAccountRecord[] = BankAccount.unwrap(
			await this.findAllAdditionalAccounts(businessID, case_id)
		);

		const account = allAdditionalAccounts.find(account => account.id === account_id);
		if (!account) {
			throw new BankingApiError(
				"No additional account found with the given ID",
				StatusCodes.NOT_FOUND,
				ERROR_CODES.NOT_FOUND
			);
		}

		if (userInfo?.is_guest_owner && userInfo.issued_for && Object.keys(userInfo.issued_for).length > 0) {
			const changedFields = this.buildChangedFields(null, account);
			if (changedFields.length) {
				await this.setApplicationEditData(businessID, case_id, userInfo, changedFields);
			}
		}
		const manualBanking = await ManualBanking.getInstance(businessID);
		await manualBanking.deleteAccount(account_id, case_id);
	}

	async addBankStatement(params: { businessID: UUID }, body: AddBankStatementBody, userInfo: UserInfo) {
		try {
			const { businessID } = params;
			const { case_id: caseID, customer_id: customerID } = body;

			// If ocr file upload, prepare the data and store it in the database
			if (body?.validation_ocr_document_ids) {
				if (body.validation_ocr_document_ids.length) {
					const confirmOcrDocumentsQuery = `UPDATE integration_data.uploaded_ocr_documents SET is_confirmed = $1 WHERE business_id = $2 AND category_id = $3 AND id IN (${body?.validation_ocr_document_ids
						.map(id => `'${id}'`)
						.join(",")}) AND job_type = $4`;

					await sqlQuery({
						sql: confirmOcrDocumentsQuery,
						values: [true, businessID, INTEGRATION_CATEGORIES.BANKING, "validation"]
					});
				}

				let deleteOcrDocumentsBaseQuery = `DELETE FROM integration_data.uploaded_ocr_documents WHERE business_id = $1 AND category_id = $2 AND job_type = $3`;
				let values = [businessID, INTEGRATION_CATEGORIES.BANKING, "validation"];
				if (body.validation_ocr_document_ids.length) {
					deleteOcrDocumentsBaseQuery += ` AND id NOT IN (${body?.validation_ocr_document_ids.map(id => `'${id}'`).join(",")})`;
				}
				if (caseID) {
					deleteOcrDocumentsBaseQuery += ` AND case_id = $4`;
					values.push(caseID);
				}
				await sqlQuery({ sql: deleteOcrDocumentsBaseQuery, values });

				// Update connection and task status for manual banking
				// TODO: Update/Remove this after OCR implementation
				let manualBanking: ManualBanking | null = null;
				try {
					const manualBankingConnection = await getOrCreateConnection(businessID, INTEGRATION_ID.MANUAL_BANKING);
					manualBanking = platformFactory({ dbConnection: manualBankingConnection });
				} catch (ex) {
					manualBanking = await ManualBanking.initializeManualBankingConnection(businessID);
				} finally {
					try {
						if (manualBanking) {
							// mark connection as success
							await manualBanking.updateConnectionStatus(
								CONNECTION_STATUS.SUCCESS,
								JSON.stringify({ task: "fetch_assets_data" })
							);
							const manualBankingTask = await manualBanking.getLatestTask(
								businessID,
								INTEGRATION_ID.MANUAL_BANKING,
								"fetch_assets_data",
								false,
								undefined,
								caseID ?? null
							);
							if (!manualBankingTask) {
								throw new Error(`No existing task found for fetch_assets_data for the business ${businessID}`);
							}
							await ManualBanking.updateManualBankingTaskMetadata(manualBankingTask.id, {
								ocr_document_ids: body.validation_ocr_document_ids
							});
							await manualBanking.processTask({ taskId: manualBankingTask.id });
						}
					} catch (err) {
						logger.error(
							`Error uploading bank statements for business ${businessID}. Error: ${(err as Error).message}`
						);
					}
				}
				logger.info(`STATEMENTS UPLOADED: Bank statements uploaded for business ${businessID}.`);
				return;
			}
		} catch (error) {
			throw error;
		}
	}

	async deleteBankStatement(params: { businessID: UUID; documentID: UUID }, userInfo: UserInfo) {
		try {
			const { businessID, documentID } = params;
			const getOcrDocumentsBaseQuery = `SELECT * FROM integration_data.uploaded_ocr_documents WHERE business_id = $1 AND category_id = $2 AND job_type = $3 AND id = $4`;
			const getOcrDocumentsBaseQueryResult = await sqlQuery({
				sql: getOcrDocumentsBaseQuery,
				values: [businessID, INTEGRATION_CATEGORIES.BANKING, "validation", documentID]
			});
			if (getOcrDocumentsBaseQueryResult?.rows?.length) {
				const deleteOcrDocumentsBaseQuery = `DELETE FROM integration_data.uploaded_ocr_documents WHERE business_id = $1 AND category_id = $2 AND job_type = $3 AND id = $4`;
				await sqlQuery({
					sql: deleteOcrDocumentsBaseQuery,
					values: [businessID, INTEGRATION_CATEGORIES.BANKING, "validation", documentID]
				});
			} else {
				throw new BankingApiError("Record doesn't exits", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
			}
			return;
		} catch (error) {
			throw error;
		}
	}

	async getBankStatements(params: { businessID: UUID }, body: { case_id: UUID }, userInfo: UserInfo) {
		try {
			const { businessID } = params;
			const { case_id: caseID } = body;

			let getOCRBankStatementsQuery = `SELECT id, file_name, file_path, extracted_data FROM integration_data.uploaded_ocr_documents WHERE business_id = $1 AND job_type = $2 AND category_id = $3 AND is_confirmed = $4`;
			let values = [businessID, "validation", INTEGRATION_CATEGORIES.BANKING, true];
			if (caseID) {
				getOCRBankStatementsQuery += ` AND case_id = $5`;
				values.push(caseID);
			}
			const getOCRBankStatementsResult: SqlQueryResult = await sqlQuery({ sql: getOCRBankStatementsQuery, values });

			return getOCRBankStatementsResult.rows;
		} catch (error) {
			throw error;
		}
	}

	async getUploadedBankStatements(params: { businessID: UUID }, body: { case_id: UUID }) {
		try {
			const { businessID } = params;
			const { case_id: caseID } = body;

			let getOCRBankStatementsQuery = `SELECT id, file_name FROM integration_data.uploaded_ocr_documents WHERE business_id = $1 AND job_type = $2 AND category_id = $3 AND is_confirmed = $4`;
			let values = [businessID, "validation", INTEGRATION_CATEGORIES.BANKING, true];
			if (caseID) {
				getOCRBankStatementsQuery += ` AND case_id = $5`;
				values.push(caseID);
			}
			const getOCRBankStatementsResult: SqlQueryResult = await sqlQuery({ sql: getOCRBankStatementsQuery, values });

			if (!getOCRBankStatementsResult?.rows.length) {
				return [];
			}
			const uploadedStatements: IUploadedStatement[] = [];
			const directory = DIRECTORIES.BUSINESS_BANK_STATEMENT_UPLOADS.replace(":businessID", businessID);
			const statementPromises = getOCRBankStatementsResult?.rows?.map(async statement => {
				try {
					const path = `${directory}/${statement.file_name}`;
					const fileUrl = (await getCachedSignedUrl(`${statement.file_name}`, directory))?.signedRequest;
					return {
						id: statement.id,
						file_name: statement.file_name,
						file_path: directory,
						file_url: fileUrl
					};
				} catch (error) {
					logger.error({ error }, `Failed to fetch or sign file: ${statement.file_name}`);
					return null;
				}
			});
			const resolvedStatements = await Promise.all(statementPromises);
			uploadedStatements.push(...resolvedStatements.filter(s => s !== null));
			return uploadedStatements;
		} catch (error) {
			throw error;
		}
	}
}

export const banking = new Banking();
