import type { UUID } from "crypto";
import { logger } from "#helpers/logger";
import { SCORE_TRIGGER, type IntegrationCategoryId } from "#constants";
import { IntegrationsCompletionTracker, type TaskType } from "#helpers/integrationsCompletionTracker";
import { BusinessScoreTriggerRepository } from "#core/scoreTrigger";
import { CaseServiceClient } from "#clients/case";

interface ConnectionWithTasks {
	connection_id: string;
	platform_id: number;
	platform_code: string;
	task_codes: string[];
}

interface RerunTrackingDeps {
	businessScoreTriggerRepository?: BusinessScoreTriggerRepository;
	caseServiceClient?: CaseServiceClient;
}

interface InitializeParams {
	businessID: UUID;
	connectionsWithTasks: ConnectionWithTasks[];
	timeoutThresholdSeconds?: number;
}

interface InitializeResult {
	scoreTriggerId: UUID;
	caseId: UUID | null;
}

/**
 * Orchestrates score-trigger creation and completion-tracker initialization
 * for rerun integrations.
 *
 * Follows the Manager pattern: owns the business logic and delegates to
 * BusinessScoreTriggerRepository (data) and CaseServiceClient (external API).
 */
export class RerunTrackingManager {
	private readonly scoreTriggerRepo: BusinessScoreTriggerRepository;
	private readonly caseClient: CaseServiceClient;

	constructor(deps?: RerunTrackingDeps) {
		this.scoreTriggerRepo = deps?.businessScoreTriggerRepository ?? new BusinessScoreTriggerRepository();
		this.caseClient = deps?.caseServiceClient ?? new CaseServiceClient();
	}

	/**
	 * 1. Creates a MANUAL_REFRESH score trigger (next version for business)
	 * 2. Resolves the active case_id via case-service
	 * 3. Builds TaskType[] from the connections being rerun
	 * 4. Calls mergeAndInitializeTracking to safely handle concurrent runs
	 */
	async initialize({
		businessID,
		connectionsWithTasks,
		timeoutThresholdSeconds
	}: InitializeParams): Promise<InitializeResult> {
		logger.info({ businessID, message: "[RERUN_DEBUG] Starting rerun tracking initialization" });

		const { scoreTriggerId, customerId } = await this.createScoreTrigger(businessID);
		const caseId = await this.resolveActiveCaseId(businessID);
		const rerunTaskTypes = this.buildTaskTypes(connectionsWithTasks);
		const requiredByCategory = this.buildRequiredByCategory(rerunTaskTypes);

		logger.info({
			businessID,
			scoreTriggerId,
			customerId: customerId ?? null,
			caseId,
			rerunTaskTypes,
			requiredByCategory,
			message: "[RERUN_DEBUG] About to call mergeAndInitializeTracking"
		});

		await IntegrationsCompletionTracker.mergeAndInitializeTracking(
			{
				business_id: businessID,
				customer_id: customerId as UUID,
				case_id: caseId as UUID,
				business_score_trigger_id: scoreTriggerId
			},
			requiredByCategory,
			timeoutThresholdSeconds,
			{ started_at: new Date().toISOString() }
		);

		logger.info({
			businessID,
			scoreTriggerId,
			caseId,
			rerunTaskTypes,
			message: "[RERUN_DEBUG] Completed rerun tracking initialization"
		});

		return { scoreTriggerId, caseId };
	}

	private async createScoreTrigger(businessID: UUID): Promise<{ scoreTriggerId: UUID; customerId: UUID | undefined }> {
		const latest = await this.scoreTriggerRepo.getLatestByBusinessId(businessID);
		const version = latest ? latest.version + 1 : 1;
		const customerId = latest?.customer_id ?? undefined;

		const newTrigger = await this.scoreTriggerRepo.create({
			business_id: businessID,
			trigger_type: SCORE_TRIGGER.MANUAL_REFRESH,
			version,
			customer_id: customerId
		});

		logger.info({
			businessID,
			scoreTriggerId: newTrigger.id,
			version,
			message: "Created MANUAL_REFRESH score trigger for rerun integrations"
		});

		return { scoreTriggerId: newTrigger.id, customerId };
	}

	private async resolveActiveCaseId(businessID: UUID): Promise<UUID | null> {
		try {
			const cases = await this.caseClient.getCasesByBusinessId(businessID);
			const caseId = cases?.length > 0 ? cases[0].id : null;
			logger.info({
				businessID,
				caseId,
				caseCount: cases?.length ?? 0,
				message: "[RERUN_DEBUG] Resolved case_id from case-service"
			});
			return caseId;
		} catch (error) {
			logger.warn({
				businessID,
				error: error instanceof Error ? error.message : String(error),
				message: "[RERUN_DEBUG] Could not resolve case_id — completion events will have null case_id"
			});
			return null;
		}
	}

	/**
	 * Build TaskType[] from connections, e.g. "serp_google_profile:fetch_google_profile"
	 */
	private buildTaskTypes(connectionsWithTasks: ConnectionWithTasks[]): TaskType[] {
		return connectionsWithTasks.flatMap(conn =>
			conn.task_codes.map(tc => `${conn.platform_code.toLowerCase()}:${tc}` as TaskType)
		);
	}

	/**
	 * Build required-tasks-by-category for rerun tracking.
	 *
	 * First tries the standard PLATFORM_PROCESS_MAPPING lookup. Any tasks that
	 * don't appear in the mapping (e.g. fetch_google_profile) are placed under
	 * their connection's platform category via getConnectionCategory, falling
	 * back to grouping by the platform_id from the connection.
	 *
	 * For reruns, every task being rerun is required — we can't rely solely on
	 * PLATFORM_PROCESS_MAPPING which only covers onboarding tasks.
	 */
	private buildRequiredByCategory(
		rerunTaskTypes: TaskType[]
	): Partial<Record<IntegrationCategoryId, TaskType[]>> {
		/** Try the standard mapping first — picks up tasks that ARE in the mapping */
		const mapped = IntegrationsCompletionTracker.getRequiredTasksByTaskType(rerunTaskTypes);

		/** Collect all tasks that got mapped */
		const mappedTasks = new Set<TaskType>(Object.values(mapped).flat() as TaskType[]);

		/** Any tasks NOT in the mapping go under category 0 (uncategorized) as a catch-all */
		const unmapped = rerunTaskTypes.filter(t => !mappedTasks.has(t));
		if (unmapped.length > 0) {
			const UNCATEGORIZED = 0 as IntegrationCategoryId;
			mapped[UNCATEGORIZED] = [...(mapped[UNCATEGORIZED] ?? []), ...unmapped];
			logger.info({
				unmappedTasks: unmapped,
				message: "[RERUN_DEBUG] Tasks not in PLATFORM_PROCESS_MAPPING — added under catch-all category"
			});
		}

		return mapped;
	}
}
