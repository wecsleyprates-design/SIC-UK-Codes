import { score } from "#api/v1/modules/score/score";
import { TaskManager, type TaskHandlerMap } from "#api/v1/modules/tasks/taskManager";
import { updateBusinessDetailS3, uploadRawIntegrationDataToS3, prepareIntegrationDataForScore } from "#common/index";
import {
	CONNECTION_STATUS,
	CORE_INTEGRATION_STATUS,
	DIRECTORIES,
	ERROR_CODES,
	INTEGRATION_CODES,
	FEATURE_FLAGS,
	INTEGRATION_ID,
	kafkaEvents,
	kafkaTopics,
	SCORE_TRIGGER,
	TASK_STATUS,
	type ScoreTrigger
} from "#constants";
import { getCase, getOnboardingCaseByBusinessId, sqlQuery, getBusinessFactsByKeys, getFlagValue } from "#helpers";
import { db } from "#helpers/knex";
import { logger } from "#helpers/logger";
import { getOrCreateConnection, platformFactory } from "#helpers/platformHelper";
import { GIACT } from "#lib/giact/giact";
import { NPI } from "#lib/npi/npi";
import { decryptData, encryptData } from "#utils";
import { randomUUID, type UUID } from "crypto";
import { v4 as uuidv4 } from "uuid";

import { validateInputAgainstSchema } from "#lib/facts/utils";
import { z } from "zod-v4";
import type {
	BusinessScoreTrigger,
	IBusinessIntegrationTaskEnriched,
	IDBConnection,
	IRequestResponse
} from "#types/db";
import type { Fact, FactName, FactOverride } from "#lib/facts/types";
import type { IntegrationDataUploadedEventType } from "#types/kafka";
import { ManualIntegrationError } from "./manualIntegrationError";
import { StatusCodes } from "http-status-codes";
import { customerIntegrationSettings } from "#api/v1/modules/customer-integration-settings/customer-integration-settings";
import { allFacts, FactEngineWithDefaultOverrides } from "#lib/facts";
import { factWithHighestConfidence } from "#lib/facts/rules";

import { getFactKeys } from "#lib/facts/utils";
import { BusinessScoreTriggerRepository } from "#core/scoreTrigger";

export class ManualIntegration extends TaskManager {
	private readonly PLATFORM_ID = INTEGRATION_ID["MANUAL"];

	constructor(dbConnection?: IDBConnection) {
		super(dbConnection);
	}

	taskHandlerMap: TaskHandlerMap = {
		manual: async (taskId: UUID) => {
			const task = await ManualIntegration.getEnrichedTask(taskId);
			const event = task.metadata as IntegrationDataUploadedEventType;

			if (!event?.data || !event?.trigger) {
				// Return true if nothing to process
				return true;
			}

			if (event.trigger.startsWith("factOverride") && event.trigger.includes(":")) {
				await this.processFactOverrideEvent(task);
			} else {
				await this.processPublicRecords(task);

				//the below function calls can throw errors. Swallow them and continue processing
				try {
					await this.processDepositAccountRecords(event);
					await this.processAccountingRecords(event);
				} catch (error) {
					logger.error(error, `businessId=${task.business_id} Error processing deposit account or accounting`);
				}

				await this.saveRawResponseToDB(event, task).catch(reject => {
					logger.error(
						`businessId=${task.business_id} Could not save raw response for manual integration handler: ${reject.message}`
					);
				});

				try {
					await this.processHealthcareProviderRecords(event);
				} catch (error) {
					logger.error(error, `businessId=${task.business_id} Error processing healthcare provider records`);
				}

				try {
					await this.processProcessingHistoryRecords(event);
				} catch (error) {
					logger.error(error, `businessId=${task.business_id} Error processing processing history records`);
				}
			}

			await uploadRawIntegrationDataToS3(
				event,
				event.business_id,
				event.trigger || "manual",
				DIRECTORIES.MANUAL,
				"manual"
			);
			if (event.customer_id) {
				const customerScopedFileName = `${event.customer_id}-${event.trigger || "manual"}`;
				await uploadRawIntegrationDataToS3(
					event,
					event.business_id,
					customerScopedFileName,
					DIRECTORIES.MANUAL,
					"manual"
				);
			}
			const message = {
				business_id: task.business_id,
				score_trigger_id: task.business_score_trigger_id,
				applicant_id: event.user_id,
				customer_id: event.customer_id,
				case_id: event.case_id,
				trigger_type: SCORE_TRIGGER.MANUAL_REFRESH as ScoreTrigger
			};

			if (event.case_id) {
				const caseRecord = await db("public.data_cases")
					.join(
						"integrations.business_score_triggers",
						"business_score_triggers.id",
						"=",
						"data_cases.score_trigger_id"
					)
					.select("data_cases.*", "business_score_triggers.trigger_type")
					.where({ "data_cases.id": event.case_id })
					.whereNotNull("score_trigger_id")
					.first();

				if (caseRecord) {
					message.score_trigger_id = caseRecord.score_trigger_id;
					message.applicant_id = caseRecord.applicant_id ?? message.applicant_id;
					// When creating a business, use the case's trigger type
					if (event?.trigger === "bulkCreateBusinessMapper") {
						message.trigger_type = caseRecord.trigger_type;
					}
				}
			}

			try {
				await updateBusinessDetailS3(message.business_id);
			} catch (error: any) {
				logger.error(
					`Unable to updateBusiness details s3, businessId: ${message.business_id}, errorMessage: ${error.message}`
				);
			}
			await prepareIntegrationDataForScore(taskId, message.trigger_type, event.id);
			return true;
		}
	};

	public static async getInstance(businessID: UUID) {
		const dbConnection = await getOrCreateConnection(businessID, INTEGRATION_ID.MANUAL);
		return new this(dbConnection);
	}

	static async processManualIntegration(event: IntegrationDataUploadedEventType) {
		let connection: IDBConnection | undefined;
		try {
			const businessId = event.business_id as UUID;
			connection = await getOrCreateConnection(businessId, INTEGRATION_ID.MANUAL, {
				connection_status: CONNECTION_STATUS.SUCCESS
			});
			if (!connection) {
				throw new Error("Manual connection not found for businessId: " + businessId);
			}
		} catch (error) {
			//If we can't get the connection it must not exist
			logger.error({ error }, `Manual connection not found for businessId=${event.business_id}`);
			return;
		}
		const manualIntegration = new ManualIntegration(connection);

		let scoreTrigger: UUID | undefined = undefined;
		if (event.trigger === "bulkCreateBusinessMapper") {
			const caseDetail = await db("public.data_cases").select("score_trigger_id").where({ id: event.case_id }).first();
			scoreTrigger = caseDetail?.score_trigger_id;
		} else {
			try {
				const scoreVersion = await score.generateNewVersion(
					event.business_id,
					event.customer_id,
					SCORE_TRIGGER.MANUAL_REFRESH,
					event.case_id
				);
				scoreTrigger = scoreVersion.id;
			} catch (error) {
				// normal flow may throw and it's not a problem, just won't send a trigger id
				scoreTrigger = undefined;
			}
		}

		const taskId = await manualIntegration.getOrCreateTaskForCode({
			taskCode: "manual",
			reference_id: event.customer_id,
			scoreTriggerId: scoreTrigger,
			conditions: scoreTrigger ? [{ column: "business_score_trigger_id", operator: "=", value: scoreTrigger }] : []
		});
		manualIntegration.updateTask(taskId, { metadata: event, reference_id: event.customer_id });
		await manualIntegration.processTask({ taskId });
	}

	/**
	 * Handle a "factOverride" data upload event
	 * @param task
	 * @returns IRequestResponse row upserted into the request_response table
	 */
	private processFactOverrideEvent = async (task: IBusinessIntegrationTaskEnriched): Promise<IRequestResponse> => {
		const event = task.metadata as IntegrationDataUploadedEventType<
			Partial<Record<FactName, Pick<FactOverride, "value" | "comment">>>
		>;
		const providedOverrides = structuredClone(event.data);
		const currentFactOverrides = await this.getCurrentFactOverrides(event.business_id);
		const method = event.trigger.split(":")[1] as "DELETE" | "PATCH" | "PUT";
		const newFactOverrides = ManualIntegration.computeNextFactOverrideState(
			method,
			providedOverrides,
			currentFactOverrides,
			{ userID: event.user_id, timestamp: event.created_at }
		);
		event.data = newFactOverrides;
		return this.saveRawResponseToDB(event, task, "fact_override");
	};

	/**
	 * Shared merge logic for fact overrides (DELETE / PATCH / PUT).
	 * Used by both updateFactOverride and processFactOverrideEvent.
	 */
	private static computeNextFactOverrideState(
		method: "DELETE" | "PATCH" | "PUT",
		providedOverrides: Partial<Record<FactName, Pick<FactOverride, "value" | "comment">>>,
		currentFactOverrides: Partial<Record<FactName, FactOverride>> | undefined,
		meta: { userID: UUID; timestamp: Date }
	): Partial<Record<FactName, FactOverride>> {
		const current = currentFactOverrides ?? {};
		if (method === "DELETE") {
			return Object.entries(current).reduce(
				(acc, [key, value]) => {
					if (!providedOverrides[key as FactName]) acc[key as FactName] = value;
					return acc;
				},
				{} as Partial<Record<FactName, FactOverride>>
			);
		}
		if (method === "PATCH" || method === "PUT") {
			const initial = method === "PATCH" ? { ...current } : ({} as Partial<Record<FactName, FactOverride>>);
			return Object.entries(providedOverrides).reduce(
				(acc, [factName, override]) => {
					acc[factName as FactName] = {
						comment: override?.comment ?? null,
						value: override?.value ?? null,
						source: "manual",
						userID: meta.userID,
						timestamp: meta.timestamp
					};
					return acc;
				},
				initial
			);
		}
		return {};
	}

	/**
	 * Helper to check if a value is valid (not null, undefined, or zero)
	 */
	private isValidAccountingValue(value: any): boolean {
		if (value === null || value === undefined) return false;
		const numValue = typeof value === "string" ? parseFloat(value) : value;
		return typeof numValue === "number" && !isNaN(numValue) && numValue !== 0;
	}

	/**
	 * Write accounting-related data to S3
	 * Skip uploading if none of the key accounting values are non-zero (all are zero or not provided)
	 * @param event
	 */
	private async processAccountingRecords(event: IntegrationDataUploadedEventType) {
		const now = new Date().toISOString();

		// Check if balance sheet has any valid (non-zero) values
		const hasBalanceSheetData =
			this.isValidAccountingValue(event.data.bs_totalequity) ||
			this.isValidAccountingValue(event.data.bs_totalliabilities);

		if (hasBalanceSheetData) {
			await uploadRawIntegrationDataToS3(
				[
					{
						assets: {},
						created_at: now,
						currency_code: "USD",
						end_date: now,
						start_date: now,
						id: uuidv4(),
						liabilities: {},
						equity: {},
						total_assets: event.data.bs_totalequity || 0,
						total_liabilities: event.data.bs_totalliabilities || 0,
						total_equity: event.data.bs_totalequity || 0,
						platform_data: {}
					}
				],
				event.business_id,
				"balancesheet",
				DIRECTORIES.ACCOUNTING,
				"rutter"
			);
		}

		// Check if income statement has any valid (non-zero) values
		const hasIncomeStatementData =
			this.isValidAccountingValue(event.data.is_revenue) ||
			this.isValidAccountingValue(event.data.is_netincome) ||
			this.isValidAccountingValue(event.data.is_grossprofit) ||
			this.isValidAccountingValue(event.data.is_operatingexpenses) ||
			this.isValidAccountingValue(event.data.is_costofgoodssold);

		if (hasIncomeStatementData) {
			await uploadRawIntegrationDataToS3(
				[
					{
						id: uuidv4(),
						accounting_standard: "unknown",
						created_at: now,
						updated_at: now,
						start_date: now,
						end_date: now,
						currency_code: "USD",
						income: {},
						other_income: {},
						expenses: {},
						other_expenses: {},
						cost_of_sales: {},
						net_operating_income: event.data.is_netincome ?? 0,
						gross_profit: event.data.is_grossprofit ?? 0,
						net_income: event.data.is_netincome ?? 0,
						total_income: event.data.is_revenue ?? 0,
						total_expenses: event.data.is_operatingexpenses ?? 0,
						total_cost_of_sales: event.data.is_costofgoodssold ?? 0,
						total_other_expenses: "0",
						total_other_income: "0",
						platform_data: {}
					}
				],
				event.business_id,
				"incomestatement",
				DIRECTORIES.ACCOUNTING,
				"rutter"
			);
		}

		await uploadRawIntegrationDataToS3({}, event.business_id, "business_info", DIRECTORIES.ACCOUNTING, "rutter");
	}

	/**
	 *
	 * @param task
	 */
	processPublicRecords = async (task: IBusinessIntegrationTaskEnriched) => {
		const event = task.metadata;
		if (event?.data) {
			// See if judgements, verifications, liens in scope

			const publicRecordData = Object.entries(event.data).reduce((acc, [key, value]) => {
				if (value == undefined || value == null) {
					return acc;
				}
				switch (key) {
					case "business_bankruptcies":
						acc["number_of_bankruptcies"] = value;
						break;
					case "business_bankruptcies_file_date":
						acc["most_recent_bankruptcy_filing_date"] = value;
						break;
					case "business_liens":
						acc["number_of_business_liens"] = value;
						break;
					case "business_liens_file_date":
						acc["most_recent_business_lien_filing_date"] = value;
						break;
					case "business_liens_status":
						acc["most_recent_business_lien_status"] = value;
						break;
					case "business_judgements":
						acc["number_of_judgement_fillings"] = value;
						break;
					case "business_judgements_file_date":
						acc["most_recent_judgement_filling_date"] = value;
						break;
					case "review_cnt":
						acc["google_review_count"] = value;
						acc["google_review_percentage"] = 1;
						break;
					case "review_score":
						acc["average_rating"] = value;
						break;
					default:
						break;
				}
				return acc;
			}, {});
			if (publicRecordData) {
				// Update or insert public_records table entry for this task
				const currentPublicRecord = await db("integration_data.public_records")
					.select("*")
					.where({ business_integration_task_id: task.id })
					.first();
				if (currentPublicRecord) {
					// Update the public_records entry
					await db("integration_data.public_records")
						.update(publicRecordData)
						.where({ business_integration_task_id: task.id })
						.returning("*");
				} else {
					await db("integration_data.public_records")
						.insert({ ...publicRecordData, business_integration_task_id: task.id })
						.returning("*");
				}
			}
		}
	};

	/**
	 * Processes deposit account records by checking existing bank accounts, updating them if needed, or inserting a new record.
	 * Also triggers a manual GIACT verification process.
	 *
	 * @param {IntegrationDataUploadedEventType} event - Event containing bank account details and business integration info.
	 * @throws Will throw an error if database operations or GIACT verification fails.
	 */
	processDepositAccountRecords = async (event: IntegrationDataUploadedEventType) => {
		try {
			// Fetch latest business integration tasks for GIACT and PLAID
			const businessIntegrationGiactTask = await TaskManager.getLatestTaskForBusiness(
				event.business_id,
				INTEGRATION_ID.GIACT,
				"fetch_giact_verification",
				false
			);
			const businessIntegrationAssetTask = await TaskManager.getLatestTaskForBusiness(
				event.business_id,
				INTEGRATION_ID.PLAID,
				"fetch_assets_data",
				false
			);

			const businessIntegrationGiactTaskId = businessIntegrationGiactTask?.id;
			const businessIntegrationAssetTaskId = businessIntegrationAssetTask?.id;

			if (!businessIntegrationGiactTaskId || !businessIntegrationAssetTaskId) {
				logger.warn(`No integration task found for business ID ${event.business_id}. Skipping processing.`);
				return; // Early return if required data is missing
			}

			if (
				!event?.data?.bank_account_number ||
				!event?.data?.bank_routing_number ||
				!event?.data?.bank_account_subtype
			) {
				logger.warn(`Account information incomplete. Skipping processing.`);
				return; // Early return if required data is missing
			}

			// Fetch existing accounts matching the given bank details
			const existingAccounts = await db("integration_data.bank_accounts")
				.where({ business_integration_task_id: businessIntegrationAssetTaskId })
				.andWhere({ bank_name: event?.data?.bank_name || null })
				.andWhere({ type: event?.data?.bank_account_type })
				.andWhere({ subtype: event?.data?.bank_account_subtype || null })
				.select("*");

		// Check if an account with the same account number exists
		const matchedAccount = existingAccounts.find(
			row => decryptData(row.bank_account) === event?.data?.bank_account_number
		);

		// Determine if this is a new account based on the match result
		const newAccountCreated = !matchedAccount;
		let newAccountID: string | null = null;
		let giactTaskIdToUse = businessIntegrationGiactTaskId;

		if (matchedAccount) {
			if (event?.data?.deposit_account) {
				// If the account is marked as a deposit account, first deselect any previously selected deposit accounts
				await db("integration_data.bank_accounts")
					.where({ business_integration_task_id: businessIntegrationAssetTaskId, deposit_account: true })
					.update({ is_selected: false });

			// Then, update the matched account to set it as the selected deposit account
			await db("integration_data.bank_accounts")
				.where({ id: matchedAccount.id })
				.update({ is_selected: event?.data?.deposit_account });
			logger.info({ businessID: event.business_id }, "Updated bank account selection status");
			}
		} else {
			// NEW ACCOUNT - will need verification
			const accountID = uuidv4();
			newAccountID = accountID;

			// Deselect previous deposit accounts
				await db("integration_data.bank_accounts")
					.where({ business_integration_task_id: businessIntegrationAssetTaskId, deposit_account: true })
					.update({ is_selected: false });

				let processorOrchestrationEnabled = false;
				if (event?.customer_id) {
					const integrationStatus = await customerIntegrationSettings.getIntegrationStatusForCustomer(
						event.customer_id
					);
					processorOrchestrationEnabled =
						integrationStatus.find((item: any) => item.integration_code === INTEGRATION_CODES.PROCESSOR_ORCHESTRATION)
							?.status === CORE_INTEGRATION_STATUS.ENABLED;
				}

				// Insert new bank account record
				const [inserted] = await db("integration_data.bank_accounts")
					.insert({
						id: accountID,
						business_integration_task_id: businessIntegrationAssetTaskId,
						bank_account: encryptData(event?.data?.bank_account_number),
						bank_name: event?.data?.bank_name || null,
						official_name: event?.data?.bank_official_name || null,
						institution_name: event?.data?.institution_name || event?.data?.bank_name || "ACH",
						verification_status: "UNVERIFIED",
						balance_current: event?.data?.bank_account_balance_current || null,
						balance_available: event?.data?.bank_account_balance_available || null,
						balance_limit: event?.data?.bank_account_balance_limit || null,
						currency: event?.data?.currency ?? (processorOrchestrationEnabled ? "USD" : null),
						mask: event?.data?.bank_account_number?.slice(-4),
						type: event?.data?.bank_account_type ?? (processorOrchestrationEnabled ? "depository" : null),
						subtype: event?.data?.bank_account_subtype ?? event?.data?.bank_account_type ?? null,
						routing_number: encryptData(event?.data?.bank_routing_number),
						account_holder_name: event?.data?.bank_account_holder_name ?? null,
						account_holder_type: event?.data?.bank_account_holder_type ?? null,
						wire_routing_number: event?.data?.bank_wire_routing_number
							? encryptData(event.data.bank_wire_routing_number)
							: event?.data?.bank_routing_number
								? encryptData(event.data.bank_routing_number)
								: null,
						deposit_account: true,
						is_selected: event?.data?.deposit_account ?? false
					})
				.returning("*")
				.onConflict("id")
				.merge();

		logger.info({ accountID, mask: inserted?.mask }, "Added new bank account record");

			// Create a NEW GIACT task for this verification
			const giactConnection = await getOrCreateConnection(event.business_id, INTEGRATION_ID.GIACT);

			// Use the same integration_task_id as the existing GIACT task to ensure consistency
				const newGiactTask = await TaskManager.createTask({
					connection_id: giactConnection.id,
					integration_task_id: businessIntegrationGiactTask.integration_task_id,
					business_score_trigger_id: businessIntegrationGiactTask.business_score_trigger_id,
					task_status: TASK_STATUS.CREATED,
				metadata: {
					bank_account_ids: [accountID],
					trigger_source: "manual_bank_update",
					previous_task_id: businessIntegrationGiactTaskId
				}
			});

			// Use the NEW task ID for verification
				giactTaskIdToUse = newGiactTask.id;
			}

		// Only run GIACT verification if a new account was created
		if (newAccountCreated && giactTaskIdToUse) {
			let giact: GIACT | null = null;
				const actions: Record<string, any> = {};

			try {
				// Use proper GIACT initialization method that handles feature flags and strategy mode
				giact = await GIACT.initializeGiactConnection(event.business_id, event.customer_id);
			} catch (ex) {
				// Fallback to initializing a new GIACT connection
					logger.warn(`Failed to initialize GIACT connection, initializing a new one.`);
					giact = await GIACT.initializeGiactConnection(event.business_id, event.customer_id);
				}

				if (giact) {
					try {
				// Mark connection as successful
				await giact.updateConnectionStatus(
					CONNECTION_STATUS.SUCCESS,
					JSON.stringify({ task: "fetch_giact_verification" })
				);

			// Process GIACT verification task with the new task ID
			actions["giact"] = await giact.processTask({
				taskId: giactTaskIdToUse,
				businessID: event.business_id,
				caseID: event.case_id
			});

			logger.info(
				{ businessID: event.business_id, taskStatus: actions["giact"]?.task_status },
				"GIACT verification completed"
			);
		} catch (err) {
			logger.error({ businessID: event.business_id, error: (err as Error).message }, "Error processing GIACT verification");
			actions["giact"] = { error: (err as Error).message };
		}
	} else {
		logger.error({ businessID: event.business_id?.substring(0, 36) }, "GIACT instance is null");
		}
	}
		} catch (error) {
			// Log error before rethrowing for better debugging
			logger.error(error, `Unexpected error in processDepositAccountRecords: ${(error as Error).message}`);
			throw error;
		}
	};

	processHealthcareProviderRecords = async (event: IntegrationDataUploadedEventType) => {
		logger.debug(`Starting processHealthcareProvierRecords for business ${event.business_id}`);
		try {
			if (event?.data?.npi_provider_number || event?.data?.npi_first_name || event?.data?.npi_last_name) {
				const connection = await getOrCreateConnection(event.business_id, INTEGRATION_ID.NPI);
				const npi: NPI = platformFactory({ dbConnection: connection, platformId: INTEGRATION_ID.NPI });
				const taskId = await npi.createTaskForCode({
					taskCode: "fetch_healthcare_provider_verification",
					reference_id: event.data?.npi_provider_number,
					metadata: {
						npiId: event.data?.npi_provider_number,
						providerFirstName: event.data.npi_first_name,
						providerLastName: event.data?.npi_last_name,
						caseId: event?.case_id
					}
				});
				logger.debug(`Created NPI task with taskId: ${taskId}`);
				await npi.processTask({ taskId });
				logger.debug(`Completed NPI task with taskId: ${taskId}`);
			} else {
				logger.debug(`No NPI number found for business ${event.business_id}`);
				return;
			}
		} catch (error) {
			const message = `Error processing healthcare provider records for business ${event.business_id}: ${(error as Error).message}`;
			logger.error(error, message);
			throw new Error(message);
		}
	};

	processProcessingHistoryRecords = async (event: IntegrationDataUploadedEventType) => {
		logger.debug(`Starting processProcessingHistoryRecords for business ${event.business_id}`);
		try {
			if (event?.data) {
				const eventData = event?.data || {};
				const relevantKeys = new Set([
					"general_monthly_volume",
					"general_annual_volume",
					"general_average_ticket_size",
					"general_high_ticket_size",
					"general_desired_limit",
					"monthly_occurrence_of_high_ticket",
					"explanation_of_high_ticket",
					"visa_mastercard_discover_monthly_volume",
					"visa_mastercard_discover_annual_volume",
					"visa_mastercard_discover_average_ticket_size",
					"visa_mastercard_discover_high_ticket_size",
					"visa_mastercard_discover_desired_limit",
					"american_express_monthly_volume",
					"american_express_annual_volume",
					"american_express_average_ticket_size",
					"american_express_high_ticket_size",
					"american_express_desired_limit",
					"is_seasonal_business",
					"high_volume_months",
					"explanation_of_high_volume_months",
					"swiped_cards",
					"typed_cards",
					"e_commerce",
					"mail_telephone"
				]);
				const hasRelevantKey = Object.keys(eventData).some(key => relevantKeys.has(key));
				if (hasRelevantKey) {
					const payload = {
						case_id: event.case_id,
						general_data: {
							...(eventData.general_monthly_volume != null && { monthly_volume: eventData.general_monthly_volume }),
							...(eventData.general_annual_volume != null && { annual_volume: eventData.general_annual_volume }),
							...(eventData.general_average_ticket_size != null && {
								average_ticket_size: eventData.general_average_ticket_size
							}),
							...(eventData.general_high_ticket_size != null && {
								high_ticket_size: eventData.general_high_ticket_size
							}),
							...(eventData.general_desired_limit != null && { desired_limit: eventData.general_desired_limit }),
							...(eventData.monthly_occurrence_of_high_ticket != null && {
								monthly_occurrence_of_high_ticket: eventData.monthly_occurrence_of_high_ticket
							}),
							...(eventData.explanation_of_high_ticket != null && {
								explanation_of_high_ticket: eventData.explanation_of_high_ticket
							})
						},
						seasonal_data: {
							...((eventData.is_seasonal_business === true || eventData.is_seasonal_business === false) && {
								is_seasonal_business: eventData.is_seasonal_business
							}),
							...(eventData.high_volume_months != null && { high_volume_months: eventData.high_volume_months }),
							...(eventData.explanation_of_high_volume_months != null && {
								explanation_of_high_volume_months: eventData.explanation_of_high_volume_months
							})
						},

						visa_mastercard_discover: {
							...(eventData.visa_mastercard_discover_monthly_volume != null && {
								monthly_volume: eventData.visa_mastercard_discover_monthly_volume
							}),
							...(eventData.visa_mastercard_discover_annual_volume != null && {
								annual_volume: eventData.visa_mastercard_discover_annual_volume
							}),
							...(eventData.visa_mastercard_discover_average_ticket_size != null && {
								average_ticket_size: eventData.visa_mastercard_discover_average_ticket_size
							}),
							...(eventData.visa_mastercard_discover_high_ticket_size != null && {
								high_ticket_size: eventData.visa_mastercard_discover_high_ticket_size
							}),
							...(eventData.visa_mastercard_discover_desired_limit != null && {
								desired_limit: eventData.visa_mastercard_discover_desired_limit
							})
						},
						american_express: {
							...(eventData.american_express_monthly_volume != null && {
								monthly_volume: eventData.american_express_monthly_volume
							}),
							...(eventData.american_express_annual_volume != null && {
								annual_volume: eventData.american_express_annual_volume
							}),
							...(eventData.american_express_average_ticket_size != null && {
								average_ticket_size: eventData.american_express_average_ticket_size
							}),
							...(eventData.american_express_high_ticket_size != null && {
								high_ticket_size: eventData.american_express_high_ticket_size
							}),
							...(eventData.american_express_desired_limit != null && {
								desired_limit: eventData.american_express_desired_limit
							})
						},
						point_of_sale_volume: {
							...(eventData.swiped_cards != null && { swiped_cards: eventData.swiped_cards }),
							...(eventData.typed_cards != null && { typed_cards: eventData.typed_cards }),
							...(eventData.e_commerce != null && { e_commerce: eventData.e_commerce }),
							...(eventData.mail_telephone != null && { mail_telephone: eventData.mail_telephone })
						}
					};
					const processingHistoryId = randomUUID();
					const addProcessingHistoryQuery = `INSERT INTO integration_data.data_processing_history (id, case_id, ocr_document_id, american_express_data, card_data, point_of_sale_data, general_data, seasonal_data, created_by, updated_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) ON CONFLICT (case_id) DO UPDATE SET ocr_document_id = EXCLUDED.ocr_document_id, american_express_data = EXCLUDED.american_express_data, card_data = EXCLUDED.card_data, point_of_sale_data = EXCLUDED.point_of_sale_data, general_data = EXCLUDED.general_data, seasonal_data = EXCLUDED.seasonal_data, updated_by = EXCLUDED.updated_by`;
					const addProcessingHistoryValues = [
						processingHistoryId,
						payload.case_id,
						null,
						payload.american_express,
						payload.visa_mastercard_discover,
						payload.point_of_sale_volume,
						payload.general_data,
						payload.seasonal_data,
						event.user_id,
						event.user_id
					];
					await sqlQuery({ sql: addProcessingHistoryQuery, values: addProcessingHistoryValues });
				}
			}
		} catch (error) {
			const message = `Error processing processing history records for business ${event.business_id}: ${(error as Error).message}`;
			logger.error(error, message);
			throw new Error(message);
		}
	};

	public async deleteFactOverride(contextParams: {
		factName?: string;
		userID: UUID;
		customerID?: UUID;
		caseID?: UUID;
	}): Promise<Array<FactName>> {
		const businessID = this.getDBConnection()?.business_id;
		if (!businessID) {
			throw new Error("Business ID is required");
		}
		const toDelete: Partial<Record<FactName, Pick<FactOverride, "value" | "comment">>> = {};
		const current = (await this.getCurrentFactOverrides(businessID)) ?? {};
		if (contextParams.factName) {
			// Just deleting the one provided fact override
			if (current[contextParams.factName]) {
				toDelete[contextParams.factName] = { value: null, comment: null };
			}
		} else {
			// Deleting all the fact overrides: only the key will be evaluated but this makes it more explicit
			Object.keys(current).forEach(key => {
				toDelete[key] = { value: null, comment: null };
			});
		}

		await this.updateFactOverride(toDelete, { ...contextParams, method: "DELETE" });
		const deletedFactNames = getFactKeys(toDelete);
		return deletedFactNames;
	}

	public async updateFactOverride(
		record: Partial<Record<FactName, FactOverride | Pick<FactOverride, "value" | "comment">>>,
		contextParams: { method: "DELETE" | "PATCH" | "PUT"; userID: UUID; customerID?: UUID; caseID?: UUID }
	): Promise<Record<string, any>> {
		const businessID = this.getDBConnection()?.business_id;
		if (!businessID) throw new Error("Business ID is required");
		const connection = this.getDBConnection();
		if (!connection?.id) throw new Error("Connection ID is required");

		const factNames = Object.keys(record) as FactName[];
		const previousData = await this.fetchFactValues(businessID, factNames);
		const event = await this.generateIntegrationDataUploadedEvent(record, contextParams);

		const providedOverrides: Partial<Record<FactName, Pick<FactOverride, "value" | "comment">>> = {};
		for (const [key, val] of Object.entries(record)) {
			const v = val as FactOverride | Pick<FactOverride, "value" | "comment">;
			providedOverrides[key as FactName] =
				v && typeof v === "object" && "value" in v
					? { value: v.value ?? null, comment: v.comment ?? null }
					: { value: null, comment: null };
		}

		const currentFactOverrides = await this.getCurrentFactOverrides(event.business_id);
		const newFactOverrides = ManualIntegration.computeNextFactOverrideState(
			contextParams.method,
			providedOverrides,
			currentFactOverrides,
			{ userID: event.user_id, timestamp: event.created_at }
		);

		const taskLike = {
			id: event.id,
			business_id: event.business_id,
			connection_id: connection.id
		} as IBusinessIntegrationTaskEnriched;
		
		await this.saveRawResponseToDB(
			{ ...event, data: newFactOverrides },
			taskLike,
			"fact_override"
		);

		await this.kafkaProducer.send({
			topic: kafkaTopics.BUSINESS,
			messages: [
				{
					key: event.business_id,
					value: { ...event, event: kafkaEvents.INTEGRATION_DATA_UPLOADED }
				}
			]
		});

		const isCaseManagementEditingFeatureFlagEnabled = await getFlagValue(FEATURE_FLAGS.PAT_874_CM_APP_EDITING, {
			key: "customer",
			kind: "customer",
			customer_id: event.customer_id
		});
		if (isCaseManagementEditingFeatureFlagEnabled) {
			await this.kafkaProducer.send({
				topic: kafkaTopics.NOTIFICATIONS,
				messages: [
					{
						key: event.business_id,
						value: { ...event, event: kafkaEvents.FACT_OVERRIDE_UPDATED_AUDIT, previous_data: previousData }
					}
				]
			});
		}

		return { ...newFactOverrides };
	}

	private async fetchFactValues(businessId: UUID, factNames: FactName[]): Promise<Record<string, any>> {
		let factValues: Record<string, any> = {};

		try {
			/** Fetch old (current) fact values from warehouse for audit trail */
			factValues = await getBusinessFactsByKeys(businessId, factNames);
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unknown error";
			logger.error(error, `Error fetching fact values from warehouse: ${message}`);
			/** Fall back to fact engine if the warehouse lookup fails */
			const filteredFacts = allFacts.filter(fact => factNames.includes(fact.name));
			const engine = new FactEngineWithDefaultOverrides(filteredFacts, { business: businessId });
			await engine.applyRules(factWithHighestConfidence);
			factValues = filteredFacts.reduce((acc, fact) => {
				acc[fact.name] = engine.getResolvedFact(fact.name)?.value;
				return acc;
			}, {});
		}

		return factValues;
	}

	/**
	Type guard to check if the input is a valid to create a fact override
	*/
	private isValidShapeForFactOverride(
		input: unknown
	): input is Record<FactName, null | Pick<FactOverride, "value" | "comment">> {
		if (!input || typeof input !== "object") {
			return false;
		}
		if (!Object.keys(input).every(key => typeof key === "string")) {
			return false;
		}
		if (
			!Object.values(input).every(
				value =>
					value === null ||
					(typeof value === "object" &&
						value !== null &&
						"value" in value &&
						(!("comment" in value) ||
							("comment" in value && (value.comment === null || typeof value.comment === "string"))))
			)
		) {
			return false;
		}
		return true;
	}

	public validateFactOverride(input: unknown, allFacts: Fact[]): void {
		if (!this.isValidShapeForFactOverride(input)) {
			throw new ManualIntegrationError(
				"Input does not conform to fact override shape",
				{},
				StatusCodes.BAD_REQUEST,
				ERROR_CODES.INVALID
			);
		}

		// allFacts
		const allFactsMap = allFacts.reduce((acc, fact) => {
			const existing = acc.get(fact.name);
			if (!existing) {
				acc.set(fact.name, fact);
			} else if (fact.schema && !existing.schema) {
				acc.set(fact.name, fact);
			}
			return acc;
		}, new Map<string, Fact>());

		const factOverrides: Record<FactName, null | Pick<FactOverride, "value" | "comment">> = input;

		// Throw if any supplied factName is not in allFactsMap
		const invalidFactNames: string[] = [];
		for (const factName of Object.keys(factOverrides)) {
			if (!allFactsMap.has(factName)) {
				invalidFactNames.push(factName);
			}
		}
		if (invalidFactNames.length > 0) {
			if (invalidFactNames.length === 1) {
				throw new ManualIntegrationError(
					`Fact ${invalidFactNames[0]} does not exist`,
					{},
					StatusCodes.BAD_REQUEST,
					ERROR_CODES.INVALID
				);
			}
			throw new ManualIntegrationError(
				`Facts ${invalidFactNames.join(", ")} do not exist`,
				invalidFactNames,
				StatusCodes.BAD_REQUEST,
				ERROR_CODES.INVALID
			);
		}
		// Validate input against schema
		let validationExceptions: string[] = [];
		for (const [factName, override] of Object.entries(factOverrides)) {
			const fact = allFactsMap.get(factName);
			if (fact && fact.schema && override != null) {
				try {
					validateInputAgainstSchema(fact, override.value);
				} catch (error: unknown) {
					if (error instanceof z.ZodError) {
						const tree = z.treeifyError(error);
						logger.error({ fact, tree, override }, `Zod error parsing input against schema for fact ${factName}`);
						let errors: string[] = [];
						tree.errors.forEach(e => {
							errors.push(e);
						});
						Object.entries(((tree as any)?.properties ?? {}) as Record<string, { errors: string[] }>).forEach(
							([propName, propErrors]) => {
								if (propErrors?.errors?.length > 0) {
									errors.push(`property ${propName}: ${propErrors?.errors?.join(", ")}`);
								}
							}
						);
						((tree as any)?.items ?? [])?.forEach((item, index) => {
							if (item?.errors?.length > 0) {
								errors.push(`item[${index}]: ${item?.errors?.join(", ")}`);
							}
						});
						if (errors.length === 0) {
							errors.push("unspecified input error, please check request against schema");
						}
						validationExceptions.push(`${factName}: ` + errors.join(", "));
					} else {
						// Some other exception happened -- just rethrow it
						logger.error({ error }, "Error validating fact override against schema");
						throw error;
					}
				}
			}
		}
		if (validationExceptions.length > 0) {
			logger.error({ validationExceptions }, "Validation exceptions");
			throw new ManualIntegrationError(
				`${validationExceptions.join(" | ")}`,
				{ validationExceptions },
				StatusCodes.BAD_REQUEST,
				ERROR_CODES.INVALID
			);
		}
	}

	private async generateIntegrationDataUploadedEvent(
		record: Partial<Record<FactName, FactOverride | Pick<FactOverride, "value" | "comment">>>,
		contextParams: { method: "PUT" | "PATCH" | "DELETE"; userID: UUID; customerID?: UUID; caseID?: UUID }
	): Promise<IntegrationDataUploadedEventType> {
		type CaseRecord = { score_trigger_id: UUID; id: UUID };

		// Make copies of the contextParams to avoid mutating the original object
		const { userID } = contextParams;
		let { customerID, caseID } = { ...contextParams };
		const connection = this.getDBConnection();
		if (!connection) {
			throw new Error("Manual connection not found for businessId: " + record.business_id);
		}
		let caseRecord: CaseRecord | undefined;
		let businessScoreTrigger: BusinessScoreTrigger | undefined;
		if (!caseID) {
			try {
				caseRecord = (await getOnboardingCaseByBusinessId(
					connection.business_id,
					contextParams.customerID
				)) as CaseRecord;
				caseID = caseRecord.id as UUID;
			} catch (error) {
				logger.error(error, `Onboarding case not found for businessId: ${connection.business_id}`);
			}
		}
		if (!customerID) {
			if (!caseRecord) {
				caseRecord = (await getCase(caseID as UUID)) as CaseRecord;
			}
			const businessScoreTriggerRepository = new BusinessScoreTriggerRepository();
			businessScoreTrigger = await businessScoreTriggerRepository.getById(caseRecord.score_trigger_id);
			customerID = businessScoreTrigger.customer_id as UUID;
		}

		const taskId = await this.getOrCreateTaskForCode({
			taskCode: "manual",
			reference_id: customerID,
			scoreTriggerId: businessScoreTrigger?.id,
			conditions: businessScoreTrigger?.id
				? [{ column: "business_score_trigger_id", operator: "=", value: businessScoreTrigger?.id }]
				: []
		});

		return {
			id: taskId,
			case_id: caseID as UUID,
			business_id: connection.business_id,
			customer_id: customerID as UUID,
			user_id: userID,
			created_at: new Date(),
			data: record,
			trigger: `factOverride:${contextParams.method}`
		};
	}

	public async getCurrentFactOverrides(businessId: UUID): Promise<Record<string, any> | undefined> {
		const dbRow = await db<IRequestResponse>("integration_data.request_response")
			.select("response")
			.where({ business_id: businessId, request_type: "fact_override" })
			.orderBy("requested_at", "DESC")
			.limit(1)
			.first();
		return dbRow?.response;
	}

	private async saveRawResponseToDB(
		event: IntegrationDataUploadedEventType,
		task: IBusinessIntegrationTaskEnriched,
		requestType: "manual_upload" | "fact_override" = "manual_upload"
	): Promise<IRequestResponse> {
		const insertedRecord = await db<IRequestResponse>("integration_data.request_response")
			.insert({
				request_id: task.id,
				business_id: task.business_id,
				platform_id: INTEGRATION_ID.MANUAL,
				request_type: requestType,
				org_id: event.customer_id || null,
				request_received: new Date(),
				status: 1,
				connection_id: task.connection_id,
				response: event.data ?? {}
			})
			.onConflict("request_id")
			.merge()
			.returning("*");
		return insertedRecord[0];
	}
}
