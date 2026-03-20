import { initDeferredTaskWorker } from "./deferredTaskWorker";
import { initEquifaxWorker } from "./bureau";
import { initBusinessImportJobWorker } from "./businessImportJobWorker";
import { initGoogleReviewsWorker } from "./reviews";
import { initTaskWorker } from "./taskHandler";
import { initEnrichWorker, initVerdataWorker } from "./verdata";
import { initStateUpdateQueueWorker } from "./stateUpdateQueue";
import { envConfig } from "#configs";
import { WORKER_TYPES } from "#constants";

/**
 * Bootstrap Bull queue processors based on WORKER_TYPE.
 * - undefined (legacy): all queues
 * - critical: verdata, verdata-retry, bureau, entity-matching, firmographics, open-corporates, zoominfo, npi
 * - general: task, business-reviews, job, state-update, ai-enrichment, website-scanning, trulioo-psc
 */
export const initWorkers = () => {
	const workerType = envConfig.WORKER_TYPE;
	const isCritical = !workerType || workerType === WORKER_TYPES.CRITICAL;
	const isGeneral = !workerType || workerType === WORKER_TYPES.GENERAL;

	if (isCritical) {
		initVerdataWorker();
		initEnrichWorker();
		initEquifaxWorker();
	}

	if (isGeneral) {
		initGoogleReviewsWorker();
		initBusinessImportJobWorker();
		initDeferredTaskWorker();
		initStateUpdateQueueWorker();
	}

	if (isCritical || isGeneral) {
		initTaskWorker();
	}
};
