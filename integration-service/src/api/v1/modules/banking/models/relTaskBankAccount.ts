import { db } from "#helpers/knex";
import { BankingApiError } from "../error";
import type IBanking from "../types";
import { StatusCodes } from "http-status-codes";
import { ERROR_CODES } from "#constants";
import BankingBase from "./bankingBase";

type Record = {};

/**
 * Class to interact with `rel_task_bank_account` table
 */
class RelTaskBankAccount extends BankingBase {
	protected static readonly TABLE = "integration_data.rel_task_bank_account";
	constructor(record: Record) {
		super(record);
	}

	/**
	 * Insert or update rel_task_bank_account record
	 * Updates if the task is already found
	 * Inserts if the task is not found
	 * @param taskId
	 * @param bankAccounts
	 * @returns Promise<RelTaskBankAccount>
	 */
	public static async upsertRecords(taskId: string, bankAccounts: string[]): Promise<RelTaskBankAccount> {
		// Check if a record already exists for the given taskId
		const existingRecord = await db(RelTaskBankAccount.TABLE).where({ business_integration_task_id: taskId }).first();

		if (existingRecord) {
			// Update the existing record
			await db(RelTaskBankAccount.TABLE)
				.where({ business_integration_task_id: taskId })
				.update({
					bank_account_id: db.raw("?", [bankAccounts])
				});
		} else {
			// Insert a new record
			await db(RelTaskBankAccount.TABLE).insert({
				business_integration_task_id: taskId,
				bank_account_id: db.raw("?", [bankAccounts])
			});
		}

		// Return the updated or newly created record
		const updatedRecord = await db(RelTaskBankAccount.TABLE).where({ business_integration_task_id: taskId }).first();

		return new RelTaskBankAccount({ updatedRecord } as Record);
	}
}

export default RelTaskBankAccount;
