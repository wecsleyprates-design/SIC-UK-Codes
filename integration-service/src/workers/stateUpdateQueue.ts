import { envConfig } from "#configs";
import { EVENTS, QUEUES } from "#constants";
import { logger } from "#helpers";
import BullQueue from "#helpers/bull-queue";
import type { Job } from "bull";
import type { OnUpdateResult, StateUpdatePayload } from "../api/v1/modules/core/handlers/stateUpdate/types";
import { processOnUpdateHandlers } from "../api/v1/modules/core/handlers/stateUpdate";

export const stateQueue = new BullQueue(QUEUES.STATE_UPDATE);

export const initStateUpdateQueueWorker = () => {
	stateQueue.queue.process(EVENTS.STATE_UPDATE, async (job: Job<StateUpdatePayload>, done) => {
		await processJob<StateUpdatePayload, OnUpdateResult>(job, done, data =>
			processOnUpdateHandlers(data, "asynchronous")
		);
	});
};

const processJob = async <T = unknown, R = unknown>(
	job: Job<T>,
	done: (error?: Error) => void,
	promiseHandlers: Array<(any) => Promise<R>> | ((any) => Promise<R>)
) => {
	try {
		logger.info(`State Update Worker: Processing ${job.name} :: ${JSON.stringify(job.data)}`);

		// Await processing of promises, whether a single handler or multiple handlers
		if (Array.isArray(promiseHandlers)) {
			await Promise.allSettled(promiseHandlers.map(handler => handler(job.data)));
		} else {
			await promiseHandlers(job.data);
		}
		done();
	} catch (error) {
		logger.error({ error, job }, `${job.name} Error: ${job.id}`);
		if (error instanceof Error) {
			done(error);
		} else {
			done(new Error(error as string));
		}
	} finally {
		if (envConfig.ENV === "development") {
			job.queue.getJobCounts().then(counts => {
				logger.debug(`BullQueue queue=${job.queue.name}: Job counts: ${JSON.stringify(counts)}`);
			});
		}
	}
};
