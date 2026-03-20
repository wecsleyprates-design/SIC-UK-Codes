import { db } from "#helpers/knex";
import { BankingApiError } from "../error";
import type IBanking from "../types";
import { StatusCodes } from "http-status-codes";
import { ERROR_CODES } from "#constants";
import BankingBase from "./bankingBase";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";

dayjs.extend(utc);

type Record = IBanking.BankAccountTransactionRecord;
type Egg = IBanking.BankAccountTransactionEgg;

/**
 * Class to interact with `bank_account_transactions` table
 */
class BankAccountTransaction extends BankingBase {
	protected static readonly TABLE = "integration_data.bank_account_transactions";
	protected declare record: Record;
	constructor(record: Record) {
		super(record);
	}
	/**
	 * Insert or update a bank account transactions from an array of eggs
	 *  Updates if the transaction is already found for the associated bank account
	 *  Inserts if the transaction is not found
	 * @param eggs: BankAccountTransactionEgg[]
	 * @returns Promise<BankAccountTransaction[]>
	 */
	public static mergeRecords = async (eggs: Egg[], connectionId): Promise<BankAccountTransaction[]> => {
		const out = [] as BankAccountTransaction[];
		// Loop through each group
		for (const egg of eggs) {
			// Get records by accountId
			try {
				const existingRecord = await BankAccountTransaction.getByTransactionIdAndConnectionId(egg.transaction_id, connectionId);
				// Destructure the business_integration_task_id from the egg object and exclude it from the update
				const { business_integration_task_id, ...eggWithoutTaskId } = egg;

				// Merge the existing record with the remaining properties of the egg to create the update object
				const update = { ...existingRecord.getRecord(), ...eggWithoutTaskId } as Record;
				out.push(await existingRecord.update(update));
			} catch (err) {
				if (err instanceof BankingApiError && err.status === StatusCodes.NOT_FOUND) {
					out.push(await BankAccountTransaction.fromEgg(egg));
				}
			}
		}
		if (out.length !== eggs.length) {
			throw new BankingApiError(`Expected number of transactions were not relinked: ${out.length} vs ${eggs.length}`, StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
		}
		return out;
	};

	public static getByTransactionIdAndAccountId = async (transactionId: string, bankAccountId: string): Promise<BankAccountTransaction> => {
		const record = await db<Record>(BankAccountTransaction.TABLE).select("*").where({ transaction_id: transactionId, bank_account_id: bankAccountId }).first();
		if (!record) {
			throw new BankingApiError(`BankAccountTransaction not found for transactionId=${transactionId} and bankAccountId=${bankAccountId}`, StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
		}
		return new BankAccountTransaction(record);
	};

	public static getByTransactionIdAndConnectionId = async (transactionId: string, connectionId: string): Promise<BankAccountTransaction> => {
		const record = await db<Record>({ t: this.TABLE })
			.select("t.*")
			.join({ task: "integrations.data_business_integrations_tasks" }, "task.id", "t.business_integration_task_id")
			.where({ "task.connection_id": connectionId, "t.transaction_id": transactionId })
			.first();

		if (!record) {
			throw new BankingApiError(`BankAccountTransaction not found for transactionId=${transactionId} and connectionId=${connectionId}`, StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
		}
		return new BankAccountTransaction(record);
	};

	public static findMostRecentTransactionsForAccount = async (bankAccountID: string, number: number): Promise<BankAccountTransaction[]> => {
		const rows = await db<IBanking.BankAccountTransactionRecord>("integration_data.bank_account_transactions")
			.select("*")
			.where({ bank_account_id: bankAccountID })
			.orderBy("date", "desc")
			.limit(number);
		return rows.map(row => new BankAccountTransaction(row));
	};

	public static findTransactionsBetweenDatesForAccount = async (bankAccountID: string, start: Date, end: Date): Promise<BankAccountTransaction[]> => {
		const rows = await db("integration_data.bank_account_transactions")
			.select("*")
			.where({ bank_account_id: bankAccountID })
			.whereBetween("date", [
				dayjs.utc(start).startOf("day").toISOString(),
				dayjs.utc(end).endOf("day").toISOString() // Make sure to include the full end day
			])
			.orderBy("date", "desc");
		return rows.map(row => new BankAccountTransaction(row));
	};

	public static findTransactionsBetweenDatesForPlaidAccount = async (plaidAccountId: string, start: Date, end: Date): Promise<BankAccountTransaction[]> => {
		const rows = await db({ t: "integration_data.bank_account_transactions" })
			.select("t.*")
			.join({ acct: "integration_data.bank_accounts" }, "acct.id", "t.bank_account_id")
			.where({ "acct.bank_account": plaidAccountId })
			.whereBetween("t.date", [
				dayjs.utc(start).startOf("day").toISOString(),
				dayjs.utc(end).endOf("day").toISOString() // Make sure to include the full end day
			])
			.orderBy("t.date", "desc");
		return rows.map(row => new BankAccountTransaction(row));
	};
}

export default BankAccountTransaction;
