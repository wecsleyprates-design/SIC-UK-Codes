import { BaseModel } from "#models/baseModel";
import { Stored, type PaginatedResponse } from "#types/eggPattern";
import type { UUID } from "crypto";
import { IJobHistory as HistoryType, JobHistoryType, type IJobHistoryEnriched } from "../types";
import { Job } from "./job";

export class JobHistory extends BaseModel<HistoryType> {
	public static readonly TABLE = "jobs.job_history";

	public static readonly serializedFields: Record<string, any> = {
		type: JobHistoryType
	};

	public static async findByJobId(jobId: UUID, paginationOptions): Promise<PaginatedResponse<JobHistory, HistoryType>> {
		return this.findByField({ job_id: jobId }, paginationOptions);
	}

	public async getEnriched(): Promise<Stored<IJobHistoryEnriched>> {
		const job = (await Job.getById(this.record.job_id))?.get();
		return { ...this.serialized, job };
	}
}
