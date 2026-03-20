import { ERROR_CODES } from "#constants";
import { logger } from "#helpers/logger";
import { MapperDefinition, MapperField, type MapperFieldJSON, type MapperTable } from "#types/mapper";
import { HttpStatusCode } from "axios";
import Fuse, { IFuseOptions } from "fuse.js";
import { v4 as uuid } from "uuid";
import { BusinessApiError } from "./error";
import { VALIDATION_ERRORS } from "#constants/index";
import type { Knex } from "knex";
import type { UUID } from "crypto";

type MatchResponse = {
	required: MapperField[];
	mapped: { [keyof: string]: MapperField | MapperFieldJSON };
	rejected: Array<MapperField | MapperFieldJSON>;
};
export class MapperError extends Error {
	field?: MapperField;
	constructor(message: string, field?: MapperField) {
		super(message);
		this.field = field;
		this.name = "MapperError";
	}
}
export const isMapperError = (error: unknown): error is MapperError => {
	return Error.isError(error) && error.name === "MapperError";
};

export class AdditionalPropertyMapperError extends MapperError {
	additionalProperty?: Record<string, any>;
	constructor(message: string, field?: MapperField, additionalProperty?: Record<string, any>) {
		super(message, field);
		this.additionalProperty = additionalProperty;
		this.name = "AdditionalPropertyMapperError";
	}
}
export const isAdditionalPropertyMapperError = (error: unknown): error is AdditionalPropertyMapperError => {
	return Error.isError(error) && error.name === "AdditionalPropertyMapperError";
};

type ConstructorParams = {
	runId?: UUID;
	threshold?: number;
	knexInstance: Knex;
};

export abstract class Mapper {
	protected mapperDefinition: MapperDefinition;
	protected input: Map<string, any>;
	protected runId: string;
	protected threshold: number;
	protected fuse: Fuse<MapperField>;
	protected fields: MapperField[];
	protected mappedFields: MapperField[] = [];
	protected additionalMetadata: Record<string, any> = {};
	protected warnings: string[] = [];
	private knexInstance: Knex;
	private auth: string | undefined;
	private matches: MatchResponse | undefined;

	constructor(mapperDefinition: MapperDefinition, input: Map<string, any>, params: ConstructorParams) {
		this.mapperDefinition = mapperDefinition;
		this.input = input;
		this.runId = params?.runId ?? uuid();
		this.threshold = params?.threshold ?? 0.2;
		this.knexInstance = params?.knexInstance;
		const options: IFuseOptions<MapperField> = {
			threshold: this.threshold, // Adjust the threshold to control the fuzziness
			includeMatches: true,
			includeScore: true,
			keys: ["column", { name: "alternate", weight: 0.95 }, { name: "model_field", weight: 0.98 }]
		};

		const fields = Object.entries(mapperDefinition.tables).reduce((acc, [tableName, table]) => {
			acc.push(...table.fields.map(field => ({ ...field, table: tableName })));
			return acc;
		}, [] as MapperField[]);

		const fuse = new Fuse<MapperField>(
			fields.filter(field => field.private !== true),
			options
		);
		this.fuse = fuse;
		this.fields = fields;
	}
	/* Sanitize the metadata for output */
	public sanitizeMetadata() {
		const metadata: any = { warnings: this.getWarnings(), ...this.getAdditionalMetadata()};
		if (metadata.rel_business_customer_monitoring) {
			metadata.business_customer = { ...metadata.rel_business_customer_monitoring };
		}
		delete metadata.auth;
		delete metadata.titles;
		delete metadata.rel_business_customer_monitoring;
		delete metadata.originalState;
		return metadata;
	}
	public setAuth(auth: string): void {
		this.auth = auth;
	}
	public addMappedField(field: MapperField): MapperField[] {
		this.mappedFields.push(field);
		return this.mappedFields;
	}

	/**
	 * Get the publically accessible fields for this Mapper
	 * @returns 
	 */
	public getPossibleFields(): MapperField[] {
		return this.fields.filter(f => !f.private);
	}

	/**
	 * Get the additional metadata as a reference to the internal metadata object
	 * @returns The additional metadata
	 */
	public getAdditionalMetadata(): any {
		return this.additionalMetadata;
	}
	public getRunId(): string {
		return this.runId;
	}
	public addAdditionalMetadata(metadata: any): void {
		this.additionalMetadata = { ...this.additionalMetadata, ...metadata };
	}
	public setAdditionalMetadata(metadata: any): any {
		this.additionalMetadata = metadata;
		return this.additionalMetadata;
	}
	public getMappedFields(): MapperField[] {
		return this.mappedFields;
	}
	public searchColumn(columnToFind: string): string | null {
		if (columnToFind.startsWith("custom:")) {
			return columnToFind; // Return the exact match
		}
		const result = this.fuse.search(columnToFind);
		if (result && result[0]) {
			return result[0].item.column;
		}
		return this.getDefaultField()?.column || null;
	}
	public getFieldForColumn(column: string, table?: string): MapperField {
		const field = this.fields.find(f => {
			const columnMatches = f.column instanceof RegExp ? f.column.test(column) : f.column === column;
			return columnMatches && (table ? f.table === table : true);
		});

		if (!field) {
			throw new Error("Cannot fetch field for column " + column + " in table " + table);
		}

		return field;
	}

	public getMappedFieldForColumn<T = unknown>(column: string, table: string): MapperField<T> | undefined {
		return this.getMappedFields().find(f => {
			return f.column === column && (table ? f.table === table : true);
		}) as MapperField<T> | undefined;
	}
	public getMappedValueForColumn<T = unknown>(column: string, table: string, fallbackValue?: T): T | undefined {
		return this.getMappedFieldForColumn<T>(column, table)?.value ?? fallbackValue;
	}

	/**
	 * Get a raw input value by key (before mapping/sanitization)
	 * Useful when sanitize functions need to reference other fields that may not be mapped yet
	 */
	public getInputValue<T = unknown>(key: string): T | undefined {
		return this.input.get(key) as T | undefined;
	}

	public getDefaultField(): MapperField {
		const field = this.fields?.find(f => f.isDefault);
		if (!field) {
			throw new Error("no default field found in mapper fields.");
		}
		return field;
	}

	/**
	 *
	 * @returns A JSON object with the mapped fields
	 * { name:{
	 * 	"column": "name",
	 * 	"description": "The name of the business",
	 * 	"required": true,
	 * 	"value": "John Doe"
	 * }, ... }
	 */
	public toApiResponse(fields?: MapperField[]): Record<string, MapperFieldJSON> {
		if (!fields) {
			fields = this.getMappedFields();
		}
		return fields.reduce((acc, field) => {
			const fieldName = field.providedKey ?? field.column;
			acc[fieldName] = this.serializeField(field);
			return acc;
		}, {});
	}

	public addWarning(warning: string): void {
		this.warnings.push(warning);
	}
	public getWarnings(): string[] {
		return this.warnings;
	}

	public async validate() {
		if (!this.matches) {
			await this.match();
		}
		if (!this.matches) {
			throw new Error("No match output --- ensure .match() is called before .validate()");
		}
		return this.matches.rejected.length === 0 && this.matches.required.length === 0;
	}

	public async match(): Promise<MatchResponse> {
		if (!this.fields) {
			throw new Error("No fields defined for this mapper.");
		}

		const requiredFields = this.fields.filter(field => field.required);
		const required: MapperField[] = [];
		const rejected: MapperField[] = [];
		const mapped: { [key: string]: MapperField } = {};
		const foundFields: MapperField[] = [];
		const out = { required, mapped, rejected };

		for (const key of this.input.keys()) {
			const value = this.input.get(key);

			// Normal field mapping
			const matchedColumn = this.searchColumn(key);
			if (matchedColumn) {
				const field = this.getFieldForColumn(matchedColumn) || this.getDefaultField();
				const matchedField = { ...field, value, providedKey: key };
				if (matchedColumn.startsWith("custom:")) {
					matchedField.column = matchedColumn;
				}

				try {
					if (matchedField.isReadonly === true) {
						out.rejected.push({
							...this.serializeField(matchedField),
							providedKey: key,
							reason: "Field cannot be updated"
						} as MapperField);
						continue;
					}

					if (matchedField?.sanitize) {
						try {
							matchedField.value = await matchedField.sanitize(this, value);
						} catch (_error) {
							throw new Error("Sanitization failed");
						}
					}

					if (matchedField.validate) {
						await matchedField.validate(this, matchedField);
					}

					if (matchedField.concat !== true) {
						if (foundFields.filter(f => f.column === matchedField.column).length >= (matchedField.count || 1)) {
							out.rejected.push({
								...this.serializeField(matchedField),
								providedKey: key,
								reason: `Maximum count of ${matchedField.count || 1} exceeded`
							} as MapperField);
							continue;
						}
					}

					out.mapped[key] = matchedField;
					foundFields.push(matchedField);
				} catch (ex: unknown) {
					const errorMessage =
						VALIDATION_ERRORS[key as keyof typeof VALIDATION_ERRORS] ??
						(ex as Error).message ??
						`Validation failed for "${key}".`;

					out.rejected.push({
						...this.serializeField(matchedField),
						providedKey: key,
						reason: errorMessage
					} as MapperField);
				}
			}
		}

		// Store a copy of mapped fields and custom fields separately
		this.mappedFields = [...foundFields];

		// Validation Phase
		const tables = [...new Set(this.getMappedFields().map(field => field.table))];
		const mapperDefinition = this.mapperDefinition;

		const preValidateError = await this.executeValidation(mapperDefinition.preValidate);
		if (preValidateError) {
			out.rejected.push({ column: "global", table: "validation", reason: preValidateError } as MapperField);
			this.matches = out;
			return this.matches;
		}

		if (this.mapperDefinition && this.mapperDefinition.tables) {
			for (const table of tables) {
				const tableDefinition = mapperDefinition.tables[table];
				if (typeof tableDefinition?.validate === "function") {
					try {
						await tableDefinition.validate(
							this,
							this.getMappedFields().filter(f => f.table === table)
						);
					} catch (ex) {
						if (ex instanceof AdditionalPropertyMapperError) {
							out.rejected.push({
								column: ex.field?.column,
								providedKey: ex.field?.providedKey,
								value: ex.field?.value,
								reason: (ex as Error).message,
								...(ex.additionalProperty ? { _additionalProperties: ex.additionalProperty } : {})
							} as MapperField);
						} else if (ex instanceof MapperError) {
							out.rejected.push({
								column: ex.field?.column,
								providedKey: ex.field?.providedKey,
								value: ex.field?.value,
								reason: (ex as Error).message
							} as MapperField);
						} else {
							out.rejected.push({
								column: table,
								providedKey: table,
								reason: (ex as Error).message
							} as MapperField);
						}
					}
				}
			}
		}

		// Post-validation processing
		const postValidateError = await this.executeValidation(mapperDefinition.postValidate);
		if (postValidateError) {
			out.rejected.push({ column: "global", table: "postvalidate", reason: postValidateError } as MapperField);
		}

		out.required = requiredFields
			.filter(field => !foundFields.map(f => f.column).includes(field.column))
			.map(f => this.serializeField(f) as MapperField);

		this.matches = out;
		return this.matches;
	}

	/* Execute the mapper function against the provided body */
	public async execute() {
		const mapper: Mapper = this;
		if (!this.matches) {
			await this.match();
		}
		if (!this.matches) {
			throw new Error("No match output --- ensure .match() is called before .execute()");
		}
		const { mapped, rejected, required } = this.matches;

		if (rejected?.length || required.length) {
			const errors = [
				...rejected.map(rejectedField => {
					const error: any = {
						column: rejectedField.column,
						providedKey: rejectedField.providedKey,
						value: rejectedField.value,
						reason: rejectedField.reason
					};
					// Include any additional properties from AdditionalPropertyMapperError
					const rejectedFieldAny = rejectedField as any;
					if (rejectedFieldAny._additionalProperties) {
						Object.assign(error, rejectedFieldAny._additionalProperties);
					}
					return error;
				}),
				...required.map(({ column, providedKey, value }) => ({
					column,
					providedKey,
					value,
					reason: `${column} is required`
				}))
			];

			throw new BusinessApiError(
				"Validation failed. Error details:",
				HttpStatusCode.BadRequest,
				ERROR_CODES.INVALID,
				errors
			);
		}

		// Create a Map of all the fields that were able to be mapped grouped by the table name
		const tableMap: Record<string, MapperField[]> = Object.entries(mapped).reduce((acc, [_key, field]) => {
			const { table } = field as MapperField;
			acc[table] = acc[table] || [];
			acc[table].push(field);
			return acc;
		}, {});
		//Order the table entries (keys) by mapperDefinition order & then iterate over them in that order
		const tableOrder: string[] = Object.keys(tableMap).sort(
			(a, b) => this.mapperDefinition.tables[a].order - this.mapperDefinition.tables[b].order
		);
		for (const table of tableOrder) {
			const fields = tableMap[table];
			if (fields) {
				const tableDefinition = mapper.mapperDefinition.tables[table];
				logger.debug(`Processing table ${table}`);
				if (tableDefinition.checkSafeInsert && typeof tableDefinition.checkSafeInsert === "function") {
					await tableDefinition.checkSafeInsert(mapper, fields);
				}

				if (tableDefinition && tableDefinition.prefill) {
					Object.entries(tableDefinition.prefill).forEach(([prefillTable, prefillFields]) => {
						if (!prefillFields) {
							return;
						}
						if (!tableOrder.includes(prefillTable)) {
							tableOrder.push(prefillTable);
						}
						tableMap[prefillTable] = tableMap[prefillTable] ?? [];
						Object.entries(prefillFields).forEach(([column, fn]) => {
							//don't re-write if it already exists
							const field = mapper.getFieldForColumn(column, prefillTable);
							if (field && !tableMap[prefillTable].find(c => c.column === column)) {
								tableMap?.[prefillTable]?.push({ ...field, value: fn(mapper) });
							}
						});
					});
				}

				if (!tableDefinition.process) {
					const sql = await this.executeInsert(tableDefinition, fields);
					this.addAdditionalMetadata({ [table]: sql });
				} else {
					await tableDefinition.process(this, fields);
				}
			}
		}
	}

	public async executeInsert(tableDefinition: MapperTable, fields: MapperField[]): Promise<unknown> {
		//is insert or update
		const table = fields[0].table as string;
		if (!table) {
			throw new Error("No table specified for fields");
		}
		const data: Record<string, unknown> = fields
			.filter(f => !!f.value)
			.reduce((acc, f) => {
				// Handle fields with concat == true
				if (f.concat && f.providedKey && f.dataType == "json") {
					// If the field should be concatenated, add its value to the existing value
					acc[f.column] = { ...(acc[f.column] || {}), ...{ [f.providedKey]: f.value } };
				} else {
					// Otherwise, just set the value
					acc[f.column] = f.value;
				}
				return acc;
			}, {});
		const queryBuilder = this.knexInstance(table).insert(data).returning("*");
		if (tableDefinition.onConflict) {
			tableDefinition.onConflict(queryBuilder);
		}
		const inserted = await queryBuilder;
		return inserted[0];
	}

	public setMatches(matches: MatchResponse) {
		this.matches = matches;
	}

	/**
	 * Get the auth token for this Mapper
	 * Must have been previously set with setAuth()
	 * Must never be used in a way that would expose the auth token to the public!
	 * @internal
	 * @returns The auth token
	 */
	public getAuth(): string | undefined {
		return this.auth;
	}

	private async executeValidation(fn?: (mapper: Mapper) => Promise<void>): Promise<string | void> {
		if (typeof fn === "function") {
			try {
				await fn(this);
			} catch (ex) {
				let reason = JSON.stringify(ex);
				if ((ex as Error).message) {
					reason = (ex as Error).message;
				}
				logger.error({ error: ex, reason }, `Error with mapper validator ${fn.name}: ${JSON.stringify(ex)}`);
				return reason;
			}
		}
	}

	/***
	 * Convert the internal MapperField to the MapperFieldJSON for Serialization to API responses
	 * @param field - The MapperField to serialize
	 * @returns The serialized MapperFieldJSON
	 */
	private serializeField<T = any>(
		field: MapperField<T>
	): MapperFieldJSON<T> {
		return {
			column: field.column,
			providedKey: field.providedKey,
			description: field.description,
			required: field.required,
			value: field.value,
			previousValue: field.previousValue
		};
	}
}
