import { QUEUE_EVENTS, QUEUES } from "#constants";
import { BullQueue } from "#helpers/bullQueue";
import { logger } from "#helpers/logger";
import type { Job } from "bull";

import { envConfig } from "#configs";
import { businessEventsHandler } from "#messaging/kafka/consumers/handlers";

import { assertTINValid } from "../api/v1/modules/businesses/validateBusiness";

import type { UUID } from "crypto";

export const taskQueue = new BullQueue(QUEUES.TASK);

export type AssertTINJob = {
	businessID: UUID;
};

export const initTaskWorker = () => {
	logger.debug("Initializing BullQueue Task Worker");
	taskQueue.queue.process(QUEUE_EVENTS.INTEGRATION_DATA_READY, async (job: Job, done) => {
		await processJob(job, businessEventsHandler.processTaskCompletion.bind(businessEventsHandler));
		done();
	});
	taskQueue.queue.process(QUEUE_EVENTS.CREATE_STRIPE_CUSTOMER, async (job: Job, done) => {
		await processJob(job, businessEventsHandler.createStripeCustomer.bind(businessEventsHandler));
		done();
	});
	taskQueue.queue.process(QUEUE_EVENTS.ASSERT_TIN, async (job: Job<AssertTINJob>, done) => {
		const { businessID } = job.data;
		try {
			logger.debug(`ASSERT_TIN JOB: Asserting TIN for businessID=${businessID}`);
			await assertTINValid(businessID, 1);
		} catch (ex) {
			logger.warn(`${job.name} Warning: ${job.id} :: ${JSON.stringify(ex)} :: ${ex instanceof Error ? ex.message : ""}`);
		}
		done();
	});
};

/***
 * Wrapper for processing the job

*/
const processJob = async (job: Job, promiseHandlers: Array<(any) => void> | ((any) => void)) => {
	try {
		logger.info(`Task Worker: Processing ${job.name} :: ${JSON.stringify(job.data)}`);

		// Await processing of promises, whether a single handler or multiple handlers
		await (Array.isArray(promiseHandlers) ? Promise.allSettled(promiseHandlers.map(handler => handler(job.data))) : promiseHandlers(job.data));
	} catch (ex) {
		logger.error({ error: ex }, `${job.name} Error: ${job.id}`);
	} finally {
		if (envConfig.ENV === "development") {
			job.queue.getJobCounts().then(counts => {
				logger.debug(`BullQueue queue=${job.queue.name}: Job counts: ${JSON.stringify(counts)}`);
			});
		}
	}
};
