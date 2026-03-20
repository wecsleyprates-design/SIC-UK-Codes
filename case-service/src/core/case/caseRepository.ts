import { sqlQuery, sqlTransaction, db } from "#helpers/index";
import { UpdateCaseData, CaseStatusHistoryData } from "../types";
import { UUID } from "@joinworth/types/dist/utils/utilityTypes";
import { Knex } from "knex";

export class CaseRepository {
	protected db: Knex;

	constructor({ db: injectedDb }: { db?: Knex } = {}) {
		this.db = injectedDb ?? db;
	}

	/**
	 * Gets the customer_id for a given case
	 * @param caseId - The case ID to query
	 * @returns Promise<UUID | undefined>
	 */
	async getCustomerIdByCaseId(caseId: UUID): Promise<UUID | null> {
		const result = await this.db<{ customer_id: string }>("data_cases")
			.select("customer_id")
			.where("id", caseId)
			.first();
		return result?.customer_id ?? null;
	}

	/**
	 * Gets the current case status with business validation
	 * @param caseId - The case ID to query
	 * @returns Promise<{ rows: Array<{ status: number }> }>
	 */
	async getCurrentCaseStatus(caseId: string): Promise<{ rows: Array<{ status: number }> }> {
		const currentStatusQuery = `SELECT data_cases.* FROM data_cases LEFT JOIN data_businesses db ON db.id = data_cases.business_id WHERE data_cases.id = $1 AND db.is_deleted = false`;
		return await sqlQuery({ sql: currentStatusQuery, values: [caseId] });
	}

	/**
	 * Updates case status in the database
	 * @param data - The case update data
	 * @returns Promise<void>
	 */
	async updateCaseStatus(data: UpdateCaseData): Promise<void> {
		const updateStatusQuery = `UPDATE data_cases SET status = $1, updated_by = $2 WHERE id = $3`;
		await sqlQuery({ sql: updateStatusQuery, values: [data.status, data.userId, data.caseId] });
	}

	/**
	 * Inserts case status history record
	 * @param data - The status history data
	 * @returns Promise<void>
	 */
	async insertCaseStatusHistory(data: CaseStatusHistoryData): Promise<void> {
		const insertStatusHistoryQuery = `INSERT INTO data_case_status_history
			(case_id, status, created_by)
			VALUES($1, $2, $3)`;
		await sqlQuery({ sql: insertStatusHistoryQuery, values: [data.caseId, data.status, data.userId] });
	}

	/**
	 * Updates case status and inserts history in a transaction
	 * @param updateData - The case update data
	 * @param historyData - The status history data
	 * @returns Promise<void>
	 */
	async updateCaseStatusWithHistory(updateData: UpdateCaseData, historyData: CaseStatusHistoryData): Promise<void> {
		const updateStatusQuery = `UPDATE data_cases SET status = $1, updated_by = $2 WHERE id = $3`;
		const insertStatusHistoryQuery = `INSERT INTO data_case_status_history
			(case_id, status, created_by)
			VALUES($1, $2, $3)`;

		await sqlTransaction(
			[updateStatusQuery, insertStatusHistoryQuery],
			[
				[updateData.status, updateData.userId, updateData.caseId],
				[historyData.caseId, historyData.status, historyData.userId]
			]
		);
	}
}
