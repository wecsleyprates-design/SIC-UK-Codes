import { EVENTS, QUEUES } from "#constants";
import BullQueue, { runJob } from "#helpers/bull-queue";
import { logger } from "#helpers/logger";
import { EquifaxUtil } from "#lib/equifax/equifaxUtil";
import type { Job } from "bull";

export const bureauQueue = new BullQueue(QUEUES.BUREAU);

export const initEquifaxWorker = () => {
	bureauQueue.queue.process(EVENTS.EQUIFAX_MATCH, async (job: Job, done) => {
		await runJob(job, done, EquifaxUtil.processJobRequest);
	});
};
