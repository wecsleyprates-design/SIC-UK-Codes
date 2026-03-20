import { db } from "#helpers/knex";
import { BankingApiError } from "../error";
import type IBanking from "../types";
import { StatusCodes } from "http-status-codes";
import { ERROR_CODES } from "#constants";
import BankingBase from "./bankingBase";

type Record = IBanking.BankAccountBalanceRecord;
type Egg = IBanking.BankAccountBalanceEgg;

/**
 * Class to interact with `banking_balances` table
 */
class BankAccountBalance extends BankingBase {
	protected static readonly TABLE = "integration_data.banking_balances";
	constructor(record: Record) {
		super(record);
	}
	/**
	 * Insert or update a bank account balance record from an egg
	 *  Updates if the account is already found for the business associated to the task
	 *  Inserts if the account is not found
	 * @param egg
	 * @returns Promise<BankAccountBalance>
	 */
	public static async mergeRecords(eggs: Egg[]): Promise<BankAccountBalance[]> {
		// Group by accountId
		const groupedEggs = eggs.reduce((acc, egg) => {
			if (!acc[egg.bank_account_id]) {
				acc[egg.bank_account_id] = [];
			}
			acc[egg.bank_account_id].push(egg);
			return acc;
		}, {});
		const out = [] as BankAccountBalance[];
		// Loop through each group
		for (const accountId in groupedEggs) {
			// Get records by accountId
			const existingRecords = await BankAccountBalance.findByBankAccountId(accountId);
			const groupResult = [] as BankAccountBalance[];
			// Loop through each egg in the group -- looking for an entry with the same month + year
			for (const egg of groupedEggs[accountId]) {
				const foundRecord = existingRecords.find(balance => {
					const record = balance.getRecord();
					return record.month === egg.month && record.year === egg.year;
				});
				if (foundRecord) {
					const update = { ...foundRecord.getRecord(), ...egg };
					groupResult.push(await foundRecord.update(update));
				} else {
					groupResult.push(await BankAccountBalance.fromEgg(egg));
				}
			}
			if (groupResult.length !== groupedEggs[accountId].length) {
				throw new BankingApiError(`Could not merge BankAccount for bankAccountId=${accountId}`, StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
			}
			out.push(...groupResult);
		}
		return out;
	}
}

export default BankAccountBalance;
