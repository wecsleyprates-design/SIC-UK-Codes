import type { Serialized, Stored, StoredOnly } from "#types/eggPattern";
import type { UUID } from "crypto";
import type { IJob, State } from ".";

export const JobHistoryType = {
	STATE_CHANGE: 0,
	COMMENT: 1
} as const;
export type JobHistoryTypeKey = keyof typeof JobHistoryType;
export type JobHistoryTypeType = (typeof JobHistoryType)[JobHistoryTypeKey];

export interface IJobHistory {
	id: StoredOnly<UUID>;
	created_at: StoredOnly<Date>;
	job_id: UUID;
	state: State;
	type?: JobHistoryTypeType;
	metadata?: Record<string, any>;
	comments?: string;
}

export interface ICommentJobHistory extends IJobHistory {
	comments: string;
	type: (typeof JobHistoryType)["COMMENT"];
}

export interface IJobHistoryEnriched extends Serialized<IJobHistory> {
	job: Serialized<Stored<IJob>>;
}
