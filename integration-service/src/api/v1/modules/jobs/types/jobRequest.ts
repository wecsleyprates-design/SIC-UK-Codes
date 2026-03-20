import type { Serialized, StoredOnly } from "#types/eggPattern";
import type { UUID } from "crypto";
import { State, type StateKey } from "./index";

export const JobType = {
	UNKNOWN: 0,
	BULK_BUSINESS_IMPORT: 1
} as const;

export const JobTrigger = {
	UNKNOWN: 0,
	API: 1,
	FILE: 2
} as const;

export type JobType = (typeof JobType)[keyof typeof JobType];
export type JobTrigger = (typeof JobTrigger)[keyof typeof JobTrigger];
export interface IJobRequest {
	id: StoredOnly<UUID>;

	type: JobType;
	state: State;
	trigger: JobTrigger;
	customer_id?: UUID | undefined | null;
	business_id?: UUID | undefined | null;
	metadata?: Record<string, any>;
	comments?: string;
	created_by: UUID;
	updated_at: StoredOnly<Date | null>;
	created_at: StoredOnly<Date>;
	updated_by: StoredOnly<UUID | null>;
	started_at: StoredOnly<Date | null>;
	completed_at: StoredOnly<Date | null>;
	errored_at: StoredOnly<Date | null>;
}
export interface IJobRequestEnriched extends Partial<Serialized<IJobRequest>> {
	jobStates: Record<StateKey, number>;
	totalJobs: number;
}
