import { getEnumKeyByValue, type EventEnum } from "#constants";
import { db } from "#helpers/knex";
import type { PaginatedResponse, Stored, Unwrap } from "#types/eggPattern";
import type { UUID } from "crypto";

import type BullQueue from "#helpers/bull-queue";
import { BaseModel } from "#models/baseModel";
import { State, JobTrigger, IJob, type IJobEnriched, type StateKey, JobType } from "../types";
import { JobHistory } from "./jobHistory";
import cloneDeep from "lodash/cloneDeep";
import { JobRequest } from "./jobRequest";
import { decryptData, encryptData } from "#utils";
import { logger } from "#helpers";

export class Job extends BaseModel<IJob> {
	public static readonly TABLE = "jobs.job";

	public static readonly serializedFields: Record<string, Object> = {
		type: JobType,
		state: State,
		trigger: JobTrigger
	};

	public static async findByCustomerId(
		customerId: UUID,
		page = 0,
		decrypt = true
	): Promise<PaginatedResponse<Job, IJob>> {
		const records = await this.findByField({ customer_id: customerId }, { page });
		if (decrypt) {
			return this.decryptRecords(records);
		}
		return records;
	}
	public static async findByRequestId(
		requestId: UUID,
		paginationOptions,
		decrypt = true
	): Promise<PaginatedResponse<Job, IJob>> {
		const records = await this.findByField({ request_id: requestId }, paginationOptions);
		if (decrypt) {
			return this.decryptRecords(records);
		}
		return records;
	}

	private static decryptRecords(paginatedResponse: PaginatedResponse<Job, IJob>): PaginatedResponse<Job, IJob> {
		let [records, pageOptions] = paginatedResponse;
		const decryptedRecords = records.map(job => {
			return job.decrypt();
		});
		return [decryptedRecords, pageOptions];
	}

	private isEncrypted(data?: unknown): boolean {
		if (data) {
			try {
				const decrypted = decryptData(data);
				return decrypted !== data && decrypted !== undefined;
			} catch (error: unknown) {
				return false;
			}
		}
		return this.record.metadata?._encrypted === true;
	}

	private transformMetadata(transform: (value: unknown) => unknown, setEncrypted: boolean): Job {
		const clonedJob = cloneDeep(this);

		// Ensure metadata exists
		if (!clonedJob.record.metadata) {
			clonedJob.record.metadata = {};
		}

		const metadata = clonedJob.record.metadata;

		try {
			const shouldTransform = (value: unknown) => (setEncrypted ? !this.isEncrypted(value) : this.isEncrypted(value));

			if (metadata.data && shouldTransform(metadata.data)) {
				metadata.data = transform(metadata.data);
			}

			if (metadata.response && shouldTransform(metadata.response)) {
				metadata.response = transform(metadata.response);
			}

			// Always set the encrypted flag
			metadata._encrypted = setEncrypted;
		} catch (error: unknown) {
			logger.error({ error }, "Error in transformMetadata");
		}
		return clonedJob;
	}

	public encrypt(): Job {
		if (this.isEncrypted()) {
			return this;
		}

		return this.transformMetadata(encryptData, true);
	}

	public decrypt(): Job {
		if (!this.isEncrypted()) {
			return this;
		}
		return this.transformMetadata(decryptData, false);
	}

	/** Get a map of all the States for the jobs related to this request */
	public static async getStatesForRequest(requestId: UUID): Promise<Record<StateKey, number>> {
		const rows = await db(this.TABLE)
			.select("state")
			.count("* as count")
			.groupBy("state")
			.where({ request_id: requestId });
		const statesForRequest = rows.reduce((acc, row) => {
			if (row.state) {
				const key = getEnumKeyByValue(State, row.state);
				if (key) {
					const count = parseInt(row.count as string, 10) ?? 0;
					acc[key] = isNaN(count) ? 0 : count;
				}
			}
			return acc;
		}, {}) as Record<StateKey, number>;

		return statesForRequest;
	}

	public async getEnriched(): Promise<Stored<IJobEnriched>> {
		const request = (await JobRequest.getById(this.record.request_id))?.get();
		return { ...this.serialized, request };
	}

	public async setBusinessId(businessId: UUID) {
		return await this.encrypt().update({ business_id: businessId });
	}

	public async setState(state: State, updateRequest: boolean = false, metadata: Record<PropertyKey, any> = {}) {
		const update: Partial<Unwrap<IJob>> = { state };
		if (state === State.STARTED && !this.record.started_at) {
			update.started_at = db.fn.now();
		} else if (state === State.ERROR && !this.record.errored_at) {
			update.errored_at = db.fn.now();
		} else if (state === State.SUCCESS && !this.record.completed_at) {
			update.completed_at = db.fn.now();
		}
		await Promise.all([JobHistory.create({ job_id: this.record.id, state, metadata }), this.encrypt().update(update)]);

		if (updateRequest) {
			await JobRequest.getById(this.record.request_id).then(request => request.updateStateByJobState(state));
		}
	}

	/** Send this record to a queue */
	public async enqueue(queue: BullQueue, jobType: string) {
		const jobMetadata = { ...(this.encrypt().record.metadata ?? {}), request_id: this.record.request_id };
		return queue.addJob(jobType, JSON.stringify(jobMetadata ?? {}), {
			jobId: this.record.id,
			removeOnComplete: {
				age: 1000 * 60 * 60 * 24 // 24 hours
			},
			removeOnFail: {
				age: 1000 * 60 * 60 * 24 * 7 // 7 days
			}
		});
	}
}
