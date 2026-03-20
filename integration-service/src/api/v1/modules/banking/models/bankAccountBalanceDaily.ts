import { db } from "#helpers/knex";
import { BankingApiError } from "../error";
import type IBanking from "../types";
import { StatusCodes } from "http-status-codes";
import { ERROR_CODES } from "#constants";
import BankingBase from "./bankingBase";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import currency from "currency.js";
import { exist } from "joi";

dayjs.extend(utc);
type Record = IBanking.BankAccountBalanceDailyRecord;
type Egg = IBanking.BankAccountBalanceDailyEgg;

/**
 * Class to interact with `banking_balances` table
 */
class BankAccountBalanceDaily extends BankingBase {
	protected static readonly TABLE = "integration_data.banking_balances_daily";
	protected declare record: Record;
	constructor(record: Record) {
		super(record);
	}

	public getRecord(): Record {
		return this.record;
	}
	/**
	 * Insert or update a bank account balance record from an egg
	 *  Updates if the account is already found for the business associated to the task
	 *  Inserts if the account is not found
	 * @param egg
	 * @returns Promise<BankAccountBalanceDaily>
	 */
	public static async mergeRecords(eggs: Egg[]): Promise<BankAccountBalanceDaily[]> {
		const out: BankAccountBalanceDaily[] = [];
		// Group by accountId
		for (const egg of eggs) {
			const record = await db<Record>(BankAccountBalanceDaily.TABLE).insert(egg).onConflict(["bank_account_id", "date"]).merge().returning("*");
			if (!record) {
				throw new BankingApiError(`Could not merge BankAccountBalanceDaily for bankAccountId=${egg.bank_account_id} and date=${egg.date}`, StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
			}
			out.push(new BankAccountBalanceDaily(record[0]));
		}
		return out;
	}

	/**
	 * Convert BankAccountBalanceDaily objects to BankAccountBalanceRecord
	 * @param records
	 * @returns
	 */
	public static toBankAccountBalanceRecord = (records: IBanking.BankAccountBalanceDailyRecord[]): IBanking.BankAccountBalanceRecord[] => {
		const foundKeys = new Map<string, number>();
		const balances: Map<string, Partial<IBanking.BankAccountBalanceRecord>> = records.reduce((acc, record) => {
			const key = dayjs.utc(record.date).format("YYYY-M");
			const month = Number(dayjs.utc(record.date).format("M"));
			const year = Number(dayjs.utc(record.date).format("YYYY"));
			foundKeys.set(key, (foundKeys.get(key) || 0) + 1);
			let newBalance: Partial<IBanking.BankAccountBalanceRecord> = {
				year,
				month,
				balance: record.current,
				bank_account_id: record.bank_account_id,
				currency: record.currency,
				created_at: record.created_at,
				updated_at: record.updated_at
			};
			const existingBalance: Partial<IBanking.BankAccountBalanceRecord> = acc.get(key) || newBalance;
			acc.set(key, { ...existingBalance, balance: currency(existingBalance.balance ?? 0).add(record.current).value });
			return acc;
		}, new Map<string, Partial<IBanking.BankAccountBalanceRecord>>());

		return Array.from(balances.values()).map(balance => ({
			...balance,
			balance: currency(balance.balance ?? 0).divide(foundKeys.get(`${balance.year}-${balance.month}`) || 1).value
		})) as IBanking.BankAccountBalanceRecord[];
	};

	public static findForDates = async (bankAccountId: string, startDate: Date, endDate: Date): Promise<BankAccountBalanceDaily[]> => {
		return await db<Record>(BankAccountBalanceDaily.TABLE)
			.where({ bank_account_id: bankAccountId })
			.andWhere("date", ">=", startDate)
			.andWhere("date", "<=", endDate)
			.then(records => records.map(record => new BankAccountBalanceDaily(record)));
	};
}

export default BankAccountBalanceDaily;
