import type { Knex } from "knex";
import { Mapper } from "src/api/v1/modules/businesses/mapper";
import { SUBROLES } from "../constants/roles.constant";

export type MapperDefinition = {
	preValidate?: (mapper: Mapper) => Promise<void>; //Throw on validation failure
	postValidate?: (mapper: Mapper) => Promise<void>; //Throw on validation failure
	tables: Record<string, MapperTable>;
};
export type MapperTable = {
	order: number;
	checkSafeInsert?: (mapper: Mapper, mappedFields: MapperField[]) => Promise<void>;
	validate?: (mapper: Mapper, mappedFields: MapperField[]) => Promise<void> | void;
	process?: (mapper: Mapper, mappedFields: MapperField[]) => Promise<void>;
	prefill?: Record<string, Record<string, (mapper: Mapper) => unknown>>;
	fields: MapperField[];
	// Build an onConflict clause for this table
	onConflict?: (builder: Knex.QueryBuilder) => Knex.QueryBuilder<any, any>;
};

export type MapperField<T = any> = {
	column: string | any; // column in db
	table: string;
	// Optional fully-qualified path for resolution, e.g. "rel_business_customer_monitoring.metadata.tin"
	// When provided, resolution uses this path (supports dot notation), otherwise falls back to table/column rules
	pathKey?: string;
	description?: string;
	alternate?: string[]; //alternate lookup keys
	count?: number; //max # that can be here, default is 1
	isDefault?: boolean; //when true, this will be the default field to map to if no other field is found
	required?: boolean; //When true, this key must have a match to be valid
	value?: T; //When set, the value that is mapped
	isReadonly?: boolean; //when true, field can not be updated
	providedKey?: string; //the key that was provided in the payload -- "column" will be the db column that matches
	reason?: string; //A reason why this field was rejected
	private?: boolean; //when true, cannot be used in a user-provided payload
	concat?: boolean; //when true, combine all these values together into a single json object
	dataType?: "json" | "string" | "number" | "date" | "boolean";
	isSensitive?: boolean; //when true, the value should be masked when output
	validate?: (mapper: Mapper, field: MapperField<T>) => Promise<void>; //When set, a function to validate the value being  set
	sanitize?: (mapper: Mapper, value: T) => Promise<T>; //When set, a function to sanitize the value being set to a new value;
	model_field?: string; //the ai model field
	previousValue?: T; // the previous value of this field
};

export type MapperFieldJSON<T = any> = {
	column: string;
	description?: string;
	required?: boolean;
	value: T | undefined;
	providedKey?: string;
	reason?: string;
	previousValue?: T | null;
};

export type ApplicantMapperEgg = {
	send_invitation: string;
	applicant_first_name: string;
	applicant_last_name: string;
	applicant_email: string;
	generate_invite_link?: boolean;
	applicant_subrole_code?: typeof SUBROLES.OWNER | typeof SUBROLES.USER;
};
