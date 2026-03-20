import { getBusinessApplicants, logger, sqlQuery, sqlTransaction } from "#helpers/index";
import { StatusCodes } from "http-status-codes";
import { CoreApiError } from "./error";
import {
	CONNECTION_STATUS,
	ERROR_CODES,
	IDV_STATUS,
	INTEGRATION_ENABLE_STATUS,
	INTEGRATION_ID,
	INTEGRATION_TASK,
	TASK_STATUS
} from "#constants";
import { AccountingRest } from "../accounting/accountingRest";
import { BusinessEntityVerificationService } from "../verification/businessEntityVerification";
import { BankAccount } from "../banking/models";
import BankAccountVerification from "../banking/models/bankAccountVerification";
import { customerIntegrationSettings } from "../customer-integration-settings/customer-integration-settings";
import { getBankingDetails } from "./getBankingDetails";

class Core {
	async internalGetConnectedIntegrations({ businessID, caseID }) {
		const REQUIRED_CATEGORIES = ["banking"];
		const INTEGRATIONS_TO_SKIP = [
			INTEGRATION_ID.GIACT,
			INTEGRATION_ID.MANUAL_BANKING,
			INTEGRATION_ID.MANUAL_ACCOUNTING
		];
		const LOADING_TASK_STATUSES = [TASK_STATUS.STARTED, TASK_STATUS.IN_PROGRESS];

		try {
			const response = {
				scoring_required_integrations_connected: false
			};

			// check if integration with given businessID exists or not
			const getIntegrationDetailsQuery = `SELECT data_connections.id as connection_id, connection_status, data_connections.platform_id, core_integrations_platforms.code , core_integrations_platforms.label as platform_label, configuration, core_categories.label as category_label,core_categories.code as category, data_connections.configuration
			FROM integrations.data_connections
			LEFT JOIN integrations.core_integrations_platforms ON integrations.core_integrations_platforms.id = integrations.data_connections.platform_id
			LEFT JOIN integrations.core_categories ON integrations.core_categories.id = integrations.core_integrations_platforms.category_id
			WHERE data_connections.business_id = $1`;

			// get owners details - only return most recent verification per owner (applicant_id)
			const getIdentityVerificationDetailsQuery = `SELECT DISTINCT ON (integration_data.identity_verification.applicant_id)
				integration_data.identity_verification.*, data_connections.id as connection_id, connection_status, data_connections.platform_id, 
				core_integrations_platforms.code , core_integrations_platforms.label as platform_label, configuration, core_categories.label as category_label,core_categories.code as category
				FROM integration_data.identity_verification
				LEFT JOIN integrations.data_business_integrations_tasks ON integrations.data_business_integrations_tasks.id = integration_data.identity_verification.business_integration_task_id
				LEFT JOIN integrations.data_connections ON integrations.data_connections.id = integrations.data_business_integrations_tasks.connection_id
				LEFT JOIN integrations.core_integrations_platforms ON integrations.core_integrations_platforms.id = integrations.data_connections.platform_id
				LEFT JOIN integrations.core_categories ON integrations.core_categories.id = integrations.core_integrations_platforms.category_id
				WHERE integration_data.identity_verification.business_id = $1
				ORDER BY integration_data.identity_verification.applicant_id, integration_data.identity_verification.created_at DESC`;

			const queries = [getIntegrationDetailsQuery, getIdentityVerificationDetailsQuery];
			const values = [[businessID], [businessID]];

			const getManualTaxFilingQuery = `SELECT dbit.metadata, json_build_object('tax_filings', tf) as tax_filing_json FROM integrations.data_business_integrations_tasks dbit
			LEFT JOIN integration_data.tax_filings tf ON tf.business_integration_task_id = dbit.id
			INNER JOIN integrations.data_connections ON integrations.data_connections.id = dbit.connection_id
			INNER JOIN integrations.rel_tasks_integrations rti ON rti.id = dbit.integration_task_id
			INNER JOIN integrations.core_tasks ct ON ct.id = rti.task_category_id
			INNER JOIN integrations.core_integrations_platforms cip ON cip.id = rti.platform_id
			WHERE integrations.data_connections.business_id = $1
			AND dbit.task_status = $2
			AND ct.id = $3
			AND cip.id = $4`;

			queries.push(getManualTaxFilingQuery);
			values.push([businessID, TASK_STATUS.SUCCESS, INTEGRATION_TASK.manual_tax_filing, INTEGRATION_ID.MANUAL]);

			const [sqlResults, bankingDetails] = await Promise.all([
				sqlTransaction(queries, values),
				getBankingDetails({ businessID, caseID })
			]);

			const [getIntegrationDetailsQueryResult, getIdentityVerificationDetails, getManualTaxFilingResult] = sqlResults;

			if (!getIntegrationDetailsQueryResult.rowCount) {
				// this means integration does not exists
				return {
					data: response,
					message: "No integration data found."
				};
			}

			getIntegrationDetailsQueryResult.rows.forEach(row => {
				// if there is not entry for category in response object then create an key and assign initial values
				if (!Object.hasOwn(response, row.category)) {
					response[row.category] = {
						is_connected: false,
						is_connecting: false,
						category_label: row.category_label,
						connections: []
					};
				}

				let isConnecting = false;
				const isPlaid = row.platform_id === INTEGRATION_ID.PLAID;
				if (isPlaid) {
					if (row.connection_status === CONNECTION_STATUS.SUCCESS) {
						isConnecting = false;
					} else {
						const plaidTaskStatus = bankingDetails?.plaidTask?.task_status;
						if (plaidTaskStatus && LOADING_TASK_STATUSES.includes(plaidTaskStatus)) {
							isConnecting = true;
						}
					}
				}
				if (!INTEGRATIONS_TO_SKIP.includes(row.platform_id)) {
					response[row.category] = response[row.category] || {
						category_label: row.category_label,
						connections: []
					};

					const connection = {
						id: row.connection_id,
						is_connected: row.connection_status === "SUCCESS",
						is_connecting: isConnecting,
						connection_status: row.connection_status,
						platform_id: row.platform_id,
						platform: row.code,
						configuration: row.configuration,
						platform_label: row.platform_label
					};
					if (connection.is_connected) {
						response[row.category].is_connected = true;
					}
					if (row.category === "banking") {
						connection.institutions = bankingDetails.institutions;
						connection.task =
							bankingDetails.tasks.find(task => task.task_status === TASK_STATUS.SUCCESS) || bankingDetails.tasks?.[0];
					}

					response[row.category].connections.push(connection);
				}

				if (row.connection_status === "SUCCESS" && REQUIRED_CATEGORIES.includes(row.category)) {
					response.scoring_required_integrations_connected = true;
				}
				if (row.category === "taxation" && (getManualTaxFilingResult.rowCount || row.code === "electronic_signature")) {
					if (!response.taxation.is_connected) {
						response.taxation.is_connected =
							row.code === "electronic_signature"
								? row.connection_status === CONNECTION_STATUS.SUCCESS
								: getManualTaxFilingResult.rowCount > 0;
					}
					response.taxation.electronic_signature =
						row.connection_status === CONNECTION_STATUS.SUCCESS ? { timestamp: row.configuration.timestamp } : {};
					response.taxation.manual_tax_filing = {};
					response.taxation.manual_tax_filing.upload_details = getManualTaxFilingResult.rows[0]?.metadata;
					response.taxation.manual_tax_filing.data = getManualTaxFilingResult.rows[0]?.tax_filing_json;
				}
			});

			// Clean up banking connection state based upon what was found in the api response
			if (response.banking) {
				response.banking.is_connected =
					response.banking.connections
						?.filter(con => !INTEGRATIONS_TO_SKIP.includes(con.platform_id))
						.some(connection => connection.is_connected) ?? false;
				response.banking.is_connecting =
					response.banking.connections
						?.filter(con => !INTEGRATIONS_TO_SKIP.includes(con.platform_id))
						.some(connection => connection.is_connecting) ?? false;
			}
			response.owner_verification = {
				owners: [],
				connections: [],
				is_connected: false,
				platform: "plaid_idv"
			};

			getIdentityVerificationDetails.rows.forEach(row => {
				response.owner_verification.owners.push({
					owner_id: row.applicant_id,
					business_id: row.business_id,
					status: Object.keys(IDV_STATUS).find(val => IDV_STATUS[val] === row.status)
				});
				response.owner_verification.is_connected = row.connection_status === CONNECTION_STATUS.SUCCESS;
				response.owner_verification = {
					...response.owner_verification,
					connections: [
						{
							id: row.connection_id,
							is_connected: row.connection_status === CONNECTION_STATUS.SUCCESS,
							connection_status: row.connection_status,
							platform_id: row.platform_id,
							platform: row.code,
							configuration: row.configuration,
							platform_label: row.platform_label
						}
					]
				};
			});

			return {
				data: response,
				message: "Integrations data fetch successfully."
			};
		} catch (error) {
			throw error;
		}
	}

	async getConnectedIntegrations({ businessID }, userInfo, { authorization }) {
		try {
			const records = await getBusinessApplicants(businessID, authorization);
			const applicants = records.map(applicant => applicant.id);

			if (!applicants.includes(userInfo.user_id)) {
				throw new CoreApiError("Applicant is not related to business", StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
			}

			// Gets all connected integrations when provided with Business ID
			const { data: response } = await this.internalGetConnectedIntegrations({ businessID });
			const scoringRequiredIntegrationsConnected = response.scoring_required_integrations_connected;
			delete response.scoring_required_integrations_connected;

			// Default values for integrations.
			// We are currently returning all integrations, we might not want to show all integrations to users such as MID DESK and Other integrations that connect internally.
			const integrations = [
				{
					category_label: "Banking",
					is_connected: false,
					is_connecting: false, // in process of connecting -- if false then we don't need to show a loading state
					connections: []
				},
				{
					category_label: "Accounting",
					is_connected: false,
					connections: []
				},
				{
					category_label: "Taxation",
					is_connected: false,
					connections: []
				},
				{
					// updated the category_label from "Public Record" to "Public Records"
					category_label: "Public Records",
					is_connected: response?.public_records?.is_connected || false,
					connections: response?.public_records?.connections || []
				}
			];
			// TODO: Remove if default response is not needed.

			// If there are no integrations connected then return the default value
			if (!scoringRequiredIntegrationsConnected) {
				return { integrations, scoring_required_integrations_connected: scoringRequiredIntegrationsConnected };
			}
			// This is sending empty public records object if banking and accounting are not connected. We need google business reviews from public data.

			// TODO : Pull in stripe connection

			// Preparing dataset to be queried in integration task db. Only the connections that have successful connections are being fetched
			const connectionIDs = [];
			const categoryConnectionMapping = {};
			Object.keys(response).forEach(category => {
				if (Object.hasOwn(response[category], "is_connected") && response[category].is_connected) {
					response[category].connections.forEach(connection => {
						connectionIDs.push(connection.id);
						if (!Object.hasOwn(categoryConnectionMapping, category)) {
							categoryConnectionMapping[category] = { connections: [connection.id] };
						} else {
							categoryConnectionMapping[category].connections.push(connection.id);
						}
					});
				}
			});

			// This query would fetch the latest integration task for each connection id provided to it
			const getIntegrationDetailsQuery = `WITH LatestRows AS ( SELECT *, ROW_NUMBER() OVER (PARTITION BY connection_id ORDER BY updated_at DESC) AS row_num
				FROM integrations.data_business_integrations_tasks
				WHERE connection_id IN (${connectionIDs.map(connectionID => `'${connectionID}'`).join(",")})
			)
			SELECT * FROM LatestRows WHERE row_num = 1`;
			const integrationDetails = await sqlQuery({ sql: getIntegrationDetailsQuery });

			// Adding last_synced_at to response object for each connection on the basis of the integration task updated_at value
			for (const row of integrationDetails.rows) {
				for (const [category, connectionMapping] of Object.entries(categoryConnectionMapping)) {
					if (connectionMapping.connections.includes(row.connection_id)) {
						for (const connection of response[category].connections) {
							if (connection.id === row.connection_id) {
								connection.last_synced_at = row.updated_at;
								connection.task_status = row.task_status;
								// If the integration task is either FAILED,ERRORED or Not Started then the connection needs to be fixed
								if (
									![TASK_STATUS.CREATED, TASK_STATUS.STARTED, TASK_STATUS.IN_PROGRESS, TASK_STATUS.SUCCESS].includes(
										row.task_status
									)
								) {
									connection.needs_attention = true;
									if (category === "banking" && row.task_status === TASK_STATUS.INITIALIZED) {
										connection.needs_attention = false;
									}
								}
								break;
							}
						}
					}
				}
			}

			// Fetch bank name / intitution name if banking is connected
			if (response.banking.is_connected) {
				const bankingConectionIDs = [];

				response.banking.connections.forEach(connection => {
					if (connection.connection_status === "SUCCESS") {
						bankingConectionIDs.push(connection.id);
					}
				});

				const getBankDetailsQuery = `SELECT bank_name, institution_name, official_name, integrations.data_business_integrations_tasks.connection_id , integrations.data_business_integrations_tasks.id as integration_task_id FROM integration_data.bank_accounts
				LEFT JOIN integrations.data_business_integrations_tasks ON integrations.data_business_integrations_tasks.id = integration_data.bank_accounts.business_integration_task_id
				WHERE integrations.data_business_integrations_tasks.connection_id IN (${bankingConectionIDs.map(connectionID => `'${connectionID}'`).join(",")})
				ORDER BY integrations.data_business_integrations_tasks.created_at DESC`;
				const bankingDetails = await sqlQuery({ sql: getBankDetailsQuery });

				const bankToConnectionMapping = {};

				bankingDetails.rows.forEach(row => {
					// if bankToConnectionMapping doesn't have connection inserted then insert the new connection entry
					if (!Object.hasOwn(bankToConnectionMapping, row.connection_id)) {
						bankToConnectionMapping[row.connection_id] = {
							[row.integration_task_id]: {
								institution_name: row.institution_name,
								accounts: [
									{
										name: row.bank_name,
										official_name: row.official_name
									}
								]
							}
						};
						// if bankToConnectionMapping have connection inserted but for the same connection its a new institution / integration then insert that integration into the sanme connection mapping
						// for example: For plaid coonection id 1 I have 2 banks linked : Chase and TD then it would look like {connection_id_1 : {chase : {...chase_Details}, TD: {...td_details}}}
					} else if (!Object.hasOwn(bankToConnectionMapping[row.connection_id], row.integration_task_id)) {
						bankToConnectionMapping[row.connection_id][row.integration_task_id] = {
							institution_name: row.institution_name,
							accounts: [
								{
									name: row.bank_name,
									official_name: row.official_name
								}
							]
						};
						// if bankToConnectionMapping have connection inserted and for the same integration there is an entry for new bank acc
						// for example: For plaid coonection id 1 I have 1 bank linked : Chase . And for chase i have 2 bank accounts then it should pish into the accounts array and look something like :
						// {connection_id_1 : {chase : {accounts: [{name: Savings, official_name: savings}, {name: Checkings, official_name: Checkings}]}}
					} else {
						bankToConnectionMapping[row.connection_id][row.integration_task_id].accounts.push({
							name: row.bank_name,
							official_name: row.official_name
						});
					}
				});

				// Push all banks and instiutions to the final response
				response.banking.connections.forEach(connection => {
					if (connection.is_connected && bankToConnectionMapping[connection.id]) {
						connection.institutions = Object.keys(bankToConnectionMapping).length
							? Object.keys(bankToConnectionMapping[connection.id]).map(
									integrationTaskID => bankToConnectionMapping[connection.id][integrationTaskID]
								)
							: [];
					}
				});
			}

			// Remove all the connections that are not in the eligible status to prevent cluttering on UI
			// TODO: Remove the bottom peice of code when UI changes are done to render all the integrations a user can connect
			const connectedAccountingConnections = [];
			if (response.accounting?.is_connected) {
				response.accounting.connections.forEach(connection => {
					if (["STARTED", "IN_PROGRESS", "SUCCESS"].includes(connection.connection_status)) {
						connectedAccountingConnections.push(connection);
					}
				});
			}
			if (connectedAccountingConnections) {
				response.accounting = response.accounting || {};
				response.accounting.connections = connectedAccountingConnections;
			}
			["identity_verification", "commerce", "bureau", "business_entity_verification", "owner_verification"].forEach(
				category => {
					delete response[category];
				}
			);
			// checking the connection status for taxation connections and updating the irs_status, is_consent_given accordingly
			response.taxation?.connections.forEach(connection => {
				switch (connection.connection_status) {
					case "CREATED":
						connection.irs_status = "NOT_STARTED";
						connection.is_consent_given = false;
						break;
					case "INITIALIZED":
						connection.irs_status = "PENDING";
						connection.is_consent_given = false;
						break;
					case "SUCCESS":
						connection.irs_status = "COMPLETED";
						connection.is_consent_given = true;
						break;
					case "FAILED":
						connection.irs_status = "REJECTED";
						connection.is_consent_given = true;
						break;
					// These statuses would never exist for tax consent
					// tax consent life cycle goes from CREATED-> INITIALIZED ->  SUCCESS || FAILED -> FAILED
					// case "STARTED":
					// case "IN_PROGRESS":
					default:
						break;
				}
			});
			// Cleaning of response
			Object.keys(response).forEach(category => {
				if (Object.hasOwn(response[category], "connections")) {
					response[category].connections.forEach((connection, index) => {
						// Note: We should not pass configuration to the client side. It contains sensitive information.
						delete connection.configuration;

						const notNeedConnectionPlatforms = ["google_places_reviews"];
						if (notNeedConnectionPlatforms.includes(connection.platform)) {
							delete response[category].connections[index];
						}
					});
				}
			});

			return {
				integrations: Object.values(response),
				scoring_required_integrations_connected: scoringRequiredIntegrationsConnected
			};
		} catch (error) {
			throw error;
		}
	}

	// TODO: PROD EXECUTION NEEDED API
	/**
	 * @description This function is used to update the connection status to success for the given platform.
	 * This is a temporary API which can be used to mark the connection status to SUCCESS of few platforms which don't need any access from users side
	 * like verdata need keys which are independent of user's intervention
	 * @param {string} body.platform_id : integration platform id
	 * @param {Array} body.prev_statusses: previous statusses from which we can transist to SUCCESS
	 */
	async updateConnectionStatusToSuccess(body) {
		try {
			const { platform_id: platformID } = body;
			const allowedPlatformIDs = [
				INTEGRATION_ID.EQUIFAX,
				INTEGRATION_ID.VERDATA,
				INTEGRATION_ID.PLAID_IDV,
				INTEGRATION_ID.MIDDESK,
				INTEGRATION_ID.BASELAYER
			];
			if (!allowedPlatformIDs.includes(platformID)) {
				throw new CoreApiError(
					"Not allowed to update the connection status for this platform",
					StatusCodes.BAD_REQUEST,
					ERROR_CODES.NOT_ALLOWED
				);
			}

			if (!body.prev_statusses || (body && body.prev_statusses && body.prev_statusses.length === 0)) {
				body.prev_statusses = [CONNECTION_STATUS.CREATED];
			}

			const updateStatusWithHistoryQuery = `WITH updated AS (
						UPDATE integrations.data_connections 
						SET connection_status = $1
						WHERE platform_id = $2 AND connection_status IN (${body.prev_statusses.map(status => `'${status}'`).join(",")})
						RETURNING id
				)
				INSERT INTO integrations.data_connections_history (connection_id, log, connection_status)
				SELECT id, 'MANUALLY_UPDATED', 'SUCCESS'
				FROM updated`;
			await sqlQuery({ sql: updateStatusWithHistoryQuery, values: [CONNECTION_STATUS.SUCCESS, platformID] });
		} catch (error) {
			throw error;
		}
	}

	/**
	 * @description This function is used to fetch business metadata such as age and revenue
	 * @param {*} body
	 * @param {Array<string>} body.business_ids : Array of business ids
	 * @returns {Object} Object with key as businessID and value as object of age & revenue
	 */
	async businessMetadata(body) {
		try {
			const { business_ids: businessIDs } = body;
			const revenueMap = new Map();
			const ageMap = new Map();

			await Promise.allSettled(
				businessIDs.map(async businessID => {
					try {
						const revenue = await AccountingRest.revenueFallback(businessID);
						revenueMap.set(businessID, revenue);
					} catch (err) {
						logger.error(`Error fetching revenue for business ID ${businessID}:`, err);
						revenueMap.set(businessID, null);
					}

					try {
						const { business_age: age, formation_date: formationDate } =
							await BusinessEntityVerificationService._getBusinessAge(businessID);
						ageMap.set(businessID, { age, formation_date: formationDate });
					} catch (err) {
						logger.error(`Error fetching age for business ID ${businessID}:`, err);
						ageMap.set(businessID, { age: null, formation_date: null });
					}
				})
			);

			const response = businessIDs.reduce((acc, businessID) => {
				acc[businessID] = {
					revenue: revenueMap.get(businessID),
					age: ageMap.get(businessID)?.age,
					formation_date: ageMap.get(businessID)?.formation_date
				};

				return acc;
			}, {});

			return response;
		} catch (error) {
			throw error;
		}
	}

	async getCaseVerifications({ businessID, caseID, customerID }) {
		try {
			if (!businessID || !caseID || !customerID) {
				throw new CoreApiError("Invalid request", StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
			}

			const [identityResults, bankAccounts, customerSettings] = await Promise.all([
				sqlQuery({
					sql: `SELECT integration_data.identity_verification.applicant_id, integration_data.identity_verification.business_id, integration_data.identity_verification.status FROM integration_data.identity_verification WHERE integration_data.identity_verification.business_id = $1`,
					values: [businessID]
				}),
				BankAccount.findByBusinessId(businessID),
				customerIntegrationSettings.findById(customerID)
			]);

			const verificationOfOwners = identityResults.rows.map(row => ({
				owner_id: row.applicant_id,
				status: Object.keys(IDV_STATUS).find(val => IDV_STATUS[val] === row.status) ?? "UNKNOWN"
			}));

			const giactServiceFlags = [];
			if (customerSettings?.settings?.gverify?.status === INTEGRATION_ENABLE_STATUS.ACTIVE) {
				giactServiceFlags.push("verify");
			}
			if (customerSettings?.settings?.gauthenticate?.status === INTEGRATION_ENABLE_STATUS.ACTIVE) {
				giactServiceFlags.push("authenticate");
			}

			const bankAccountsInfo = await Promise.all(
				(Array.isArray(bankAccounts) ? bankAccounts : [])
					.map(accountRecord => accountRecord.getRecord())
					.filter(accountRecord => accountRecord.deposit_account)
					.map(async accountRecord => {
						const bankAccountVerification = await BankAccountVerification.findByBankAccountId(accountRecord.id);
						return {
							...accountRecord,
							verification_result: bankAccountVerification?.record || null
						};
					})
			);

			return {
				verification_of_owners: verificationOfOwners,
				banking: {
					is_giact_verified: giactServiceFlags.length > 0,
					giact_service_flags: giactServiceFlags,
					bank_accounts_info: bankAccountsInfo
				}
			};
		} catch (error) {
			logger.error(`Error in getCaseVerifications: ${error.message}`, error);
			throw error;
		}
	}

	async getIntegrationsMetadata({ businessID }) {
		const integrationStatusQuery = `WITH latest_requests AS (
    SELECT
        rr.connection_id,
        rr.platform_id,
        rr.request_type,
        rr.requested_at,
        ROW_NUMBER() OVER (PARTITION BY rr.platform_id, rr.request_type ORDER BY rr.requested_at DESC) AS rn
    FROM integration_data.request_response rr
    JOIN integrations.data_connections dc ON rr.connection_id = dc.id
    WHERE dc.business_id = $1
	)
	SELECT
	    cip.id AS platform_id,
	    cip.label,
	    dc.connection_status,
	    COALESCE(json_agg(json_build_object('request_type', lr.request_type, 'requested_at', lr.requested_at) ORDER BY lr.request_type) 
	        FILTER (WHERE lr.rn = 1), '[]') AS requests
	FROM integrations.data_connections dc
	JOIN integrations.core_integrations_platforms cip ON dc.platform_id = cip.id
	LEFT JOIN latest_requests lr ON lr.connection_id = dc.id AND lr.rn = 1
	WHERE dc.business_id = $1
	GROUP BY cip.id, cip.label, dc.connection_status
	ORDER BY cip.id`;

		const integrationStatusData = [businessID];

		const data = await sqlQuery({ sql: integrationStatusQuery, values: integrationStatusData });

		return data.rows;
	}

	async rerunIntegrations(params, body) {
		const { rerunIntegrations: handler } = await import("./handlers/rerunIntegrations/rerunIntegrations");
		return await handler(params, body);
	}

	async synchronousStateUpdate(request) {
		logger.info({ request }, "Synchronous state update requested");
		const { processOnUpdateHandlers } = await import("./handlers/stateUpdate/index");
		const response = await processOnUpdateHandlers(request, "synchronous");
		logger.info({ response }, "Synchronous state update processed");
		return response;
	}
}

export const core = new Core();
