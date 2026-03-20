import type { Serialized, Stored, StoredOnly } from "#types/eggPattern";
import type { UUID } from "crypto";
import type { IJobRequest as JobRequestType } from ".";
import type { Knex } from "knex";
export const State = {
	UNKNOWN: 0,
	CREATED: 1,
	STARTED: 2,
	SUCCESS: 3,
	ERROR: 4
} as const;
export type StateKey = keyof typeof State;
export type State = (typeof State)[StateKey];

export interface IJob<T = Record<PropertyKey, any>> {
	business_id?: UUID | null;
	customer_id?: UUID | null;
	id: StoredOnly<UUID>;
	created_at: StoredOnly<Date | Knex.Raw<Date> | string>;
	started_at: StoredOnly<Date | string | Knex.Raw<Date> | null>;
	completed_at: StoredOnly<Date | string | Knex.Raw<Date> | null>;
	errored_at: StoredOnly<Date | string | Knex.Raw<Date> | null>;
	request_id: UUID; // JobRequest ID
	state: State;
	metadata?: T;
}
export interface IJobEnriched extends Serialized<IJob> {
	request: Serialized<Stored<JobRequestType>>;
}
