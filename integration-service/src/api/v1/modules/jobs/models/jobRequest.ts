import { Stored, type PaginatedResponse } from "#types/eggPattern";
import type { UUID } from "crypto";

import { BaseModel } from "#models/baseModel";
import { State, JobTrigger, JobType, type IJobRequestEnriched, type IJobRequest as JobRequestType } from "../types";
import { Job } from "./job";

export class JobRequest extends BaseModel<JobRequestType> {
	public static readonly TABLE = "jobs.request";

	public static readonly serializedFields: Record<string, any> = {
		type: JobType,
		state: State,
		trigger: JobTrigger
	};

	public static async findByCustomerId(
		customerId: UUID,
		page = 0
	): Promise<PaginatedResponse<JobRequest, JobRequestType>> {
		return this.findByField({ customer_id: customerId }, { page });
	}

	public async getEnriched(): Promise<Stored<IJobRequestEnriched>> {
		const jobStates = await Job.getStatesForRequest(this.get().id);
		return {
			...this.toApiResponse(),
			jobStates,
			totalJobs: Object.values(jobStates).reduce((acc, count) => acc + count, 0)
		} as Stored<IJobRequestEnriched>;
	}

	/** Given a state change for a job, see if this impacts the overall Request state */
	public async updateStateByJobState(state: State) {
		const request = this.getRecord();
		const jobStateImpliesRequestStarted = state === State.STARTED || state === State.ERROR || state === State.SUCCESS;

		if (request.started_at === null && jobStateImpliesRequestStarted) {
			request.started_at = new Date();
			request.state = State.STARTED;
		}
		if (state === State.ERROR && request.errored_at === null) {
			request.errored_at = new Date();
		}
		// Is request now in a terminal state?
		if (state === State.SUCCESS || state === State.ERROR) {
			// Are all requests finished?
			const states = await Job.getStatesForRequest(request.id);
			const createdCount = states.CREATED ?? 0;
			const startedCount = states.STARTED ?? 0;
			if (createdCount === 0 && startedCount === 0) {
				request.completed_at = new Date();
				request.state = state === State.SUCCESS ? State.SUCCESS : State.ERROR;
			}
		}
		await this.update(request);
	}
}
