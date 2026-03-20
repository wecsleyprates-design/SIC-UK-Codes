import BullQueue from "#helpers/bull-queue";
import { logger } from "#helpers/logger";
import { AIEnrichment } from "#lib/aiEnrichment/aiEnrichment";
import { WorthWebsiteScanning } from "#lib/worthWebsiteScanning/worthWebsiteScanning";
import { TruliooPSCScreening } from "#lib/trulioo/business/truliooPSCScreening";
import path from "path";
import type { DeferrableTaskManager } from "#api/v1/modules/tasks/deferrableTaskManager";
import { envConfig } from "#configs";

const DEFAULT_WORKER_CONCURRENCY = 5;
const rawWorkerConcurrency = Number(envConfig.BULL_MQ_SANDBOX_WORKER_COUNT);
const WORKER_CONCURRENCY =
	Number.isSafeInteger(rawWorkerConcurrency) && rawWorkerConcurrency > 0
		? rawWorkerConcurrency
		: DEFAULT_WORKER_CONCURRENCY;
const __DIRNAME = path.dirname(__filename);

/**
 * Generic worker initialization function for deferrable task managers.
 *
 * This function
 * 1. Builds a Bull queue for the given deferrable task class,
 * 2. Resolves the path to the worker script (could be .ts in dev or .js in prod),
 * 3. Registers the queue processor and event handlers.
 *
 * If anything goes wrong during setup, we log the error and exit early—
 * we do NOT rethrow so integration-service stays alive.
 */
const initDeferrableWorker = (deferrableTaskManager: typeof DeferrableTaskManager, emoji: string = "🧠") => {
	const name = deferrableTaskManager.name;
	logger.info(`${emoji} ${name} Worker: initDeferrableWorker() start`);
	try {
		const queueName = deferrableTaskManager.getQueueName();
		const queueOptions = deferrableTaskManager.getQueueOptions();
		const queueEvent = deferrableTaskManager.getQueueEvent();
		const queueSandboxFile = deferrableTaskManager.getQueueSandboxFile(__DIRNAME);

		logger.info(`${emoji} ${name} Worker: queueName=${queueName}, queueOptions=${JSON.stringify(queueOptions)}`);

		const queueInstance = new BullQueue(queueName, queueOptions);
		logger.info(`${emoji} ${name} Worker: BullQueue instance created`);
		logger.info(`${emoji} ${name} Worker: Resolved worker script path: ${queueSandboxFile}`);
		if (!queueSandboxFile) {
			logger.error(`${emoji} ${name} Worker: No worker script path returned; skipping initialization`);
			return;
		}

		queueInstance.queue.process(queueEvent, WORKER_CONCURRENCY, queueSandboxFile);
		logger.info(`${emoji} ${name} Worker: queue.process() registered`);

		queueInstance.queue.on("completed", (job, result) => {
			logger.info(`${emoji} ${name} Worker: Job ${job.id} completed with result ${result}`);
		});

		queueInstance.queue.on("failed", (job, error) => {
			if (error.name === "DeferredTask") {
				logger.debug(`${emoji} ${name} Worker: Job ${job.id} deferred - ${error.message}`);
			} else {
				logger.error(error, `${emoji} ${name} Worker: Job ${job.id} failed with error ${error}`);
			}
		});
	} catch (err) {
		logger.error(err, `${emoji} ${name} Worker: Failed to initialize ${name} worker:`);
	} finally {
		logger.info(`${emoji} ${name} Worker: initDeferrableWorker() end`);
	}
};

export const initDeferredTaskWorker = () => {
	logger.info("🔄 Deferred Task Workers: initDeferredTaskWorker() start");

	initDeferrableWorker(AIEnrichment, "🧠");

	initDeferrableWorker(WorthWebsiteScanning, "🌐");

	initDeferrableWorker(TruliooPSCScreening, "🔍");

	logger.info("🔄 Deferred Task Workers: All workers initialized successfully");
};
