import { searchGoogleProfileMatchResult } from "#api/v1/modules/data-scrape";
import { banking } from "#api/v1/modules/banking/banking";
import { EVENTS, QUEUES } from "#constants";
import BullQueue from "#helpers/bull-queue";
import { logger } from "#helpers/logger";
import {
	businessEventsHandler,
	entityMatchingEventsHandler,
	notificationEventsHandler,
	scoreEventsHandler
} from "../messaging/kafka/consumers/handlers";
import { ManualIntegration } from "#lib/manual/manualIntegration";
import { envConfig } from "#configs";
import { WORKER_TYPES } from "#constants";
import { ZoomInfo } from "#lib/zoominfo/zoominfo";
import { OpenCorporates } from "#lib/opencorporates/opencorporates";
import { NPI } from "#lib/npi/npi";
import { ocrService } from "#api/v1/modules/ocr/ocrService";
import { allFacts, FactEngineWithDefaultOverrides, FactRules, FactUtils } from "#lib/facts";
import { businessOnboardingManager } from "#core/businessOnboarding";
import { adverseMediaManager } from "#core/adverseMedia";
import { identityVerificationManager } from "#core/identityVerification";
import { creditBureauManager } from "#core/creditBureau";
import { watchlistScreeningManager } from "#core/watchlistScreening";

import type { IBusinessIntegrationTaskEnriched } from "#types";
import type { Job } from "bull";
import { MatchUtil } from "#lib/match/matchUtil";
import { UUID } from "crypto";
import { KYX } from "#lib/kyx/kyx";

export const taskQueue = new BullQueue(QUEUES.TASK);
export const entityMatchingQueue = new BullQueue(QUEUES.ENTITY_MATCHING);
export const firmographicsQueue = new BullQueue(QUEUES.FIRMOGRAPHICS);
export const openCorporatesQueue = new BullQueue(QUEUES.OPEN_CORPORATES);
export const zoominfoQueue = new BullQueue(QUEUES.ZOOMINFO);
export const npiQueue = new BullQueue(QUEUES.NPI);
export const caseSubmittedQueue = new BullQueue(QUEUES.CASE_SUBMITTED);
export const businessOnboardingQueue = new BullQueue(QUEUES.BUSINESS_ONBOARDING);

export const initTaskWorker = () => {
	const workerType = envConfig.WORKER_TYPE;
	const isCritical = !workerType || workerType === WORKER_TYPES.CRITICAL;
	const isGeneral = !workerType || workerType === WORKER_TYPES.GENERAL;

	if (isCritical) {
		entityMatchingQueue.queue.process(EVENTS.ENTITY_MATCHING, 25, async (job: Job, done) => {
			await processJob(job, entityMatchingEventsHandler.entityMatching.bind(entityMatchingEventsHandler));
			done();
		});
		firmographicsQueue.queue.process(EVENTS.FIRMOGRAPHICS_EVENT, 25, async (job: Job, done) => {
			await processJob(job, entityMatchingEventsHandler.firmographicsEvent.bind(entityMatchingEventsHandler));
			done();
		});
		openCorporatesQueue.queue.process(EVENTS.OPEN_CORPORATES_MATCH, 25, async (job: Job, done) => {
			await processJob(job, OpenCorporates.matchBusinessFromJobData.bind(OpenCorporates));
			done();
		});
		zoominfoQueue.queue.process(EVENTS.ZOOMINFO_MATCH, 25, async (job: Job, done) => {
			await processJob(job, ZoomInfo.matchBusinessFromJobData.bind(ZoomInfo));
			done();
		});
		npiQueue.queue.process(EVENTS.NPI_BUSINESS_MATCH, 25, async (job: Job, done) => {
			await processJob(job, NPI.matchBusinessFromJobData.bind(NPI));
			done();
		});
		caseSubmittedQueue.queue.process(EVENTS.CASE_SUBMITTED_EXECUTE_TASKS, 25, async (job: Job, done) => {
			await processJob(job, businessEventsHandler.executeTasksOnCaseSubmit.bind(businessEventsHandler));
			done();
		});
		businessOnboardingQueue.queue.process(EVENTS.BUSINESS_INVITE_ACCEPTED, 25, async (job: Job, done) => {
			await processJob(job, businessOnboardingManager.seedBusinessIntegrations.bind(businessOnboardingManager));
			done();
		});
	}

	if (!isGeneral) {
		return;
	}

	// Drain pre-migration jobs still sitting on the shared task queue that we moved to the critical queues
	taskQueue.queue.process(EVENTS.CASE_SUBMITTED_EXECUTE_TASKS, async (job: Job, done) => {
		await processJob(job, businessEventsHandler.executeTasksOnCaseSubmit.bind(businessEventsHandler));
		done();
	});

	taskQueue.queue.process(EVENTS.PLAID_ASSET_REPORT, async (job: Job, done) => {
		await processJob(job, banking.handleAssetReportWebhook.bind(banking));
		done();
	});
	taskQueue.queue.process(EVENTS.REFRESH_SCORE, async (job: Job, done) => {
		await processJob(job, scoreEventsHandler.scoreRefresh.bind(scoreEventsHandler));
		done();
	});
	taskQueue.queue.process(EVENTS.INTEGRATION_DATA_UPLOADED, async (job: Job, done) => {
		await processJob(job, ManualIntegration.processManualIntegration);
		done();
	});
	
	taskQueue.queue.process(EVENTS.BUSINESS_MATCH, async (job: Job, done) => {
		logger.warn(job, "Business match job: no handler implemented");
		done();
	});

	taskQueue.queue.process(EVENTS.OCR_PARSE_DOCUMENT, async (job: Job, done) => {
		await processJob(job, ocrService.processQueuedDocument.bind(ocrService));
		done();
	});

	taskQueue.queue.process(EVENTS.OCR_VALIDATE_DOCUMENT_TYPE, async (job: Job, done) => {
		await processJob(job, ocrService.validateQueuedDocumentType.bind(ocrService));
		done();
	});

	taskQueue.queue.process(EVENTS.FETCH_ASSET_REPORT, async (job: Job, done) => {
		await processJob(job, banking.fetchAssetReport.bind(banking));
		done();
	});

	taskQueue.queue.process(EVENTS.LINK_WEBHOOK, async (job: Job, done) => {
		await processJob(job, banking.handleLinkWebhook.bind(banking));
		done();
	});

	taskQueue.queue.process(EVENTS.PURGE_BUSINESS, async (job: Job, done) => {
		await processJob(job, businessEventsHandler.purgeBusiness.bind(businessEventsHandler));
		done();
	});

	taskQueue.queue.process(EVENTS.INTEGRATION_DATA_READY, async (job: Job, done) => {
		await processJob<IBusinessIntegrationTaskEnriched>(job, processIntegrationDataReady);
		done();
	});

	taskQueue.queue.process(EVENTS.FETCH_WORTH_BUSINESS_WEBSITE_DETAILS, async (job: Job, done) => {
		await processJob(job, businessEventsHandler.fetchWorthBusinessWebsiteDetails.bind(businessEventsHandler));
		done();
	});

	taskQueue.queue.process(EVENTS.FETCH_GOOGLE_PROFILE, async (job: Job, done) => {
		await processJob(job, processFetchGoogleProfile);
		done();
	});

	taskQueue.queue.process(EVENTS.MATCH_PRO_BULK, 25, async (job: Job, done) => {
		await processJob(job, MatchUtil.processJobRequest.bind(MatchUtil));
		done();
	});

	taskQueue.queue.process(EVENTS.CASE_UPDATED_AUDIT, async (job: Job, done) => {
		await processJob(job, notificationEventsHandler.handleApplicationEdit.bind(notificationEventsHandler));
		done();
	});

	taskQueue.queue.process(EVENTS.KYX_MATCH, 25, async (job: Job, done) => {
		await processJob(job, KYX.processJobRequest.bind(KYX));
		done();
	});
	
	// Drain pre-migration BUSINESS_INVITE_ACCEPTED jobs still on the shared task queue that we moved to the critical queues
	taskQueue.queue.process(EVENTS.BUSINESS_INVITE_ACCEPTED, async (job: Job, done) => {
		await processJob(job, businessOnboardingManager.seedBusinessIntegrations.bind(businessOnboardingManager));
		done();
	});

	taskQueue.queue.process(EVENTS.FETCH_ADVERSE_MEDIA_REPORT, async (job: Job, done) => {
		await processJob(job, adverseMediaManager.fetchAdverseMediaReport.bind(adverseMediaManager));
		done();
	});

	taskQueue.queue.process(EVENTS.OWNER_UPDATED, async (job: Job, done) => {
		await processJob(job, [
			identityVerificationManager.plaidIdentityVerification.bind(identityVerificationManager),
			creditBureauManager.fetchBureauCreditReport.bind(creditBureauManager),
			watchlistScreeningManager.ownersWatchlistSubmission.bind(watchlistScreeningManager)
		]);
		done();
	});
};

/***
 * Wrapper for processing the job

*/
const processJob = async <T = any>(job: Job<T>, promiseHandlers: Array<(any) => void> | ((any) => void)) => {
	try {
		logger.info(`Task Worker: Processing ${job.name} :: ${JSON.stringify(job.data)}`);

		// Await processing of promises, whether a single handler or multiple handlers
		await (Array.isArray(promiseHandlers)
			? Promise.allSettled(promiseHandlers.map(handler => handler(job.data)))
			: promiseHandlers(job.data));
	} catch (ex) {
		logger.error(`${job.name} Error: ${job.id} :: ${JSON.stringify(ex)} :: ${ex instanceof Error ? ex.message : ""}`);
		logger.error(ex);
	} finally {
		if (envConfig.ENV === "development") {
			job.queue.getJobCounts().then(counts => {
				logger.debug(`BullQueue queue=${job.queue.name}: Job counts: ${JSON.stringify(counts)}`);
			});
		}
	}
};

const processIntegrationDataReady = async function (task: IBusinessIntegrationTaskEnriched): Promise<void> {
	// Determine if any sources tied to the platform have facts -- if so, calculate the facts
	const { business_id: businessID, platform_id: platformId } = task;
	const facts = FactUtils.extractFactsForPlatformId(platformId, allFacts);
	if (facts && Array.isArray(facts) && facts.length > 0) {
		// Execute a Fact run for this so we can send calculated event
		const factEngine = new FactEngineWithDefaultOverrides(facts, { business: businessID });
		await factEngine.applyRules(FactRules.factWithHighestConfidence);
		return void factEngine.getResults([
			"source.confidence",
			"source.platformId",
			"source.name",
			"ruleApplied.name",
			"ruleApplied.description",
			"fact.confidence",
			"source.weight",
			"fact.weight"
		]);
	}
};

const processFetchGoogleProfile = async function (payload: { business_id: string }): Promise<void> {
	try {
		const taskId = await searchGoogleProfileMatchResult(payload.business_id as UUID);
		if (taskId) {
			logger.info(`fetch google profile completed successfully for business ${payload.business_id}, taskId: ${taskId}`);
		} else {
			logger.warn(`fetch google profile failed for business ${payload.business_id}`);
		}
	} catch (error) {
		logger.error(error, `Error processing fetch google profile for business ${payload.business_id}:`);
		throw error;
	}
};
