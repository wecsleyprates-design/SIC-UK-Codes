import type { IntegrationPlatformId } from "#constants";
import type { Egg, Stored, StoredOnly } from "#types";
import type { UUID } from "crypto";
import type { PaymentProcessorStatus } from "../types/processor";
import { db } from "#helpers";
import type { Knex } from "knex";

export interface PaymentProcessor<T extends Record<string, any> = Record<string, any>> {
	id: StoredOnly<UUID>;
	customer_id: UUID; // Customer that owns this record
	name: string;
	status: PaymentProcessorStatus;
	platform_id: IntegrationPlatformId;
	metadata: T;
	created_at: StoredOnly<Date>;
	updated_at: StoredOnly<Date | null>;
	deleted_at: StoredOnly<Date | null>;
	created_by: UUID;
	updated_by: UUID;
	deleted_by: StoredOnly<UUID | null>;
}

export type RecordType<T extends Record<string, any> = Record<string, any>> = PaymentProcessor<T>;

export class PaymentProcessorRepositoryError extends Error {
	constructor(message?: string) {
		super(message);
		this.name = "PaymentProcessorRepositoryError";
	}
}

type Injectable = {
	db?: Knex;
};
export class PaymentProcessorRepository {
	public static readonly TABLE = "integration_data.payment_processors";
	public static readonly ID_COLUMN = "id";
	public static readonly ERROR_CLASS = PaymentProcessorRepositoryError;
	private readonly knex: Knex;

	constructor(args?: Injectable) {
		this.knex = args?.db ?? db;
	}

	public async create(egg: Egg<PaymentProcessor>): Promise<PaymentProcessor> {
		const record = await this.table().insert(egg).returning("*");
		if (record?.[0]) {
			return record[0];
		}
		throw new PaymentProcessorRepositoryError("Could not create payment processor record");
	}

	public async update(
		updatedRecord: Partial<Stored<RecordType>> & Pick<Stored<RecordType>, "id">
	): Promise<RecordType> {
		const record = await this.table()
			.update(updatedRecord)
			.where(PaymentProcessorRepository.ID_COLUMN, updatedRecord.id)
			.returning("*");
		if (record?.[0]) {
			return record[0];
		}
		throw new PaymentProcessorRepositoryError("Could not update payment processor record");
	}

	public async get(processorId: UUID): Promise<RecordType> {
		const record = await this.table().where(PaymentProcessorRepository.ID_COLUMN, processorId).first();
		if (record) {
			return record;
		}
		throw new PaymentProcessorRepositoryError("Could not find payment processor record " + processorId);
	}

	public async delete(processorId: UUID, deleted_by: UUID): Promise<RecordType> {
		const currentRecord = await this.get(processorId);
		return this.update({
			id: currentRecord.id,
			deleted_at: new Date() as StoredOnly<Date | null>,
			deleted_by: deleted_by as StoredOnly<UUID | null>
		});
	}

	public async findByFields(
		fields: Partial<Stored<RecordType>>,
		includeDeleted: boolean = false
	): Promise<Stored<RecordType>[]> {
		const records = await this.table()
			.where(fields)
			.andWhere(includeDeleted ? {} : { deleted_at: null });
		if (records) {
			return records;
		}
		throw new PaymentProcessorRepositoryError("Could not find payment processor records");
	}

	public async findByCustomerId(customerId: UUID, includeDeleted: boolean = false): Promise<RecordType[]> {
		const records = await this.table()
			.where({ customer_id: customerId })
			.andWhere(includeDeleted ? {} : { deleted_at: null });
		if (records) {
			return records;
		}
		throw new PaymentProcessorRepositoryError("Could not find payment processor records");
	}

	private table(): Knex.QueryBuilder {
		return this.knex(PaymentProcessorRepository.TABLE);
	}
}
