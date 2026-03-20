import { ERROR_CODES } from "#constants";
import { db } from "#helpers/knex";
import type { UUID } from "crypto";
import { StatusCodes } from "http-status-codes";
import { BankingApiError } from "../error";
import type IBanking from "../types";
import BankingBase from "./bankingBase";
import { BankAccountBalance, BankAccountTransaction } from "./index";
import { logger } from "#helpers/index";

type Record = IBanking.BankAccountRecord;
type Egg = IBanking.BankAccountEgg;

/**
 * Class to interact with `bank_accounts` table
 */
class BankAccount extends BankingBase {
	protected static readonly TABLE = "integration_data.bank_accounts";
	protected readonly TABLE = BankAccount.TABLE;
	protected declare record: Record;
	constructor(record: Record) {
		super(record);
	}
	/**
	 * Insert or update a bank account record from an egg
	 *  Updates if the account is already found for the business associated to the task
	 *  Inserts if the account is not found
	 * @param egg
	 * @returns Promise<BankAccount>
	 */
	public static async merge(egg: Egg, connectionId: UUID): Promise<BankAccount> {
		try {
			const existingRecords: BankAccount[] = await BankAccount.getByAccountIdAndConnectionId(egg.bank_account, connectionId);
			logger.info(`existingRecords 1 = ${JSON.stringify(existingRecords)}`);
			// Delete all but the most recent one
			while (existingRecords.length > 1) {
				const accountId = existingRecords[0].getRecord().id;
				await BankAccountBalance.purgeByAccountId(accountId);
				await BankAccountTransaction.purgeByAccountId(accountId);
				await BankAccount.purgeByAccountId(accountId);
				// Remove first record from array
				existingRecords.shift();
			}
			logger.info(`existingRecords 2 = ${JSON.stringify(existingRecords)}`);
			if (existingRecords.length === 1) {
				// prevent overwriting of existing business_integration_task_id during record update
				// Destructure the `egg` object to separate `business_integration_task_id` from the rest of the properties

				logger.info(`egg = ${JSON.stringify(egg)}`);
				const { business_integration_task_id, ...eggWithoutTaskId } = egg;

				logger.info(`eggWithoutTaskId = ${JSON.stringify(eggWithoutTaskId)}`);
				// Merge the existing record's data with the properties from `egg` (excluding `business_integration_task_id`)
				const update = { ...existingRecords[0].getRecord(), ...eggWithoutTaskId };

				logger.info(`update = ${JSON.stringify(update)}`);
				return existingRecords[0].update(update);
			}
		} catch (err) {
			if (err instanceof BankingApiError && err.status === StatusCodes.NOT_FOUND) {
				return await BankAccount.fromEgg(egg);
			}
		}
		throw new BankingApiError(`Could not merge BankAccount for bankAccountId=${egg.bank_account} and connectionId=${connectionId}`, StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
	}
	public static async getByAccountId(bankAccountId: string): Promise<BankAccount[]> {
		const records = await db<Record>(this.TABLE).where({ bank_account: bankAccountId });
		if (!records) {
			throw new BankingApiError(`BankAccount not found for bankAccountId=${bankAccountId}`, StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
		}
		return records.map(record => new this(record));
	}
	public static async getByAccountIdAndConnectionId(bankAccountId: string, connectionId: string): Promise<BankAccount[]> {
		const records = await db<Record>({ acct: this.TABLE })
			.select("acct.*")
			.join({ task: "integrations.data_business_integrations_tasks" }, "task.id", "acct.business_integration_task_id")
			.join({ con: "integrations.data_connections" }, "con.id", "task.connection_id")
			.where({ "acct.bank_account": bankAccountId, "con.id": connectionId, "acct.deposit_account": false });
		if (!records || records.length === 0) {
			throw new BankingApiError(`BankAccount not found for connectionId=${connectionId} and bankAccountId=${bankAccountId}`, StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
		}
		return records.map(record => new this(record));
	}

	static async purgeByAccountId(bankAccountId: string): Promise<void> {
		await db<Record>(this.TABLE).where({ id: bankAccountId, deposit_account: false }).delete();
	}
}

export default BankAccount;
