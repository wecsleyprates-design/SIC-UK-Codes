import { db } from "#helpers/knex";
import { StatusCodes } from "http-status-codes";
import { BankingApiError } from "../error";
import { ERROR_CODES } from "#constants";
import { logger } from "#helpers/logger";
import dayjs from "dayjs";

type Record = any;
type Egg = any;
type Case = any;

/**
 * Abstract class to serve as parent for all Banking models
 */

abstract class BankingBase {
	protected record: Record;
	protected static readonly TABLE: string = "";
	protected static readonly ID_FIELD: keyof Record = "id";
	/* set by constructor -- so they can be referenced both statically and non-statically */
	protected readonly TABLE: string;
	protected readonly ID_FIELD: keyof Record;
	constructor(record: Record) {
		this.record = record;
		this.TABLE = (this.constructor as typeof BankingBase).TABLE;
		this.ID_FIELD = (this.constructor as typeof BankingBase).ID_FIELD;
		if (!this.TABLE || !this.ID_FIELD) throw new Error("TABLE and ID_FIELD must be set on the class");
	}

	/** Create a record from an Egg (Alias of 'create') */
	public static async fromEgg<T extends BankingBase>(egg): Promise<T> {
		return this.create<T>(egg);
	}
	/** Create a record from an Egg */
	public static async create<T extends BankingBase>(egg: Egg): Promise<T> {
		const records = (await db<Record>(this.TABLE).insert(egg).returning("*")) as Record[];
		const record = records[0];
		return new (this as any)(record);
	}

	public static async fromEggs(eggs: Egg[]): Promise<any[]> {
		return Promise.all(eggs.map(egg => this.fromEgg(egg)));
	}

	public static async getById<T extends BankingBase>(id: typeof BankingBase.ID_FIELD): Promise<T> {
		const record = await db<Record>(this.TABLE).where({ [this.ID_FIELD]: id });

		if (!record) {
			throw new BankingApiError(
				`Record not found for id=${id as string}`,
				StatusCodes.NOT_FOUND,
				ERROR_CODES.NOT_FOUND
			);
		}
		return new (this as any)(record);
	}

	public getRecord(): Record {
		return this.record;
	}

	public async update(newRecord: Partial<Record>): Promise<this> {
		const field = this.ID_FIELD as string;
		if (!newRecord[field]) {
			logger.error(`Passed record: ${JSON.stringify(newRecord)} missing id field: ${field}`);
			throw new Error(`Passed record missing value for id field: ${field}`);
		}
		const records = await db<Record>(this.TABLE)
			.where({ [this.ID_FIELD]: this.record[this.ID_FIELD] })
			.update({ ...this.record, ...newRecord })
			.returning("*");
		const updated = records[0];
		this.record = updated;
		return this;
	}

	public async delete(): Promise<void> {
		await db<Record>(this.TABLE)
			.where({ [this.ID_FIELD]: this.record[this.ID_FIELD] })
			.delete();
	}

	static async purgeByAccountId(bankAccountId: string): Promise<void> {
		await db<Record>(this.TABLE).where({ bank_account_id: bankAccountId, deposit_account: false }).delete();
	}

	public static async findRelBankAccountByTaskId<T extends BankingBase>(
		taskId: string,
		opts?: { deposite: boolean; businessId: string; is_additional_account: boolean }
	): Promise<T[]> {
		const plaidAccountRecords = db<Record>({ rtba: "integration_data.rel_task_bank_account" })
			// Intentionally selecting NULL for platform_id here becuase of the union at the end of this function
			// We don't actually utilize platform_id here and fetching the platform_id from data_connections will increase query time
			.select("ba.*", db.raw("NULL AS platform_id"))
			.join({ ba: "integration_data.bank_accounts" }, db.raw("ba.id = ANY(rtba.bank_account_id)"))
			.where({ "rtba.business_integration_task_id": taskId });

		let depositAccountRecords: any;
		if (opts?.deposite) {
			depositAccountRecords = db<Record>({ rec: this.TABLE })
				.select("rec.*", "con.platform_id")
				.join({ task: "integrations.data_business_integrations_tasks" }, "task.id", "rec.business_integration_task_id")
				.join({ con: "integrations.data_connections" }, "con.id", "task.connection_id")
				.where({ "con.business_id": opts.businessId, deposit_account: true });
		}

		let additionalAccountRecords: any;
		if (opts?.is_additional_account) {
			additionalAccountRecords = db<Record>({ rec: this.TABLE })
				.select("rec.*", "con.platform_id")
				.join({ task: "integrations.data_business_integrations_tasks" }, "task.id", "rec.business_integration_task_id")
				.join({ con: "integrations.data_connections" }, "con.id", "task.connection_id")
				.where({ "con.business_id": opts.businessId, is_additional_account: true });
		}

		const records = await db.unionAll([plaidAccountRecords, depositAccountRecords, additionalAccountRecords], true);
		return records.map(record => new (this as any)(record));
	}

	public static async findByBusinessId<T extends BankingBase>(businessId: string): Promise<T[]> {
		const records = await db<Record>({ rec: this.TABLE })
			.select("rec.*", "con.platform_id")
			.join({ task: "integrations.data_business_integrations_tasks" }, "task.id", "rec.business_integration_task_id")
			.join({ con: "integrations.data_connections" }, "con.id", "task.connection_id")
			.where({ "con.business_id": businessId });
		return records.map(record => new (this as any)(record));
	}

	public static async findByTaskIds<T extends BankingBase>(taskIds: string[]): Promise<T[]> {
		const records = await db<Record>({ rec: this.TABLE })
			.select("rec.*")
			.whereIn("rec.business_integration_task_id", taskIds);
		return records.map(record => new (this as any)(record));
	}

	public static async findByTaskId<T extends BankingBase>(taskId: string): Promise<T[]> {
		const records = await db<Record>({ rec: this.TABLE })
			.select("rec.*")
			.where({ "rec.business_integration_task_id": taskId });
		return records.map(record => new (this as any)(record));
	}

	public static async findByConnectionId<T extends BankingBase>(connectionId: string): Promise<T[]> {
		const records = await db<Record>({ rec: this.TABLE })
			.select("rec.*")
			.join({ task: "integrations.data_business_integrations_tasks" }, "task.id", "rec.business_integration_task_id")
			.where({ "task.connection_id": connectionId });
		return records.map(record => new (this as any)(record));
	}

	public static async findByCaseId<T extends BankingBase>(caseId: string): Promise<T[]> {
		const records = await db<Record>({ rec: this.TABLE })
			.select("rec.*")
			.join({ task: "integrations.data_business_integrations_tasks" }, "task.id", "rec.business_integration_task_id")
			.join({ trigger: "integrations.business_score_triggers" }, "trigger.id", "task.business_score_trigger_id")
			.join({ cases: "public.data_cases" }, "cases.id", "trigger.case_id")
			.where({ "cases.id": caseId });
		return records.map(record => new (this as any)(record));
	}

	public static async findByBusinessAndCustomerId<T extends BankingBase>(
		businessId: string,
		customerId: string | null
	): Promise<T[]> {
		const records = await db<Record>({ rec: this.TABLE })
			.select("rec.*", "con.platform_id")
			.join({ task: "integrations.data_business_integrations_tasks" }, "task.id", "rec.business_integration_task_id")
			.join({ con: "integrations.data_connections" }, "con.id", "task.connection_id")
			.join({ trigger: "integrations.business_score_triggers" }, "trigger.id", "task.business_score_trigger_id")
			.where({ "trigger.customer_id": customerId, "con.business_id": businessId });
		return records.map(record => new (this as any)(record));
	}

	static async purgeByConnectionId(connectionId: string): Promise<void>;
	static async purgeByConnectionId(connectionId: string, deleteDepositAccount: boolean): Promise<void>;
	static async purgeByConnectionId(connectionId: string, deleteDepositAccount?: boolean): Promise<void> {
		const query = db<Record>(this.TABLE)
			.using(["integrations.data_business_integrations_tasks"])
			.whereRaw(`integrations.data_business_integrations_tasks.id = ${this.TABLE}.business_integration_task_id`)
			.andWhere("integrations.data_business_integrations_tasks.connection_id", connectionId);

		if (deleteDepositAccount !== undefined) {
			query.andWhere(`${this.TABLE}.deposit_account`, deleteDepositAccount);
		}

		await query.del();
	}

	public static async findByBankAccountId<T extends BankingBase>(bankAccountId: string): Promise<T[]> {
		const records = await db<Record>(this.TABLE).where({ bank_account_id: bankAccountId });
		return records.map(record => new (this as any)(record));
	}

	/**
	 * Unwrap BankingBase objects to plain Records
	 * @param records | Array<T extends BankingBase> | T extends BankingBase
	 * @returns Record[] | Record
	 */
	static unwrap<T extends BankingBase>(records: T[] | T): Record[] | Record {
		if (Array.isArray(records)) {
			return records.map(record => record.getRecord());
		}
		return records.getRecord();
	}
}

export default BankingBase;
