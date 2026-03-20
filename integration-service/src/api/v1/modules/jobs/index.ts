import { EVENTS, QUEUES, type EventEnum, type QueueEnum } from "#constants";
import BullQueue from "#helpers/bull-queue";
import { runSynchronously as runBusinessImportJobSynchronously } from "#workers/businessImportJobWorker";
import type { Job } from "./models";
import { JobType } from "./types";

// DEFINE JOB TYPES TO EXECUTION HANDLERS HERE
export const JOB_TYPE_HANDLER: JobTypeHandler = {
	[JobType.UNKNOWN]: null,
	[JobType.BULK_BUSINESS_IMPORT]: {
		asynchronous: async (job: Job) => {
			const queue = new BullQueue(QUEUES.JOB);
			await job.enqueue(queue, EVENTS.BUSINESS_IMPORT);
		},
		synchronous: runBusinessImportJobSynchronously
	}
};

type JobTypeHandler = Record<JobType, null | Record<string, (job: Job) => Promise<void>>>;
