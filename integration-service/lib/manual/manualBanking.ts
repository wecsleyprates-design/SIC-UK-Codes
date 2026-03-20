import { TaskManager, type TaskHandlerMap } from "#api/v1/modules/tasks/taskManager";
import { CONNECTION_STATUS, CORE_INTEGRATION_STATUS, INTEGRATION_CODES, INTEGRATION_ID } from "#constants";
import { getOrCreateConnection } from "#helpers/platformHelper";
import type { IDBConnection, IDBConnectionEgg, SqlQueryResult } from "#types/db";
import type { UUID } from "crypto";
import type { ManualBankingTask } from "./types";
import { getCase } from "#helpers/case";
import { BankAccount, RelTaskBankAccount } from "#api/v1/modules/banking/models";
import { encryptData } from "#utils/encryption";
import { logger } from "#helpers/logger";
import { db } from "#helpers/knex";
import type { IAdditionalAccountInfoBody, IBanking } from "#api/v1/modules/banking/types";
import { sqlQuery } from "#helpers";
import { GIACT } from "#lib/giact/giact";
import { customerIntegrationSettings} from "#api/v1/modules/customer-integration-settings/customer-integration-settings";
import { BusinessScoreTriggerRepository } from "#core/scoreTrigger";

export class ManualBanking extends TaskManager {
	private readonly PLATFORM_ID = INTEGRATION_ID.MANUAL_BANKING;

	constructor(dbConnection?: IDBConnection) {
		super(dbConnection);
	}

	taskHandlerMap: TaskHandlerMap = {
		fetch_assets_data: async (taskId: UUID) => {
			return true;
		}
	};

	public static async getInstance(businessID: UUID) {
		const dbConnection = await getOrCreateConnection(businessID, INTEGRATION_ID.MANUAL_BANKING, {
			connection_status: CONNECTION_STATUS.SUCCESS
		});
		if (dbConnection && dbConnection.connection_status !== CONNECTION_STATUS.SUCCESS) {
			await this.updateConnectionStatus(dbConnection.id, CONNECTION_STATUS.SUCCESS);
		}
		return new this(dbConnection);
	}

	public async addAccount(
		accountData: IAdditionalAccountInfoBody["accountData"],
		userID: UUID,
		caseID: UUID,
		options?: { deposit_account?: boolean; is_selected?: boolean }
	): Promise<IBanking.BankAccountRecord> {
		if (!this.dbConnection?.business_id) {
			throw new Error("No connection defined");
		}
		const businessID = this.dbConnection.business_id;
		// Get or generate a taskId to associate with the record
		let taskId: UUID | undefined;
		let scoreTriggerId: UUID | undefined;
		let customerID: UUID | undefined;
		if (caseID) {
			try {
				const scoreTrigger = await this.getScoreTriggerForCase(caseID);
				if (scoreTrigger) {
					scoreTriggerId = scoreTrigger.id;
					taskId = await this.getOrCreateTaskForCode<ManualBankingTask>({
						taskCode: "fetch_assets_data",
						scoreTriggerId,
						metadata: { created_by: userID, created_at: new Date() },
						conditions: [{ column: "business_score_trigger_id", operator: "=", value: scoreTriggerId }]
					});
					customerID = scoreTrigger.customer_id ?? undefined;
				}
			} catch (ex) {
				logger.warn(ex, `No score trigger could be found for business`);
				// no score trigger, swallow and don't use the caseId
			}
		}
		if (!taskId) {
			taskId = await this.getOrCreateTaskForCode<ManualBankingTask>({
				taskCode: "fetch_assets_data",
				metadata: { created_by: userID, created_at: new Date() }
			});
		}
		// If this is a deposit account being added/updated, mark all other deposit accounts for this business as not selected and not deposit accounts
		if (options?.deposit_account) {
			await db("integration_data.bank_accounts")
				.whereIn("business_integration_task_id", function() {
					this.select("data_business_integrations_tasks.id")
						.from("integrations.data_business_integrations_tasks")
						.join("integrations.data_connections", "data_connections.id", "data_business_integrations_tasks.connection_id")
						.where("data_connections.business_id", businessID);
				})
				.andWhere({ deposit_account: true })
				.update({ is_selected: false, deposit_account: false });
		}

		let processorOrchestrationEnabled;
		if (customerID) {
			const integrationStatus = await customerIntegrationSettings.getIntegrationStatusForCustomer(customerID);
			processorOrchestrationEnabled = integrationStatus.find((item: any) => item.integration_code === INTEGRATION_CODES.PROCESSOR_ORCHESTRATION)?.status === CORE_INTEGRATION_STATUS.ENABLED; 
		}

		const newBankAccount = await BankAccount.create<BankAccount>({
			business_integration_task_id: taskId,
			bank_account: encryptData(accountData.bank_account),
			bank_name: accountData.bank_name ?? null,
			official_name: accountData.official_name ?? null,
			institution_name: accountData.bank_name ?? null,
			verification_status: "UNVERIFIED",
			mask: accountData.bank_account.substring(accountData.bank_account.length - 4),
			type: processorOrchestrationEnabled ? "depository" : "additional_accounts",
			subtype: accountData.subtype,
			routing_number: encryptData(accountData.routing_number),
			account_holder_name: accountData.account_holder_name ?? null,
			account_holder_type: accountData.account_holder_type ?? null,
			currency: processorOrchestrationEnabled ? "USD" : null,
			is_additional_account: true,
			deposit_account: options?.deposit_account ?? false,
			is_selected: options?.is_selected ?? false
		});
		await RelTaskBankAccount.upsertRecords(taskId, [newBankAccount.getRecord().id]);
		await this.processTask({ taskId });
		try {
			// As a side effect, make sure this hits GIACT
			const giact = await GIACT.initializeGiactConnection(businessID, this.dbConnection.configuration.customer_id);
			const giactConnection = giact.getDBConnection();
			if (!giactConnection) {
				throw new Error("Cannot initialize giact connection");
			}
			if (giactConnection.connection_status !== CONNECTION_STATUS.SUCCESS) {
				await giact.updateConnectionStatus(CONNECTION_STATUS.SUCCESS);
			}
			const giactTask = await giact.getOrCreateTaskForCode({
				taskCode: "fetch_giact_verification",
				scoreTriggerId,
				metadata: {
					bank_account_ids: [newBankAccount.getRecord().id]
				},
				conditions: [{ column: "business_score_trigger_id", value: scoreTriggerId ?? "", operator: "=" }]
			});
			await giact.processTask({ taskId: giactTask, businessID, caseID });
			// Create an extra task for case submit processing if any deposit accounts added
			await giact.getOrCreateTaskForCode({
				taskCode: "fetch_giact_verification",
				scoreTriggerId,
				conditions: [{ column: "business_score_trigger_id", value: scoreTriggerId ?? "", operator: "=" }]
			});
		} catch (ex) {
			const message = ex instanceof Error ? ex.message : String(ex);
			const stack = ex instanceof Error ? ex.stack : undefined;
			logger.error(
				{ error: { message, ...(stack && { stack }) }, businessID, caseID, taskId },
				"Error executing GIACT task on manual account creation"
			);
		}

		return newBankAccount.getRecord();
	}
	public async deleteAccount(accountId: UUID, caseId: UUID): Promise<void> {
		await db.transaction(async trx => {
			// Delete verification records for this account's case
			// Accounts are typically tied to one case, so we only delete verifications for the specific case
			await trx("integration_data.rel_banking_verifications")
				.where({ bank_account_id: accountId, case_id: caseId })
				.delete();

			// Delete related transactions (required due to ON DELETE RESTRICT constraint on bank_accounts table)
			await trx("integration_data.bank_account_transactions")
				.where({ bank_account_id: accountId })
				.delete();

			// Delete related balances (required due to ON DELETE RESTRICT constraint on bank_accounts table)
			await trx("integration_data.banking_balances")
				.where({ bank_account_id: accountId })
				.delete();

			await trx("integration_data.bank_accounts").where({ id: accountId, is_additional_account: true }).delete();

			// Remove the account ID from all rel_task_bank_account records that reference it to prevent orphanage of task bank account records
			const taskBankAccountRecords = await trx("integration_data.rel_task_bank_account")
				.whereRaw("? = ANY(bank_account_id)", [accountId]);

			for (const record of taskBankAccountRecords) {
				const updatedAccountIds = (record.bank_account_id || []).filter((id: string) => id !== accountId);
				
				if (updatedAccountIds.length === 0) {
					// If no accounts remain in the array, delete the entire record
					await trx("integration_data.rel_task_bank_account")
						.where({ business_integration_task_id: record.business_integration_task_id })
						.delete();
				} else {
					// Update the array to remove the deleted account ID
					await trx("integration_data.rel_task_bank_account")
						.where({ business_integration_task_id: record.business_integration_task_id })
						.update({ bank_account_id: updatedAccountIds });
				}
			}
		});
	}

	private async getScoreTriggerForCase(caseId: UUID) {
		const caseRecord = await getCase(caseId);
		if (caseRecord && caseRecord.score_trigger_id) {
			const businessScoreTriggerRepository = new BusinessScoreTriggerRepository();
			const scoreTrigger = await businessScoreTriggerRepository.getById(caseRecord.score_trigger_id);
			return scoreTrigger;
		}
	}

	public static async initializeManualBankingConnection(businessID: UUID): Promise<ManualBanking> {
		const connectionEgg: IDBConnectionEgg = {
			business_id: businessID,
			platform_id: INTEGRATION_ID.MANUAL_BANKING,
			connection_status: "SUCCESS",
			configuration: null
		};

		const platform = new ManualBanking();
		const connection = await platform.initializeConnection(connectionEgg);
		platform.dbConnection = { ...connection, configuration: connectionEgg.configuration };
		return platform;
	}

	public static async updateManualBankingTaskMetadata(taskId: UUID, metadata: any): Promise<any> {
		const platform = new ManualBanking();
		const updatedManualBankingTask = await platform.updateTask(taskId, { metadata });
		return updatedManualBankingTask;
	}

	public async getBankStatements() {
		try {
			const businessID = this.dbConnection?.business_id ?? "";
			let getOCRBankStatementsQuery = `SELECT id, file_name, file_path, extracted_data FROM integration_data.uploaded_ocr_documents WHERE business_id = $1 AND job_type = $2 AND category_id = $3 AND is_confirmed = $4`;
			let values = [businessID, "validation", 3, true];
			const getOCRBankStatementsResult: SqlQueryResult = await sqlQuery({ sql: getOCRBankStatementsQuery, values });
			return getOCRBankStatementsResult.rows;
		} catch (error) {
			throw error;
		}
	}
}
