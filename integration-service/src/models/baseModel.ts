import { ERROR_CODES, getEnumKeyByValue } from "#constants";
import { db } from "#helpers/knex";
import type { Any, AnySerialized, AnyUnserialized, Egg, Stored } from "#types/eggPattern";
import type { UUID } from "crypto";
import { StatusCodes } from "http-status-codes";
import type { Knex } from "knex";
import { type PaginatedResponse, type PaginationOptions, type Serialized } from "../types";

/* A bare-bones class that can be extended to create models for interacting with the database, makes extensive use of the Egg Pattern */

export abstract class BaseModel<RecordType> {
	public static readonly PAGE_SIZE = 50;
	public static readonly TABLE = "" as string;
	public static readonly DEFAULT_ORDER: string = "created_at";
	public readonly REMOVE_COLUMNS = [] as unknown as keyof RecordType[];
	public static readonly ID_COLUMN = "id";
	public static readonly ERROR_CLASS = Error;

	// Fields that are serialized to a string when returned by the class but kept as numbers in the DB
	public static readonly serializedFields: Record<string, any> = {};

	protected record: Stored<RecordType>;
	protected serialized: Serialized<Stored<RecordType>>;

	constructor(record: Stored<RecordType>) {
		const ctor = this.constructor as typeof BaseModel;

		this.record = record;
		this.serialized = ctor.serialize(record);
	}

	// We use "this" as a type constraint for the class constructor
	public static async getById<T extends BaseModel<RecordType>, RecordType>(
		this: { new (arg: RecordType): T; isSerialized: (record: any) => boolean; deserialize: (record: any) => RecordType; TABLE: string; ERROR_CLASS: new (...args: any[]) => Error },
		id: UUID
	): Promise<T> {
		try {
			const record = await db(this.TABLE).select("*").where({ id }).limit(1).first();
			if (record) {
				return new this(record); // Use "this" to create a new instance
			}
			throw new Error("Not found"); // bubbles down to catch
		} catch (ex) {
			throw new this.ERROR_CLASS("Could not find record", null, StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
		}
	}

	public get() {
		return this.serialized;
	}

	/**
	    Get the serialized record, but remove any columns that are in REMOVE_COLUMNS 
        This is what should be called when returning to an API.
        @returns Partial<Serialized<RecordType>> : The serialized record, but with any columns that are in REMOVE_COLUMNS removed
    */
	public toApiResponse(): Partial<Serialized<RecordType>> {
		return Object.keys(this.serialized).reduce(
			(acc, key) => {
				if (!(this.REMOVE_COLUMNS as unknown as string[]).includes(key)) {
					acc[key] = this.serialized[key];
				}
				return acc;
			},
			{} as Partial<Serialized<RecordType>>
		);
	}

	public getRecord() {
		return this.record;
	}

	public set(record) {
		const ctor = this.constructor as typeof BaseModel;
		this.record = record;
		this.serialized = ctor.serialize(record);
	}

	public static async create<T extends BaseModel<RecordType>, RecordType>(
		this: {
			new (arg: Stored<RecordType>): T;
			isSerialized: (record: any) => boolean;
			deserialize: (record: any) => Egg<RecordType>;
			TABLE: string;
			ERROR_CLASS: new (...args: any[]) => Error;
		},
		egg: Egg<RecordType>
	): Promise<T> {
		if (this.isSerialized(egg)) {
			egg = this.deserialize(egg);
		}
		const record = await db(this.TABLE).insert(egg).returning("*");
		if (record?.[0]) {
			return new this(record[0]);
		}
		throw new this.ERROR_CLASS("Could not create record", null, StatusCodes.BAD_REQUEST, ERROR_CODES.UNKNOWN_ERROR);
	}

	public static isSerialized<RecordType>(
		this: { new (arg: RecordType): BaseModel<RecordType>; serializedFields: typeof BaseModel.serializedFields },
		record: Any<RecordType>
	): record is AnySerialized<RecordType> {
		return Object.keys(this.serializedFields).some(key => Object.hasOwn(record as object, key) && typeof record[key] === "string");
	}

	public static isRecord<RecordType extends Object, EggType extends Object>(record: RecordType | EggType): record is RecordType {
		return Object.hasOwn(record, "id") && Boolean((record as any).id);
	}

	public static deserialize<RecordType>(serializedRecord: Serialized<Egg<RecordType>>): Egg<RecordType>;
	public static deserialize<RecordType>(serializedRecord: Serialized<RecordType>): RecordType;
	/**
	 * Take a serialized record and deserialize it
	 * Turns keys into associated enum values for storing in DB
	 * @param Serialized<serializedRecord>
	 * @returns Record|Egg
	 */
	public static deserialize<RecordType>(serializedRecord: AnySerialized<RecordType>): AnyUnserialized<RecordType> {
		// Iterate through each key in an object and check if it's a serializedField
		return Object.keys(this.serializedFields).reduce(
			(acc, key) => {
				if (Object.hasOwn(serializedRecord, key) && typeof serializedRecord[key] === "string") {
					const e = this.serializedFields[key];
					acc[key] = e[serializedRecord[key]] ?? 0;
				}
				return acc;
			},
			{ ...serializedRecord } as AnyUnserialized<RecordType>
		);
	}
	public static serialize<RecordType>(record: RecordType): Serialized<RecordType>;
	public static serialize<EggType>(record: EggType): Serialized<EggType>;
	public static serialize<RecordType extends EggType, EggType>(record: RecordType | EggType): Serialized<RecordType | EggType> {
		return Object.keys(this.serializedFields).reduce(
			(acc, key) => {
				if (Object.hasOwn(record as object, key) && typeof record[key] === "number") {
					const e = this.serializedFields[key];
					acc[key] = getEnumKeyByValue(e, record[key]) ?? e.first();
				}
				return acc;
			},
			{ ...record } as Serialized<RecordType | EggType>
		);
	}

	public static async findByField<T extends BaseModel<RecordType>, RecordType>(
		this: { new (arg: Stored<RecordType>): T; TABLE: string; paginate: typeof BaseModel.paginate },
		fields: Partial<RecordType>,
		paginationOptions: PaginationOptions<RecordType>
	): Promise<PaginatedResponse<T, RecordType>> {
		const query = db(this.TABLE).select("*").where(fields);
		const [records, pagination] = await this.paginate<RecordType>(query, paginationOptions);
		return [records.map(record => new this(record)), pagination];
	}

	public static async getAllPaginated<T extends BaseModel<RecordType>, RecordType>(
		this: { new (arg: Stored<RecordType>): T; TABLE: string; paginate: typeof BaseModel.paginate },
		paginationOptions: PaginationOptions<RecordType>
	): Promise<PaginatedResponse<T, RecordType>> {
		const query = db(this.TABLE).select("*");
		const [records, pagination] = await this.paginate<RecordType>(query, paginationOptions);
		return [records.map(record => new this(record)), pagination];
	}

	public async updateMetadata<T extends BaseModel<RecordType>, RecordType>(metadata: Record<string, any>, column: string = "metadata"): Promise<T> {
		return this.update({ [column]: db.raw(`COALESCE(??::jsonb, '{}'::jsonb) || ?::jsonb`, [column, JSON.stringify(metadata)]) });
	}

	/**
	 * Protected to limit use to child classes
	 * @param this
	 * @param id
	 * @param updatedRecord
	 * @returns
	 */
	protected async update<T extends BaseModel<RecordType>, RecordType>(updatedRecord: Stored<RecordType>): Promise<T> {
		const ctor = this.constructor as typeof BaseModel;
		const record = this.getRecord();
		if (!record?.[ctor.ID_COLUMN]) {
			throw new ctor.ERROR_CLASS(`Record has no value for ${ctor.ID_COLUMN}`, updatedRecord);
		}

		const update = await db(ctor.TABLE)
			.update(updatedRecord)
			.where({ [ctor.ID_COLUMN]: record[ctor.ID_COLUMN] })
			.returning("*");

		if (update?.[0]) {
			this.set(update[0]);
			return this as unknown as T;
		}

		throw new ctor.ERROR_CLASS("Could not update record", this.get());
	}

	protected async delete<T extends BaseModel<RecordType>, RecordType>(this: T): Promise<boolean> {
		const ctor = this.constructor as typeof BaseModel;
		const record = this.getRecord();
		if (!record?.[ctor.ID_COLUMN]) {
			throw new ctor.ERROR_CLASS(`Record has no value for ${ctor.ID_COLUMN}`, record);
		}

		const res = await db(ctor.TABLE)
			.where({ [ctor.ID_COLUMN]: record[ctor.ID_COLUMN] })
			.del();

		if (record?.[0]) {
			this.set(null);
			return true;
		}

		throw new ctor.ERROR_CLASS("Could not delete record", this.get());
	}

	public static async paginate<RecordType>(query: Knex.QueryBuilder, pagination: PaginationOptions<RecordType>): Promise<[Stored<RecordType>[], PaginationOptions<RecordType>]> {
		let { page, pageSize, orderBy, orderDirection } = pagination;
		const limitedQuery = query.clone().clearOrder().offset(0, { skipBinding: true });
		if (page < 1 && Math.floor(page) !== page) {
			page = 0;
			pagination.page = page;
		}
		if (pageSize !== "all" && (!pageSize || (pageSize < 1 && Math.floor(pageSize) !== pageSize))) {
			pageSize = this.PAGE_SIZE;
			pagination.pageSize = pageSize;
			limitedQuery.limit(pageSize, { skipBinding: true }).offset(page * pageSize, { skipBinding: true });
		}
		if (!orderBy) {
			orderBy = this.DEFAULT_ORDER as keyof RecordType;
			pagination.orderBy = orderBy;
		}
		if (orderDirection !== "asc") {
			orderDirection = "desc";
			pagination.orderDirection = orderDirection;
		}

		const [records, count] = await Promise.all([limitedQuery.orderBy(orderBy, orderDirection), query.clone().clearSelect().clearOrder().offset(0, { skipBinding: true }).count().first()]);
		if (count) {
			pagination.count = +count.count;
		}
		return [records, pagination];
	}
	public static unwrap<T, RecordType>(record: T): AnySerialized<RecordType>;
	public static unwrap<T, RecordType>(record: T[]): AnySerialized<RecordType>[];
	/***
	 * Given an instance of the class, return the safe serialized record
	 * @param record : A record or array of records
	 * @param returnSafe : Whether to return the safe serialized record or the full serialized record
	 * @returns AnySerialized<RecordType> | AnySerialized<RecordType>[] : The serialized record or array of records
	 */
	public static unwrap<T extends BaseModel<RecordType>, RecordType>(record: T | T[], returnSafe = true): AnySerialized<RecordType> | AnySerialized<RecordType>[] {
		// Make sure we're not going to mutate the original record
		if (!record) {
			throw new Error("Record is null");
		}
		if (Array.isArray(record)) {
			return record.map(r => JSON.parse(JSON.stringify(returnSafe ? r.toApiResponse() : r.get())));
		}
		return JSON.parse(JSON.stringify(returnSafe ? record.toApiResponse() : record.get()));
	}
}
