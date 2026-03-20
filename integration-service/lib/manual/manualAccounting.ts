import { TaskManager, type TaskHandlerMap } from "#api/v1/modules/tasks/taskManager";
import { CONNECTION_STATUS, INTEGRATION_ID, IntegrationTaskKey, TASK_STATUS } from "#constants";
import { getOrCreateConnection } from "#helpers/platformHelper";
import type { IDBConnection, IDBConnectionEgg, SqlQueryResult } from "#types/db";
import type { UUID } from "crypto";
import { sqlQuery } from "#helpers";

export class ManualAccounting extends TaskManager {
	private readonly PLATFORM_ID = INTEGRATION_ID.MANUAL_ACCOUNTING;

	constructor(dbConnection?: IDBConnection) {
		super(dbConnection);
	}

	taskHandlerMap: TaskHandlerMap = {
		fetch_accounting_records: async (taskId: UUID) => {
			await this.saveTaskMetadata(taskId);
			return true;
		},
		fetch_accounting_business_info: async (taskId: UUID) => {
			await this.saveTaskMetadata(taskId);
			return true;
		},
		fetch_balance_sheet: async (taskId: UUID) => {
			await this.saveTaskMetadata(taskId);
			return true;
		},
		fetch_profit_and_loss_statement: async (taskId: UUID) => {
			await this.saveTaskMetadata(taskId);
			return true;
		},
		fetch_cash_flow: async (taskId: UUID) => {
			await this.saveTaskMetadata(taskId);
			return true;
		},
		fetch_accounting_accounts: async (taskId: UUID) => {
			await this.saveTaskMetadata(taskId);
			return true;
		}
	};

	public static async getInstance(businessID: UUID) {
		const dbConnection = await getOrCreateConnection(businessID, INTEGRATION_ID.MANUAL_ACCOUNTING, { connection_status: CONNECTION_STATUS.SUCCESS });
		if (dbConnection && dbConnection.connection_status !== CONNECTION_STATUS.SUCCESS) {
			await this.updateConnectionStatus(dbConnection.id, CONNECTION_STATUS.SUCCESS);
		}
		return new this(dbConnection);
	}

	private async saveTaskMetadata(taskId: UUID) {
		const documents = await this.getAccountingStatements();
		await this.updateTask(taskId, { metadata: { ocr_document_ids: documents?.map(d => d.id) } });
	}

	public static async initializeManualAccountingConnection(businessID: UUID): Promise<ManualAccounting> {
		const connectionEgg: IDBConnectionEgg = {
			business_id: businessID,
			platform_id: INTEGRATION_ID.MANUAL_ACCOUNTING,
			connection_status: "SUCCESS",
			configuration: null
		};

		const platform = new ManualAccounting();
		const connection = await platform.initializeConnection(connectionEgg);
		platform.dbConnection = { ...connection, configuration: connectionEgg.configuration };
		return platform;
	}

	public async updateManualBankingTaskMetadata(taskId: UUID, metadata: any): Promise<any> {
		const platform = new ManualAccounting();
		const updatedManualBankingTask = await platform.updateTask(taskId, { metadata });
		return updatedManualBankingTask;
	}

	public async getAccountingStatements() {
		try {
			const businessID = this.dbConnection?.business_id;
			let getOCRAccountingStatementsQuery = `SELECT id, file_name, file_path, extracted_data FROM integration_data.uploaded_ocr_documents WHERE business_id = $1 AND job_type = $2 AND category_id = $3 AND is_confirmed = $4`;
			let values = [businessID, "validation", 1, true];
			const getOCRAccountingStatementsResult: SqlQueryResult = await sqlQuery({ sql: getOCRAccountingStatementsQuery, values });
			return getOCRAccountingStatementsResult.rows;
		} catch (error) {
			throw error;
		}
	}
}
