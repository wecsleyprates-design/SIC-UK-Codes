import { DeferrableTaskManager } from "#api/v1/modules/tasks/deferrableTaskManager";
import { INTEGRATION_ID, QUEUES, EVENTS } from "#constants";
import { db } from "#helpers/knex";
import { logger } from "#helpers/logger";
import { getOrCreateConnection } from "#helpers/platformHelper";
import BullQueue from "#helpers/bull-queue";
import type { IBusinessIntegrationTask } from "#types/db";
import type { DependentTask, DeferrableTask } from "#api/v1/modules/tasks/types";
import type { UUID } from "crypto";
import type { Job } from "bull";
import type { EnqueuedJob } from "#lib/aiEnrichment/types";
import type { Knex } from "knex";

interface TruliooPSCMetadata extends DeferrableTask {
	/** ID from integration_data.business_entity_verification linking this PSC task to its parent KYB verification record */
	bev_id?: string;
	/** ID of the originating KYB integration task (data_business_integrations_tasks) that triggered PSC screening */
	origin_task_id?: string;
}

/**
 * Deferrable task for Trulioo PSC (Persons of Significant Control) screening.
 *
 * US businesses skip Trulioo KYB at case-submit time because KYB is handled
 * by Middesk. However, PSC screening (watchlist checks on owners/officers)
 * still needs to run via Trulioo once owner data is available.
 *
 * This task depends on the Middesk `fetch_business_entity_verification` task
 * completing first, so that owner data from Middesk is persisted in the DB
 * before PSC screening extracts and screens those owners.
 *
 * Uses the same DeferrableTaskManager pattern as WorthWebsiteScanning.
 */
export class TruliooPSCScreening extends DeferrableTaskManager {
	protected static readonly PLATFORM_ID = INTEGRATION_ID.TRULIOO_PSC;
	protected static readonly QUEUE_NAME = QUEUES.TRULIOO_PSC;
	protected static readonly QUEUE_EVENT = EVENTS.FETCH_WATCHLIST_HITS;
	protected static readonly QUEUE_WORKER_SANDBOX_PATH = "sandboxed/deferrableTaskWorker.ts";
	protected static readonly TASK_TIMEOUT_IN_SECONDS = 60 * 3;
	protected static readonly MAX_ATTEMPTS = 8;

	static readonly DEPENDENT_TASKS: Partial<DependentTask> = {
		fetch_business_entity_verification: [
			{ platformId: INTEGRATION_ID.MIDDESK, timeoutInSeconds: 60 * 2 }
		]
	};

	constructor({
		dbConnection,
		db: injectedDb,
		bullQueue
	}: {
		dbConnection: Parameters<typeof DeferrableTaskManager.prototype["evaluateJob"]> extends never[]
			? never
			: ConstructorParameters<typeof DeferrableTaskManager>[0]["dbConnection"];
		db: Knex;
		bullQueue: BullQueue;
	}) {
		super({ dbConnection, db: injectedDb, bullQueue });
	}

	protected async executeDeferrableTask(
		task: IBusinessIntegrationTask,
		_job: Job<EnqueuedJob>
	): Promise<boolean> {
		const businessId = this.dbConnection.business_id;
		const bevId = task.metadata?.bev_id;

		if (!bevId) {
			logger.error(
				{ businessId, taskId: task.id },
				"TruliooPSCScreening: missing bev_id in task metadata"
			);
			return false;
		}

		logger.info(
			{ businessId, bevId, taskId: task.id },
			"TruliooPSCScreening: executing PSC screening after Middesk dependency satisfied"
		);

		const { TruliooBusiness } = await import("./truliooBusiness");
		const truliooBusiness = new TruliooBusiness(businessId);
		const originTaskId = task.metadata?.origin_task_id;

		await truliooBusiness.triggerPSCScreening(
			bevId,
			{ status: "completed", businessData: {} },
			{
				hfSession: `US-DEFERRED-${task.id}`,
				flowData: { elements: [] },
				submitResponse: {},
				clientData: {}
			},
			originTaskId ?? task.id
		);

		logger.info(
			{ businessId, bevId, taskId: task.id },
			"TruliooPSCScreening: PSC screening completed successfully"
		);
		return true;
	}

	/**
	 * Build complete task metadata that includes both PSC-specific fields and
	 * the DeferrableTaskManager tracking structure (dependentFacts, dependentTasks,
	 * timeout, maxAttempts, attempts).
	 *
	 * @param bevId - Business Entity Verification ID (integration_data.business_entity_verification.id)
	 *   linking this PSC task to the KYB verification record that owns the person data.
	 * @param originTaskId - The originating KYB integration task ID.
	 *
	 * This is necessary because:
	 * 1. getOrCreateTaskForCode may return an existing task without updating metadata
	 * 2. evaluateReadyState replaces empty metadata with defaults that lack custom fields
	 * 3. evaluateReadyState needs dependentTasks in metadata to resolve dependencies
	 */
	private static buildTaskMetadata(bevId: string, originTaskId: string): TruliooPSCMetadata {
		return {
			bev_id: bevId,
			origin_task_id: originTaskId,
			dependentFacts: {},
			dependentTasks: TruliooPSCScreening.DEPENDENT_TASKS,
			timeout: TruliooPSCScreening.TASK_TIMEOUT_IN_SECONDS,
			maxAttempts: TruliooPSCScreening.MAX_ATTEMPTS,
			attempts: 0
		};
	}

	/**
	 * Creates the TRULIOO_PSC connection + task and enqueues it into the
	 * deferrable queue. Called from TruliooBusiness.handleUSAutomaticPSCScreening.
	 */
	public static async enqueueForBusiness(
		businessId: UUID,
		bevId: string,
		originTaskId: string
	): Promise<void> {
		const connection = await getOrCreateConnection(businessId, INTEGRATION_ID.TRULIOO_PSC);

		const bullQueue = new BullQueue(
			TruliooPSCScreening.getQueueName(),
			TruliooPSCScreening.getQueueOptions()
		);

		const instance = new TruliooPSCScreening({ dbConnection: connection, db, bullQueue });

		const metadata = TruliooPSCScreening.buildTaskMetadata(bevId, originTaskId);

		const taskId = await instance.getOrCreateTaskForCode({
			taskCode: "fetch_watchlist_hits",
			reference_id: businessId,
			metadata
		});

		// Always update metadata to ensure bev_id and tracking fields are present,
		// even if getOrCreateTaskForCode returned an existing task without updating it.
		await instance.updateTask(taskId, { metadata });

		await instance.processTask({ taskId });

		logger.info(
			{ businessId, bevId, taskId },
			"TruliooPSCScreening: deferrable task enqueued, waiting for Middesk completion"
		);
	}
}
