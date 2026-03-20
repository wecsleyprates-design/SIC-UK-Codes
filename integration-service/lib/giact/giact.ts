import {
	EVENTS,
	FEATURE_FLAGS,
	GiactVerificationType,
	INTEGRATION_ENABLE_STATUS,
	INTEGRATION_ID,
	kafkaEvents,
	kafkaTopics,
	TASK_STATUS,
	type EventEnum
} from "#constants";
import {
	createStrategyLogger,
	db,
	getBusinessDetails,
	getFlagValue,
	getOrCreateConnection,
	internalGetCaseByID,
	logger,
	producer,
	updateConnectionByConnectionId
} from "#helpers/index";
import type {
	IBusinessIntegrationTaskEnriched,
	ICoreGiactResponseCodes,
	IDBConnection,
	IRelBankingVerfication,
	IRequestResponse
} from "#types/db";
import { TaskManager } from "#api/v1/modules/tasks/taskManager";
import type { BusinessEntity, GIACTResponse, GIACTTask, IGiactStrategy, PersonEntity, ServiceRequest } from "./types";
import axios, { AxiosError } from "axios";
import { customerIntegrationSettings } from "#api/v1/modules/customer-integration-settings/customer-integration-settings";
import { decryptData, verifyAndFormatNationalNumber } from "#utils";
import { UUID } from "crypto";
import { BankAccount } from "#api/v1/modules/banking/models";
import type IBanking from "#api/v1/modules/banking/types";
import { IntegrationMode } from "#api/v1/modules/customer-integration-settings/types";
import { GiactStrategyFactory } from "./strategies/GiactStrategyFactory";
import { GiactProductionStrategy } from "./strategies/GiactProductionStrategy";
import { envConfig } from "#configs";

export class GIACT extends TaskManager {
	public static BULK_NAMED_JOB: EventEnum = EVENTS.FETCH_GIACT_VERIFICATION;
	private strategy: IGiactStrategy | undefined;
	private strategyMode: IntegrationMode | undefined;
	private strategyLogger: any;
	protected static readonly PLATFORM_ID = INTEGRATION_ID.GIACT;

	taskHandlerMap = {
		fetch_giact_verification: async (taskId: UUID) => {
			const task = await GIACT.getEnrichedTask(taskId);

			if (!task.case_id) {
				throw new Error(`Case ID is required for GIACT verification task ${taskId}`);
			}

			const result = await this.fetch_giact_verification(task, task.business_id, task.case_id);

			return result;
		}
	};

	constructor(dbConnection?: IDBConnection, strategyMode?: IntegrationMode, customerID?: UUID) {
		super(dbConnection);

		if (strategyMode) {
			this.strategyMode = strategyMode;
			this.strategy = GiactStrategyFactory.createStrategy(strategyMode);

			this.strategyLogger = createStrategyLogger("GIACT", this.strategyMode);
			this.strategyLogger.info(
				`GIACT strategy initialized ${JSON.stringify({ customerID, strategyMode: this.strategyMode, strategyAvailable: this.strategy.isAvailable() })}`
			);
		} else if (dbConnection?.configuration?.strategy_mode) {
			this.strategyMode = dbConnection.configuration.strategy_mode as IntegrationMode;
			this.strategy = GiactStrategyFactory.createStrategy(this.strategyMode);

			this.strategyLogger = createStrategyLogger("GIACT", this.strategyMode);
			this.strategyLogger.info(
				`GIACT strategy initialized from connection configuration ${JSON.stringify({ strategyMode: this.strategyMode, strategyAvailable: this.strategy.isAvailable() })}`
			);
		}
		// TODO: add else here when deprecated DOS_830_GIACT_STRATEGY_PATTERN feature flag is removed
	}

	public static async initializeGiactConnection(businessID: UUID, customerID?: UUID): Promise<GIACT> {
		const useStrategy = await getFlagValue(FEATURE_FLAGS.DOS_830_GIACT_STRATEGY_PATTERN);
		logger.info(`GIACT feature flag check: useStrategy=${useStrategy}, businessID=${businessID}`);
		if (useStrategy) {
			logger.info(`Using initializeGiactConnectionWithStrategy for business: ${businessID}`);
			return this.initializeGiactConnectionWithStrategy(businessID, customerID);
		} else {
			// TODO: Remove this else condition when deprecated DOS_830_GIACT_STRATEGY_PATTERN feature flag is removed
			logger.info(`Using initializeGiactConnectionWithoutStrategy for business: ${businessID}`);
			return this.initializeGiactConnectionWithoutStrategy(businessID);
		}
	}

	public static async initializeGiactConnectionWithStrategy(businessID: UUID, customerID?: UUID): Promise<GIACT> {
		let strategyMode: IntegrationMode = "PRODUCTION";
		if (customerID) {
			const settings = await customerIntegrationSettings.findById(customerID);

			strategyMode = (settings?.settings?.gverify?.mode || "PRODUCTION") as IntegrationMode;
		}

		const dbConnection = await getOrCreateConnection(businessID, INTEGRATION_ID.GIACT, {
			connection_status: "SUCCESS",
			configuration: {
				strategy_mode: strategyMode,
				customer_id: customerID
			}
		});

		if (dbConnection && !dbConnection.configuration?.strategy_mode) {
			logger.info(`Updating old GIACT connection with strategy_mode: ${strategyMode} for business: ${businessID}`);
			await updateConnectionByConnectionId(dbConnection.id, "SUCCESS", {
				strategy_mode: strategyMode,
				customer_id: customerID
			});

			dbConnection.configuration = {
				...dbConnection.configuration,
				strategy_mode: strategyMode,
				customer_id: customerID
			};
		}

		const platform = new GIACT(dbConnection, strategyMode, customerID);

		platform.dbConnection = {
			...dbConnection,
			configuration: {
				strategy_mode: strategyMode,
				customer_id: customerID
			}
		};

		return platform;
	}

	// TODO: Remove this method when deprecated DOS_830_GIACT_STRATEGY_PATTERN feature flag is removed
	public static async initializeGiactConnectionWithoutStrategy(businessID: UUID): Promise<GIACT> {
		const dbConnection = await getOrCreateConnection(businessID, INTEGRATION_ID.GIACT, {
			connection_status: "SUCCESS",
			configuration: null
		});
		return new GIACT(dbConnection);
	}

	/**
	 * Processes GIACT bank account verification tasks
	 * Handles both invite cases (with customer settings) and standalone cases
	 *
	 * @param task - The enriched business integration task
	 * @param businessID - The business identifier
	 * @param caseID - The case identifier
	 * @returns Promise resolving to true if verification was successful
	 */
	public async fetch_giact_verification(
		task: IBusinessIntegrationTaskEnriched<GIACTTask>,
		businessID: UUID,
		caseID: UUID
	): Promise<boolean> {
		const connection = this.getDBConnection();
		if (!connection) {
			logger.error(`No database connection available ${JSON.stringify({ taskId: task.id })}`);
			return false;
		}
		try {
			const caseDetail = await internalGetCaseByID(caseID);
			const customerID = caseDetail?.customer_id;
			let giactServiceFlags: string[] = [];
			let performGiactVerification = true;
			let phoneNumber: number | string | undefined;
			if (customerID) {
				const customerSettings = await customerIntegrationSettings.findById(customerID);
				if (customerSettings?.settings?.gverify?.status == INTEGRATION_ENABLE_STATUS.ACTIVE) {
					giactServiceFlags = ["verify"];
				}
				if (customerSettings?.settings?.gauthenticate?.status == INTEGRATION_ENABLE_STATUS.ACTIVE) {
					giactServiceFlags = ["verify", "authenticate"];
				}
				if (giactServiceFlags.length === 0) {
					performGiactVerification = false;
				}
			} else {
				giactServiceFlags = ["verify", "authenticate"];
				performGiactVerification = false;
			}
			if (!performGiactVerification) {
				this.strategyLogger.info(
					`GIACT verification skipped ${JSON.stringify({ taskId: task.id, customerID, reason: "No active GIACT services configured" })}`
				);
				return true;
			}

			let accountsToVerify: IBanking.BankAccountRecord[] = [];
			try {
				accountsToVerify = await this.getAccountsToVerify({ task });
				if (!accountsToVerify || accountsToVerify.length === 0) {
					this.strategyLogger.info(`No accounts to verify ${JSON.stringify({ taskId: task.id, businessID, caseID })}`);
					// FIXME: If any error make it true
					return false;
				}
				this.strategyLogger.info(
					`Accounts identified for verification ${JSON.stringify({ taskId: task.id, accountCount: accountsToVerify.length, businessID })}`
				);
			} catch (ex) {
				this.strategyLogger.error(
					`Failed to retrieve accounts for verification ${JSON.stringify({ taskId: task.id, businessID, error: ex instanceof Error ? ex.message : String(ex) })}`
				);
				return false;
			}

			const businessDetail = await getBusinessDetails(businessID, undefined, 2);
			if (businessDetail.status === "fail") {
				this.strategyLogger.error(`Business details not found ${JSON.stringify({ taskId: task.id, businessID })}`);
				throw new Error("Business Details not found.");
			}
			const controlOwner = businessDetail?.data?.owners?.find((owner: any) => owner.owner_type === "CONTROL");

			this.strategyLogger.info(
				`Business details retrieved ${JSON.stringify({ taskId: task.id, businessID, hasControlOwner: !!controlOwner })}`
			);

			const onlyGVerify = giactServiceFlags.length === 1 && giactServiceFlags.includes("verify");
			const omitPhoneAndAddressFlag: boolean = await getFlagValue(
				FEATURE_FLAGS.PAT_518_OMIT_PHONE_AND_ADDRESS_FROM_GIACT,
				{ key: "customer", kind: "customer", customer_id: customerID }
			);

			let anyFailure = false;
			let savedAny = false;

			this.strategyLogger.info(
				`Starting bank account verification process ${JSON.stringify({ taskId: task.id, accountCount: accountsToVerify.length, strategy: this.strategy?.getMode(), serviceFlags: giactServiceFlags })}`
			);

			for (const bankAccount of accountsToVerify || []) {
				try {
					this.strategyLogger.debug(
						`Processing bank account verification ${JSON.stringify({ taskId: task.id, bankAccountId: bankAccount.id, accountNumber: bankAccount.bank_account?.slice(-4), routingNumber: bankAccount.routing_number })}`
					);

					const fullResponse = await this.verifyBankAccount(
						bankAccount,
						giactServiceFlags,
						businessDetail,
						controlOwner,
						omitPhoneAndAddressFlag
					);
					const giactResponse = fullResponse.response;
					const requestData = fullResponse.requestData;

					const reqRes: IRequestResponse = {
						business_id: businessID,
						platform_id: task.platform_id,
						response: giactResponse,
						external_id: giactResponse?.ItemReferenceID.toString(),
						request_type: "fetch_giact_verification",
						connection_id: task.connection_id,
						status: 1,
						request_received: new Date(giactResponse?.CreatedDate || Date.now())
					};
					await this.saveRequestResponse(task, reqRes);

					const gVerifyResponseCode = await GIACT.getWorthGiactResponseCode(
						"gVerify",
						giactResponse?.AccountVerificationResult?.ResponseCode || 0
					);
					const gAuthenticateResponseCode = onlyGVerify
						? null
						: await GIACT.getWorthGiactResponseCode(
								"gAuthenticate",
								giactResponse?.AccountAuthenticationResult?.ResponseCode || 0
							);
					const egg: IRelBankingVerfication = {
						bank_account_id: bankAccount.id as UUID,
						case_id: caseID,
						giact_verify_response_code_id: gVerifyResponseCode.length ? gVerifyResponseCode[0].id : null,
						giact_authenticate_response_code_id:
							gAuthenticateResponseCode && gAuthenticateResponseCode.length ? gAuthenticateResponseCode[0].id : null,
						verification_status: "SUCCESS",
						meta: { requestData, giactResponse }
					};
					const saved = await this.saveGiactResponse(egg, task.id);
					savedAny = savedAny || Boolean(saved?.id);

					if (giactResponse?.VerificationResult !== 6) {
						const message = { case_id: caseID, reason: "Bank account verification failed." };
						if (![12, 13, 14, 15].includes(gVerifyResponseCode?.[0]?.response_code)) {
							message.reason = gVerifyResponseCode[0]?.description || "Unknown";
						} else if (!onlyGVerify && gAuthenticateResponseCode?.[0]?.response_code !== 2) {
							message.reason = gAuthenticateResponseCode?.[0]?.description || "Unknown";
						}

						this.strategyLogger.warn(
							`Bank account verification failed ${JSON.stringify({ taskId: task.id, bankAccountId: bankAccount.id, verificationResult: giactResponse?.VerificationResult, gVerifyCode: gVerifyResponseCode?.[0]?.response_code, gAuthenticateCode: gAuthenticateResponseCode?.[0]?.response_code })}`
						);

						if (message.case_id) {
							await producer.send({
								topic: kafkaTopics.CASES,
								messages: [{ 
									key: message.case_id, 
									value: { 
										event: kafkaEvents.BANK_ACCOUNT_VERIFICATION_FAILED,
										...message 
									}
								}]
							});
						}
					}
				} catch (ex: unknown) {
					anyFailure = true;
					let message = ex instanceof Error ? ex.message : `${ex}`;
					if (ex instanceof AxiosError) {
						message = ex.response?.data?.error_message || ex.message;
					}
					this.strategyLogger.error(
						`Bank account verification failed ${JSON.stringify({ taskId: task.id, bankAccountId: bankAccount.id, error: message, strategy: this.strategy?.getMode() })}`
					);
					await this.saveGiactResponse({
						bank_account_id: bankAccount.id as UUID,
						case_id: caseID,
						giact_verify_response_code_id: null,
						giact_authenticate_response_code_id: null,
						verification_status: "ERRORED",
						meta: { error: message }
					});
				}
			}
			if (anyFailure) {
				this.strategyLogger.warn(
					`Partial or complete failure during GIACT verification ${JSON.stringify({ taskId: task.id, businessID, caseID, strategy: this.strategy?.getMode() })}`
				);
				return false;
			}

			this.strategyLogger.info(
				`GIACT verification process completed ${JSON.stringify({ taskId: task.id, businessID, caseID, accountsProcessed: accountsToVerify.length, resultsSaved: savedAny, strategy: this.strategy?.getMode() })}`
			);

			return savedAny;
		} catch (error: any) {
			this.strategyLogger.error(
				`GIACT verification process failed ${JSON.stringify({ taskId: task.id, businessID, caseID, error: error?.message || "Unknown error", strategy: this.strategy?.getMode() })}`
			);
			return false;
		}
	}

	async saveGiactResponse(
		giactVerificationStatus: IRelBankingVerfication,
		taskId?: UUID
	): Promise<IRelBankingVerfication> {
		const verification = await db<IRelBankingVerfication>("integration_data.rel_banking_verifications")
			.insert(giactVerificationStatus)
			.returning("*");
		return verification[0];
	}

	async saveRequestResponse(
		task: IBusinessIntegrationTaskEnriched,
		input: IRequestResponse,
		mergeOptions: any = null
	): Promise<IRequestResponse> {
		const insertedRecord = await db<IRequestResponse>("integration_data.request_response")
			.insert({
				business_id: task.business_id,
				platform_id: task.platform_id,
				external_id: input.external_id,
				request_type: input.request_type,
				request_code: task.task_code,
				connection_id: task.connection_id,
				response: JSON.stringify(input.response),
				request_received: input.request_received
			})
			.onConflict("request_id")
			.merge(mergeOptions)
			.returning("*");
		return insertedRecord[0];
	}

	public async processTask({
		taskId,
		businessID,
		caseID
	}: {
		taskId: UUID;
		businessID: UUID;
		caseID: UUID;
	}): Promise<IBusinessIntegrationTaskEnriched> {
		const task = await TaskManager.getEnrichedTask(taskId);
		if (!task) {
			throw new Error(`Could not fetch task ${taskId}`);
		}

		const taskCode = task.task_code;
		const handler = this[taskCode];
		if (!handler || typeof handler !== "function") {
			this.updateTaskStatus(task.id, TASK_STATUS.FAILED, {
				error: `No task handler is defined for ${taskCode} for platform ${this.getPlatform()}`
			});
			throw new Error(`No handler for task`);
		}

		const claimed = await this.claimPendingTask(task.id);
		if (!claimed) {
			logger.debug(`Task already claimed by another process ${JSON.stringify({ taskId: task.id, taskCode })}`);
			return await TaskManager.getEnrichedTask(task.id as UUID);
		}
		try {
			const success: boolean = await handler.bind(this)(task, businessID, caseID);
			if (success) {
				await this.updateTaskStatus(task.id, TASK_STATUS.SUCCESS);
			} else {
				await this.updateTaskStatus(task.id, TASK_STATUS.ERRORED);
			}
		} catch (error: any) {
			logger.error({ error, taskId: task.id, taskCode }, "Task handler error");
			if (error instanceof AxiosError) {
				await this.updateTaskStatus(task.id, TASK_STATUS.FAILED, { error: error.response?.data });
			} else {
				await this.updateTaskStatus(task.id, TASK_STATUS.FAILED, { error: error.messages || "Unhandled error" });
			}
		} finally {
			const completedTask = await TaskManager.getEnrichedTask(task.id as UUID);
			await this.sendTaskCompleteMessage(completedTask);
			return completedTask;
		}
	}

	/**
	 * Atomically claims a pending task to prevent concurrent processing
	 * @param taskId - The task identifier to claim
	 * @returns Promise resolving to true if claim succeeded
	 */
	private async claimPendingTask(taskId: UUID): Promise<boolean> {
		const now = new Date().toISOString();
		const updated = await db("integrations.data_business_integrations_tasks")
			.where({ id: taskId })
			.whereIn("task_status", TaskManager.PENDING_TASK_STATUSES)
			.update({ task_status: TASK_STATUS.IN_PROGRESS, updated_at: now });
		return updated > 0;
	}

	static async getWorthGiactResponseCode(
		verification_type: GiactVerificationType,
		response_code: number
	): Promise<ICoreGiactResponseCodes[]> {
		return await db<ICoreGiactResponseCodes>("integrations.core_giact_response_codes")
			.select("*")
			.where({ response_code: response_code, verification_type: verification_type });
	}

	public async getBankingVerifications(bankAccountIds: UUID[]): Promise<IRelBankingVerfication[]> {
		return db<IRelBankingVerfication>("integration_data.rel_banking_verifications").whereIn(
			"bank_account_id",
			bankAccountIds
		);
	}

	// TODO: Remove this method when deprecated DOS_830_GIACT_STRATEGY_PATTERN feature flag is removed
	/**
	 * Call the GIACT API
	 * @param requestData - The request data to send to the GIACT API
	 * @returns The response from the GIACT API
	 */
	private async callGiactAPI(requestData: ServiceRequest): Promise<GIACTResponse | null> {
		try {
			const { GIACT_API_USERNAME, GIACT_API_PASSWORD, GIACT_API_ENDPOINT } = envConfig;
			const authHeader = "Basic " + Buffer.from(`${GIACT_API_USERNAME}:${GIACT_API_PASSWORD}`).toString("base64");
			const response = await axios.post(
				`${GIACT_API_ENDPOINT}/verificationservices/web_api/inquiries_v5_9`,
				requestData,
				{
					maxBodyLength: Infinity,
					headers: { "Content-Type": "application/json", Authorization: authHeader }
				}
			);
			logger.debug({ giact_response: response.data }, "GIACT Response");
			return response.data;
		} catch (error: any) {
			logger.error({ error }, "Failed to call GIACT API");
			return null;
		}
	}

	public static async deleteAdditionalAccountsGiactVerificationData(caseId: UUID): Promise<void> {
		const additionalAccounts = await db("integration_data.rel_banking_verifications")
			.select("integration_data.rel_banking_verifications.*")
			.join(
				"integration_data.bank_accounts",
				"integration_data.rel_banking_verifications.bank_account_id",
				"integration_data.bank_accounts.id"
			)
			.where({ case_id: caseId, is_additional_account: true });

		if (additionalAccounts.length > 0) {
			const verificationIds = additionalAccounts.map(account => account.id);
			await db("integration_data.rel_banking_verifications").whereIn("id", verificationIds).delete();
			logger.info(`Deleted GIACT verification data for additional accounts in case ${caseId}`);
		}
	}

	/**
	 * Retrieves bank accounts eligible for GIACT verification
	 * Filters for deposit or additional accounts that haven't been verified
	 *
	 * @param taskId - Optional task identifier for scoped verification
	 * @param task - Optional enriched task for scoped verification
	 * @returns Promise resolving to array of bank account records
	 */
	async getAccountsToVerify({
		taskId,
		task
	}: {
		taskId?: UUID;
		task?: IBusinessIntegrationTaskEnriched<GIACTTask>;
	}): Promise<IBanking.BankAccountRecord[]> {
		if (!this.dbConnection || !this.dbConnection.business_id) {
			throw new Error("Business ID not found");
		}
		const businessID = this.dbConnection.business_id;

		const allAccountsForBusiness: IBanking.BankAccountRecord[] = BankAccount.unwrap(
			await BankAccount.findByBusinessId<BankAccount>(businessID)
		);

		if (taskId || task) {
			try {
				if (task && !taskId) {
					taskId = task.id;
				}
				if (!task && taskId) {
					task = await TaskManager.getEnrichedTask<GIACTTask>(taskId);
				}
				if (task?.metadata?.bank_account_ids) {
					const filteredAccounts = allAccountsForBusiness.filter(acct =>
						(task?.metadata?.bank_account_ids as UUID[]).includes(acct.id as UUID)
					);
					if (filteredAccounts.length === task.metadata.bank_account_ids.length) {
						return filteredAccounts;
					}
					logger.warn(
						`Not all task-specified accounts found, using all business accounts ${JSON.stringify({ taskId: taskId, businessID, expectedCount: task?.metadata?.bank_account_ids?.length, foundCount: filteredAccounts.length })}`
					);
				}
			} catch (ex) {
				logger.error(
					`Failed to retrieve task metadata, using all business accounts ${JSON.stringify({ taskId, businessID, error: ex instanceof Error ? ex.message : String(ex) })}`
				);
			}
		}

		const depositOrAdditionalAccounts: IBanking.BankAccountRecord[] = allAccountsForBusiness.filter(acct =>
			this.isDepositOrAdditionalAccount(acct)
		);
		const accountVerifications = await this.getBankingVerifications(
			depositOrAdditionalAccounts.map(acct => acct.id as UUID)
		);

		return depositOrAdditionalAccounts.filter(
			account => !this.wasSubmitedForVerification(account, accountVerifications)
		);
	}

	/**
	 * Determines if a bank account is eligible for verification
	 * @param bankAccount - The bank account to evaluate
	 * @returns True if account is deposit or additional type
	 */
	private isDepositOrAdditionalAccount(bankAccount: IBanking.BankAccountRecord): boolean {
		return Boolean(bankAccount.deposit_account || bankAccount.is_additional_account);
	}

	/**
	 * Checks if a bank account has already been submitted for verification
	 * @param bankAccount - The bank account to check
	 * @param accountVerifications - Existing verification records
	 * @returns True if account was previously verified
	 */
	private wasSubmitedForVerification(
		bankAccount: IBanking.BankAccountRecord,
		accountVerifications: IRelBankingVerfication[]
	): boolean {
		return accountVerifications.some(
			verification =>
				verification.bank_account_id === bankAccount.id &&
				verification.meta.requestData.BankAccountEntity.AccountNumber === bankAccount.bank_account &&
				verification.meta.requestData.BankAccountEntity.RoutingNumber === bankAccount.routing_number
		);
	}

	private didPassGAuthenticate(giactResponse: GIACTResponse | null): boolean {
		return giactResponse?.AccountAuthenticationResult?.ResponseCode === 2;
	}

	private buildGiactRequest(bankAccount, giactServiceFlags, entityData): ServiceRequest {
		return {
			UniqueId: bankAccount.id as UUID,
			ServiceFlags: giactServiceFlags,
			BankAccountEntity: {
				RoutingNumber: decryptData(bankAccount.routing_number),
				AccountNumber: decryptData(bankAccount.bank_account),
				AccountType: this.determineAccountType(bankAccount.subtype)
			},
			...entityData
		};
	}

	private determineAccountType(subtype?: string): number {
		if (!subtype) return 2; // default to "other"
		const type = subtype.toLowerCase();
		return type === "checking" ? 0 : type === "savings" ? 1 : 2;
	}

	private async attemptVerification(
		bankAccount,
		giactServiceFlags,
		entityData,
		attemptName: string
	): Promise<{ giactResponse: GIACTResponse | null; passedGAuthenticate: boolean; requestData: ServiceRequest }> {
		const requestData = this.buildGiactRequest(bankAccount, giactServiceFlags, entityData);
		logger.debug(`Attempting GIACT verification with ${attemptName}`);
		try {
			const useStrategy = await getFlagValue(FEATURE_FLAGS.DOS_830_GIACT_STRATEGY_PATTERN);
			let giactResponse: GIACTResponse | null;
			if (useStrategy && this.strategy)
				if (giactServiceFlags.includes("authenticate")) {
					// Determine which method to call based on service flags
					giactResponse = await this.strategy.authenticateAccount(requestData);
				} else {
					giactResponse = await this.strategy.verifyAccount(requestData);
				}
			else {
				// TODO: Remove this else condition when deprecated DOS_830_GIACT_STRATEGY_PATTERN feature flag is removed
				giactResponse = await this.callGiactAPI(requestData);
			}
			const passedGAuthenticate = this.didPassGAuthenticate(giactResponse);
			return { giactResponse, passedGAuthenticate, requestData };
		} catch (error: any) {
			logger.error(
				{
					error: error?.message || "Unknown error",
					attemptName,
					strategy: this.strategy?.getMode() || "",
					bankAccountId: bankAccount.id
				},
				`GIACT verification attempt failed with ${attemptName}`
			);
			return { giactResponse: null, passedGAuthenticate: false, requestData };
		}
	}

	/* 
		This method is used to prepare the entities for gVerify and gAuthenticate verification
		Owner and business entity information should never be mixed during the verification process
	*/
	private prepareEntities(businessDetail, controlOwner, omitPhoneAndAddressFlag) {
		// Format phone numbers
		const ownerPhone = omitPhoneAndAddressFlag
			? ""
			: controlOwner?.mobile
				? `${verifyAndFormatNationalNumber(controlOwner?.mobile)}`
				: "";

		const businessPhone = omitPhoneAndAddressFlag
			? ""
			: businessDetail?.data?.mobile
				? `${verifyAndFormatNationalNumber(businessDetail?.data?.mobile)}`
				: "";

		// Build person entity
		const personEntity: PersonEntity = {
			FirstName: controlOwner?.first_name || "",
			LastName: controlOwner?.last_name || "",
			PhoneNumber: ownerPhone,
			TaxID: controlOwner?.ssn || "",
			DateOfBirth: controlOwner?.date_of_birth || ""
		};

		if (!omitPhoneAndAddressFlag) {
			personEntity.AddressEntity = {
				AddressLine1: controlOwner?.address_line_1 || "",
				City: controlOwner?.address_city || "",
				State: controlOwner?.address_state || "",
				ZipCode: controlOwner?.address_postal_code || "",
				Country: controlOwner?.address_country || ""
			};
		}

		// Build business entity
		const businessEntity: BusinessEntity = {
			BusinessName: businessDetail?.data?.name,
			PhoneNumber: businessPhone,
			FEIN: businessDetail?.data?.tin
		};

		if (!omitPhoneAndAddressFlag) {
			businessEntity.AddressEntity = {
				AddressLine1: businessDetail?.data?.address_line_1,
				AddressLine2: businessDetail?.data?.address_line_2,
				City: businessDetail?.data?.address_city,
				State: businessDetail?.data?.address_state,
				ZipCode: businessDetail?.data?.address_postal_code,
				Country: businessDetail?.data?.address_country
			};
		}

		return {
			businessEntity
		};
	}

	public async verifyBankAccount(
		bankAccount,
		giactServiceFlags,
		businessDetail,
		controlOwner,
		omitPhoneAndAddressFlag
	) {
		const entities = this.prepareEntities(businessDetail, controlOwner, omitPhoneAndAddressFlag);

		// When verifying a bank account, we should be verifying with only the business entity info and not the owner's info
		let result = await this.attemptVerification(
			bankAccount,
			giactServiceFlags,
			{ BusinessEntity: entities.businessEntity },
			"business entity"
		);

		return { response: result.giactResponse, requestData: result.requestData };
	}
}
