import { redis } from "#helpers/redis";
import { logger } from "#helpers/logger";
import {
	PLATFORM_PROCESS_MAPPING,
	type ProcessCompletionPlatformMapping
} from "#constants/process-completion.constant";
import {
	getEnumKeyByValue,
	INTEGRATION_CATEGORIES,
	INTEGRATION_ID,
	ONBOARDING_SETUP_ID,
	CUSTOM_ONBOARDING_SETUP,
	kafkaEvents,
	kafkaTopics,
	type IntegrationCategoryId,
	type IntegrationPlatform,
	type IntegrationPlatformId,
	type TaskCode
} from "#constants";
import { producer } from "./kafka";
import {
	getBusinessDetails,
	getBusinessCustomers,
	getCustomerCountries,
	getOnboardingCustomerSettings,
	getCustomerOnboardingStagesSettings
} from "#helpers/api";
import { customerIntegrationSettings } from "#api/v1/modules/customer-integration-settings/customer-integration-settings";
import type { UUID } from "crypto";
import type { IBusinessIntegrationTaskEnriched } from "#types";
import type { CustomerIntegrationSettingsSettingsData } from "#api/v1/modules/customer-integration-settings/types";

/** Integration status record from data_customer_integration_status table */
interface IntegrationStatusRecord {
	integration_status_id: number;
	integration_code: string;
	integration_label: string;
	status: "ENABLED" | "DISABLED" | "REQUIRED" | string;
}

/** Country record from customer onboarding setup countries API */
interface CustomerCountryRecord {
	jurisdiction_code: string | null;
	jurisdiction_name?: string;
	is_selected?: boolean;
	is_enabled?: boolean;
}

/** Platform filter context containing all data needed for filtering decisions */
interface FilterContext {
	/** Whether the business is located in US/USA */
	isUS: boolean;
	/** ISO country code (uppercase) or "UNKNOWN" if not determinable */
	country: string;
	/** List of enabled country codes for international business setup */
	enabledCountries: string[];
	/** Customer integration settings (per-integration configuration) */
	settings: CustomerIntegrationSettingsSettingsData;
	/** Integration status records from core_integration_status/data_customer_integration_status */
	statuses: IntegrationStatusRecord[];
	/** Whether accounting integration is enabled (from onboarding stages) */
	accountingEnabled: boolean;
	/** Whether banking integration is enabled (from onboarding stages) */
	bankingEnabled: boolean;
	/** Whether ownership verification is enabled (from onboarding stages) */
	ownershipEnabled: boolean;
}

export type TaskType = `${IntegrationPlatform | Lowercase<IntegrationPlatform> | "*"}:${TaskCode | "*"}`;
export interface CompletionState {
	business_id: UUID;
	customer_id: UUID | null;
	case_id: UUID | null;
	score_trigger_id: UUID | null;
	required_tasks?: TaskType[];
	required_tasks_by_category: Partial<Record<IntegrationCategoryId, TaskType[]>>;
	completed_categories: IntegrationCategoryId[];
	completed_tasks: TaskType[];
	timed_out_tasks: TaskType[];
	tasks_ignored: number;
	tasks_required: number;
	tasks_completed: number;
	tasks_timed_out: number;
	is_all_complete: boolean;
	timeout_threshold_seconds: number;
	categories?: IntegrationCategoryId[];
	started_at: string | null; // first task run --- this starts the timer for the timeout
	initialized_at: string; // when the tracker was initialized
	updated_at: string; // when the completion state was last updated
}

export interface CompletionEvent {
	category_id: "all" | IntegrationCategoryId;
	category_name: string | undefined;
	business_id: UUID;
	customer_id: UUID | null;
	completion_state: CompletionState;
	case_id: UUID | null;
	score_trigger_id: UUID | null;
	action: string;
}

export class IntegrationsCompletionTracker {
	private completionState: CompletionState;
	private redisKey: string;
	private static readonly REDIS_KEY_PREFIX = "{integration_completion}:all_integrations_completion:";
	private static readonly REDIS_TTL_SECONDS = 3600; // 1 hour -- needs to be greater than the TIMEOUT_THRESHOLD_SECONDS
	private static readonly TIMEOUT_THRESHOLD_SECONDS = 8 * 60; // 8 minutes

	constructor(completionState: CompletionState) {
		this.redisKey = IntegrationsCompletionTracker.getRedisKey(completionState.business_id);
		this.completionState = completionState;
	}

	/* 
	Get the integrations completion tracker for a business
	@param businessID - The ID of the business
	@returns The integrations completion tracker
	@throws IntegrationsCompletionTrackerError if no completion state is found
	*/
	static async forBusiness(businessID: UUID): Promise<IntegrationsCompletionTracker> {
		const key = IntegrationsCompletionTracker.getRedisKey(businessID);
		const state = await redis.hgetall<CompletionState>(key);
		if (!state || Object.keys(state).length === 0) {
			throw new IntegrationsCompletionTrackerError("No completion state found");
		}
		return new IntegrationsCompletionTracker(state);
	}

	/**
	 * Initialize tracking for a business with all required integrations
	 */
	static async initializeTracking(
		task: Pick<
			IBusinessIntegrationTaskEnriched,
			"business_id" | "customer_id" | "case_id" | "business_score_trigger_id"
		>,
		requirements: Partial<Record<IntegrationCategoryId, TaskType[]>>,
		timeoutThresholdSeconds?: number, // Default TIMEOUT_THRESHOLD_SECONDS
		completionState: Partial<CompletionState> = {}
	): Promise<IntegrationsCompletionTracker> {
		const key = this.getRedisKey(task.business_id);
		const requiredTaskSet = new Set<TaskType>(Object.values(requirements).flat());

		timeoutThresholdSeconds = timeoutThresholdSeconds ?? this.TIMEOUT_THRESHOLD_SECONDS;

		const state: CompletionState = {
			business_id: task.business_id,
			customer_id: task.customer_id ?? null,
			case_id: task.case_id ?? null,
			score_trigger_id: task.business_score_trigger_id as UUID,
			required_tasks: Array.from(requiredTaskSet),
			required_tasks_by_category: requirements,
			completed_categories: [],
			completed_tasks: [],
			timed_out_tasks: [],
			tasks_required: requiredTaskSet.size,
			tasks_completed: 0,
			tasks_timed_out: 0,
			tasks_ignored: 0,
			is_all_complete: false,
			updated_at: new Date().toISOString(),
			started_at: null,
			initialized_at: new Date().toISOString(),
			timeout_threshold_seconds: timeoutThresholdSeconds,
			...completionState
		};

		await redis.hset<CompletionState>(key, state);
		await redis.expire(key, this.REDIS_TTL_SECONDS);

		logger.info({
			business_id: task.business_id,
			customer_id: task.customer_id ?? null,
			case_id: task.case_id ?? null,
			score_trigger_id: task.business_score_trigger_id as UUID,
			requiredIntegrations: requirements,
			timeoutThresholdSeconds,
			message: "Initialized all integrations completion tracking with timeout handling"
		});
		return new IntegrationsCompletionTracker(state);
	}

	/**
	 * Initialize tracking with merge support for concurrent runs.
	 *
	 * If an existing tracker is active for this business, carries forward any in-flight tasks
	 * (required but not yet completed or timed out) and merges them with the new requirements.
	 * This prevents overwriting an active tracker and losing track of in-flight tasks.
	 *
	 * After initialization, emits a reset event so downstream consumers (e.g. case-service)
	 * know that integrations are running and `is_complete` should be false.
	 */
	static async mergeAndInitializeTracking(
		task: Pick<
			IBusinessIntegrationTaskEnriched,
			"business_id" | "customer_id" | "case_id" | "business_score_trigger_id"
		>,
		newRequirements: Partial<Record<IntegrationCategoryId, TaskType[]>>,
		timeoutThresholdSeconds?: number,
		completionState: Partial<CompletionState> = {}
	): Promise<IntegrationsCompletionTracker> {
		let mergedRequirements = { ...newRequirements };

		/** Try to read existing tracker and carry forward in-flight tasks */
		try {
			const existing = await this.forBusiness(task.business_id);
			const state = existing.completionState;

			const completedSet = new Set<TaskType>([
				...(state.completed_tasks ?? []),
				...(state.timed_out_tasks ?? [])
			]);

			/** Extract tasks that are required but not yet completed or timed out */
			const inFlightTasks = (state.required_tasks ?? []).filter(t => !completedSet.has(t));

			if (inFlightTasks.length > 0) {
				/** Map in-flight tasks back to categories so they merge cleanly */
				const inFlightByCategory = this.getRequiredTasksByTaskType(inFlightTasks);

				/** Merge: deduplicate tasks per category */
				for (const [categoryId, tasks] of Object.entries(inFlightByCategory)) {
					const category = Number(categoryId) as IntegrationCategoryId;
					const existing = mergedRequirements[category] ?? [];
					const merged = Array.from(new Set([...existing, ...tasks]));
					mergedRequirements[category] = merged;
				}

				logger.info({
					business_id: task.business_id,
					inFlightTasks,
					message: "Merged in-flight tasks from existing tracker into new requirements"
				});
			}
		} catch {
			/** No existing tracker — nothing to merge, proceed with new requirements only */
		}

		/** Initialize (or re-initialize) with the merged set */
		const tracker = await this.initializeTracking(task, mergedRequirements, timeoutThresholdSeconds, completionState);

		/** Emit reset event so case-service sets is_complete = false */
		logger.info({
			business_id: task.business_id,
			case_id: tracker.completionState.case_id,
			is_all_complete: tracker.completionState.is_all_complete,
			message: "[RERUN_DEBUG] About to emit rerun_started reset event"
		});
		await tracker.sendCompleteEvent("all", "rerun_started");
		logger.info({
			business_id: task.business_id,
			message: "[RERUN_DEBUG] Successfully emitted rerun_started reset event"
		});

		return tracker;
	}

	/**
	 * Get all required integrations for a business based on their settings
	 * Uses PLATFORM_PROCESS_MAPPING as source, filtered by customer settings
	 */
	static async getAllRequiredTasks(
		businessID: UUID,
		customerID: UUID | null
	): Promise<Partial<Record<IntegrationCategoryId, TaskType[]>>> {
		const requiredTasksByCategory: Partial<Record<IntegrationCategoryId, TaskType[]>> = {};

		// Build filter context (single fetch for all data)
		const ctx = await this.buildFilterContext(businessID, customerID);

		for (const [categoryId, taskCodeEntry] of Object.entries(PLATFORM_PROCESS_MAPPING)) {
			if (!taskCodeEntry || typeof taskCodeEntry !== "object") continue;

			const categoryIdNum = Number(categoryId) as IntegrationCategoryId;

			// Check if category should be included based on settings (e.g., accounting/banking enabled)
			if (!this.shouldCategoryRun(categoryIdNum, ctx)) {
				continue;
			}

			for (const [taskCode, platforms] of Object.entries(taskCodeEntry)) {
				if (taskCode === "isComplete" || !Array.isArray(platforms)) continue;

				for (const platform of platforms) {
					// Handle wildcard - for categories like ACCOUNTING/BANKING where any one integration succeeds
					if (platform === "*") {
						this.addTaskToCategory(requiredTasksByCategory, categoryId, "*", taskCode);
						continue;
					}

					// Check if platform should run (platform is already IntegrationPlatformId after wildcard check)
					if (this.shouldPlatformRun(platform, ctx)) {
						const platformCode = getEnumKeyByValue(INTEGRATION_ID, platform);
						if (!platformCode) {
							continue; // Skip this platform rather than using a numeric string
						}
						this.addTaskToCategory(requiredTasksByCategory, categoryId, platformCode, taskCode);
					}
				}
			}
		}

		logger.debug({ businessID, customerID, requiredTasksByCategory, message: "Required tasks after filtering" });
		return requiredTasksByCategory;
	}

	/**
	 * Check if a category should be included based on customer settings
	 * Categories like ACCOUNTING and BANKING are enabled via onboarding stages
	 */
	private static shouldCategoryRun(categoryId: IntegrationCategoryId, ctx: FilterContext): boolean {
		switch (categoryId) {
			case INTEGRATION_CATEGORIES.ACCOUNTING:
				// Accounting category requires accountingEnabled from onboarding stages
				return ctx.accountingEnabled;

			case INTEGRATION_CATEGORIES.BANKING:
				// Banking category requires bankingEnabled from onboarding stages
				return ctx.bankingEnabled;

			// All other categories are always included (platform-level filtering applies)
			default:
				return true;
		}
	}

	/** Helper to add task to category */
	private static addTaskToCategory(
		result: Partial<Record<IntegrationCategoryId, TaskType[]>>,
		categoryId: string,
		platformCode: string,
		taskCode: string
	): void {
		const category = Number(categoryId) as IntegrationCategoryId;
		result[category] = [...(result[category] ?? []), `${platformCode}:${taskCode}`.toLowerCase() as TaskType];
	}

	/** Build filter context with all necessary data (cached) */
	private static async buildFilterContext(businessID: UUID, customerID: UUID | null): Promise<FilterContext> {
		// Default to US business - most businesses are US-based
		const ctx: FilterContext = {
			isUS: true,
			country: "US",
			enabledCountries: [],
			settings: {},
			statuses: [],
			accountingEnabled: false,
			bankingEnabled: false,
			ownershipEnabled: false
		};

		// Get business country (separate try-catch to not block other fetches)
		// Defaults are already US, so we only update if we get a valid non-US country
		try {
			const bizDetails = await getBusinessDetails(businessID);
			if (bizDetails.status === "success" && bizDetails.data) {
				const rawCountry = bizDetails.data.address_country?.toUpperCase().trim();
				if (rawCountry) {
					ctx.country = rawCountry;
					ctx.isUS = ["US", "USA"].includes(ctx.country);
				}
				// If no country set, defaults (US) are already in place
			}
			// If API fails, defaults (US) are already in place
		} catch (error) {
			// API call failed - defaults (US) are already in place
			logger.warn({ businessID, error }, "Error fetching business details, using default US");
		}

		// Get customer ID if not provided (separate try-catch)
		if (!customerID) {
			try {
				const bizCustomers = await getBusinessCustomers(businessID);
				customerID = bizCustomers?.customer_ids?.[0] || null;
			} catch (error) {
				logger.warn({ businessID, error }, "Failed to fetch business customers");
			}
		}

		if (!customerID) {
			return ctx; // Can't fetch customer-specific settings without customerID
		}

		// Get customer settings & statuses in parallel (using Promise.allSettled for resilience)
		const [settingsResult, statusesResult] = await Promise.allSettled([
			customerIntegrationSettings.findById(customerID),
			customerIntegrationSettings.getIntegrationStatusForCustomer(customerID)
		]);

		ctx.settings = settingsResult.status === "fulfilled" ? settingsResult.value?.settings || {} : {};
		ctx.statuses = statusesResult.status === "fulfilled" ? statusesResult.value || [] : [];

		// Get enabled countries for non-US businesses
		if (!ctx.isUS) {
			try {
				const countries: CustomerCountryRecord[] = await getCustomerCountries(customerID, ONBOARDING_SETUP_ID.INTERNATIONAL_BUSINESS);
				ctx.enabledCountries = (countries || [])
					.filter((c): c is CustomerCountryRecord & { jurisdiction_code: string } =>
						(c.is_selected === true || c.is_enabled === true) &&
						typeof c.jurisdiction_code === "string" &&
						c.jurisdiction_code.length > 0
					)
					.map(c => c.jurisdiction_code.toUpperCase());
			} catch {
				ctx.enabledCountries = [];
			}
		}

		// Get accounting and banking enabled status from onboarding stages
		try {
			const onboardingSettings = await getOnboardingCustomerSettings(customerID as string);
			const customOnboarding = onboardingSettings?.find(
				(item: { code: string; is_enabled: boolean }) =>
					item.code === CUSTOM_ONBOARDING_SETUP.MODIFY_PAGES_FIELDS_SETUP && item.is_enabled
			);

			if (customOnboarding) {
				const stagesSettings = await getCustomerOnboardingStagesSettings(
					customerID as string,
					CUSTOM_ONBOARDING_SETUP.MODIFY_PAGES_FIELDS_SETUP
				);

				// Find banking, accounting, and ownership stages
				for (const stage of stagesSettings || []) {
					if (stage.stage_code === "banking" && stage.is_enabled) {
						ctx.bankingEnabled = true;
					}
					if (stage.stage_code === "accounting" && stage.is_enabled) {
						ctx.accountingEnabled = true;
					}
					if (stage.stage_code === "ownership" && stage.is_enabled) {
						ctx.ownershipEnabled = true;
					}
				}
			}
		} catch (error) {
			logger.warn({ customerID, error }, "Failed to fetch onboarding stages settings for accounting/banking");
		}

		return ctx;
	}

	/** Check if platform should run based on context */
	private static shouldPlatformRun(platformId: IntegrationPlatformId, ctx: FilterContext): boolean {
		/** Get integration status from core_integration_status/data_customer_integration_status */
		const getStatus = (code: string): string | undefined =>
			ctx.statuses.find(s => s.integration_code === code)?.status;

		/** Check if a setting is explicitly enabled (must exist AND have ACTIVE status) */
		const isSettingActive = (key: keyof CustomerIntegrationSettingsSettingsData): boolean => {
			const setting = ctx.settings[key];
			return setting?.status === "ACTIVE";
		};

		/** Check if integration status is explicitly enabled (opt-in: undefined = disabled) */
		const isStatusEnabled = (code: string, allowedStatuses: string[] = ["ENABLED"]): boolean => {
			const status = getStatus(code);
			return status !== undefined && allowedStatuses.includes(status);
		};

		switch (platformId) {
			// US-only platforms
			case INTEGRATION_ID.MIDDESK:
				// MIDDESK: opt-out behavior - runs unless explicitly DISABLED
				return ctx.isUS && getStatus("middesk") !== "DISABLED";

			case INTEGRATION_ID.BASELAYER:
				// BASELAYER: same as MIDDESK - opt-out behavior, runs unless explicitly DISABLED
				//return ctx.isUS && getStatus("baselayer") !== "DISABLED";
				return false; // Temporarily disable Baselayer until is implemented and tested

			case INTEGRATION_ID.EQUIFAX:
				// EQUIFAX: requires explicit ACTIVE setting
				return ctx.isUS && isSettingActive("equifax");

			case INTEGRATION_ID.VERDATA:
				// VERDATA: opt-in - requires explicit ENABLED/REQUIRED status AND active BJL setting
				return ctx.isUS && isStatusEnabled("verdata", ["ENABLED", "REQUIRED"]) && isSettingActive("bjl");

			// Non-US platforms
			case INTEGRATION_ID.TRULIOO:
				// TRULIOO: opt-in - requires explicit ENABLED status AND country in enabled list
				return (
					!ctx.isUS &&
					isStatusEnabled("trulioo") &&
					ctx.enabledCountries.length > 0 &&
					ctx.enabledCountries.includes(ctx.country)
				);

			case INTEGRATION_ID.CANADA_OPEN:
				return ctx.country === "CA";

			// Settings-based platforms (no country restriction)
			case INTEGRATION_ID.PLAID_IDV:
				return isSettingActive("identity_verification") && ctx.ownershipEnabled;

			case INTEGRATION_ID.GIACT:
				return isSettingActive("gverify");

			case INTEGRATION_ID.NPI:
				return isSettingActive("npi");

			case INTEGRATION_ID.ADVERSE_MEDIA:
				return isSettingActive("adverse_media");

			case INTEGRATION_ID.WORTH_WEBSITE_SCANNING:
				return isSettingActive("website");

			// NOTE: Banking platforms (PLAID, MANUAL_BANKING) and Accounting platforms
			// (RUTTER_*, MANUAL_ACCOUNTING) are filtered at CATEGORY level by shouldCategoryRun().
			// No need to check here - they use wildcards and category is already filtered.

			// Always run (no restrictions)
			case INTEGRATION_ID.ZOOMINFO:
			case INTEGRATION_ID.OPENCORPORATES:
			case INTEGRATION_ID.MATCH:
			case INTEGRATION_ID.SERP_SCRAPE:
			case INTEGRATION_ID.GOOGLE_BUSINESS_REVIEWS:
			default:
				return true;
		}
	}

	static getRequiredTasksByTaskType(
		taskTypes: TaskType[],
		processMapping: ProcessCompletionPlatformMapping = PLATFORM_PROCESS_MAPPING
	): Partial<Record<IntegrationCategoryId, TaskType[]>> {
		const requiredTasksByCategory: Partial<Record<IntegrationCategoryId, TaskType[]>> = {};
		// Find the parent IntegrationCategoryId for each tasktype
		for (const taskType of taskTypes) {
			const categories = this.getCategoryForTaskType(taskType, processMapping);
			for (const category of categories) {
				requiredTasksByCategory[category] = [...(requiredTasksByCategory[category] ?? []), taskType];
			}
		}
		return requiredTasksByCategory;
	}

	private static extractPlatform = (platformRaw: string): [string, "*" | IntegrationPlatformId | null] => {
		if (platformRaw === "*") {
			return ["*", "*"];
		}
		const platformKey: string = platformRaw.toUpperCase();
		const platformId: IntegrationPlatformId | null = INTEGRATION_ID[platformKey] ?? null;
		return [platformKey, platformId];
	};

	private static getCategoryForTaskType = (
		taskType: TaskType,
		processMapping: ProcessCompletionPlatformMapping
	): IntegrationCategoryId[] => {
		const categories: IntegrationCategoryId[] = [];
		const [platformRaw, taskCode] = taskType.split(":");
		if (!platformRaw || !taskCode) return categories;

		const [platformKey, platformId] = this.extractPlatform(platformRaw);

		const platformMatches = (iterationPlatform: unknown): boolean => {
			if (platformKey === "*") return true;
			if (iterationPlatform === "*") return true;
			if (platformId == null || platformId === "*") return false;

			return Number(iterationPlatform) === platformId;
		};

		for (const [categoryId, taskCodesEntry] of Object.entries(processMapping)) {
			if (!taskCodesEntry || typeof taskCodesEntry !== "object") continue;

			// We already know the taskCode we care about; avoid iterating every task code in the category.
			const iterationPlatforms = (taskCodesEntry as Record<string, unknown>)[taskCode];
			if (!Array.isArray(iterationPlatforms)) continue;

			for (const iterationPlatform of iterationPlatforms) {
				if (!platformMatches(iterationPlatform)) continue;
				categories.push(Number(categoryId) as IntegrationCategoryId);
				break; // prevent duplicates for the same category
			}
		}
		return categories;
	};

	/**
	 * Get current completion state for a business
	 */
	async getCompletionState(): Promise<CompletionState> {
		const state = await redis.hgetall<CompletionState>(this.redisKey);
		if (!state || Object.keys(state).length === 0) {
			throw new IntegrationsCompletionTrackerError("No completion state found");
		}
		this.completionState = state;
		return state;
	}

	/**
	 * Check for timed out integrations and mark them as timed out
	 */
	async checkAndMarkTimeouts(): Promise<boolean> {
		let newTimeouts: number = 0;
		const now = new Date();
		const timeoutThresholdMs = this.completionState.timeout_threshold_seconds * 1000;
		const stateChanges: Partial<CompletionState> = {
			timed_out_tasks: [...(this.completionState.timed_out_tasks ?? [])]
		};

		// If tracking hasn't started yet (no started_at), don't check for timeouts
		if (!this.completionState.started_at) {
			return this.completionState.is_all_complete;
		}
		const trackingStartTime = new Date(this.completionState.started_at);
		const elapsedMs = now.getTime() - trackingStartTime.getTime();
		const hasTimedOut = elapsedMs > timeoutThresholdMs;
		// Check each required integration for timeout
		for (const taskType of Array.from(this.completionState.required_tasks ?? [])) {
			// Skip if already processed (completed, failed, or timed out)
			if (
				this.completionState.completed_tasks?.includes(taskType) ||
				this.completionState.timed_out_tasks?.includes(taskType)
			) {
				continue;
			}

			// Check if this integration has been running too long
			if (hasTimedOut) {
				// Mark as timed out
				stateChanges.timed_out_tasks?.push(taskType);
				newTimeouts++;

				logger.debug({
					completionState: this.completionState,
					taskType,
					elapsedMs,
					timeoutThresholdMs,
					message: "Integration marked as timed out"
				});
			}
		}

		if (hasTimedOut) {
			// Update completion status
			await redis.hincrby<CompletionState>(this.redisKey, "tasks_timed_out", newTimeouts);
			const totalProcessed = this.completionState.tasks_completed + this.completionState.tasks_timed_out + newTimeouts;
			stateChanges.is_all_complete = Boolean(totalProcessed >= this.completionState.tasks_required);

			// Save updated state
			await this.updateCompletionState(stateChanges);

			logger.debug({
				completionState: this.completionState,
				message: "Updated completion state with timeouts"
			});
		}

		return this.completionState.is_all_complete;
	}

	/**
	 * Clean up tracking data for a business
	 */
	async cleanupTracking(): Promise<void> {
		await redis.delete(this.redisKey);

		logger.debug({
			businessID: this.completionState.business_id,
			message: "Cleaned up all integrations completion tracking"
		});
	}

	/**
	 * Get the redis key pattern
	 * @returns The redis key
	 */
	public static getRedisKeyPattern(): string {
		return this.REDIS_KEY_PREFIX;
	}

	/**
	 * Create the ALL_INTEGRATIONS_COMPLETE event payload with actual completion state
	 */
	public async sendCompleteEvent(category: IntegrationCategoryId | "all", action: string): Promise<void> {
		// Get the actual completion state from Redis

		// Get Category Name
		const categoryName = category === "all" ? "all" : getEnumKeyByValue(INTEGRATION_CATEGORIES, category);

		const event: CompletionEvent = {
			category_id: category,
			category_name: categoryName,
			business_id: this.completionState.business_id,
			customer_id: this.completionState.customer_id,
			case_id: this.completionState.case_id ?? null,
			score_trigger_id: this.completionState.score_trigger_id ?? null,
			completion_state: this.completionState,
			action
		};
		logger.info({
			business_id: event.business_id,
			case_id: event.case_id,
			category_name: event.category_name,
			action: event.action,
			is_all_complete: event.completion_state.is_all_complete,
			message: "[RERUN_DEBUG] sendCompleteEvent — Kafka payload summary"
		});
	await producer.send({
		topic: kafkaTopics.NOTIFICATIONS,
		messages: [
			{
				key: this.completionState.business_id,
				value: {
					event: kafkaEvents.INTEGRATION_CATEGORY_COMPLETE,
					...event
				}
			}
		]
	});
	}

	private getTaskTypes(task: IBusinessIntegrationTaskEnriched): {
		taskType: TaskType;
		platformWildcard: TaskType;
		taskCodeWildcard: TaskType;
		allIterationTypes: TaskType[];
	} {
		const taskType: TaskType = `${task.platform_code.toLowerCase() as IntegrationPlatform}:${task.task_code}`;
		const platformWildcard: TaskType = `*:${task.task_code}`;
		const taskCodeWildcard: TaskType = `${task.platform_code.toLowerCase() as IntegrationPlatform}:*`;
		return {
			taskType,
			platformWildcard,
			taskCodeWildcard,
			allIterationTypes: [taskType, platformWildcard, taskCodeWildcard]
		};
	}

	private async calculateCompletion(
		task: IBusinessIntegrationTaskEnriched
	): Promise<null | { completedTaskTypes: TaskType[]; completedCategories: IntegrationCategoryId[] }> {
		const { taskType, allIterationTypes } = this.getTaskTypes(task);

		// If we got here and never started the timer, start it now
		if (!this.completionState.started_at) {
			await this.updateCompletionState({ started_at: new Date().toISOString() });
		}

		// Check if this integration is required
		if (!allIterationTypes.some(iterationType => this.completionState.required_tasks?.includes(iterationType))) {
			await redis.hincrby<CompletionState>(this.redisKey, "tasks_ignored");
			return null;
		}
		// Check if already processed
		if (allIterationTypes.some(iterationType => this.completionState.completed_tasks?.includes(iterationType))) {
			return null;
		}

		// Check if the category is now complete
		const categoriesInScope: IntegrationCategoryId[] = Object.entries(this.completionState.required_tasks_by_category)
			.filter(([_, tasks]) => tasks?.includes(taskType))
			.map(([categoryId]) => Number(categoryId) as IntegrationCategoryId);
		// See if any of the categories in scope are now complete: every entry in required_tasks_by_category for the category is now complete
		const allCompletedTasks = new Set([
			...this.completionState.completed_tasks,
			...this.completionState.timed_out_tasks,
			...allIterationTypes
		]);
		const categoriesNowComplete = categoriesInScope.filter(category =>
			this.completionState.required_tasks_by_category?.[category]?.every(task => allCompletedTasks.has(task))
		);
		return {
			completedTaskTypes: Array.from(allCompletedTasks) as TaskType[],
			completedCategories: categoriesNowComplete
		};
	}

	private async updateCompletionState(stateChanges: Partial<CompletionState>): Promise<CompletionState | null> {
		let updates = 0;
		const completionState: CompletionState = await this.getCompletionState();
		for (const [key, value] of Object.entries(stateChanges)) {
			completionState[key] = value;
			updates++;
		}
		if (updates > 0) {
			completionState.updated_at = new Date().toISOString();
			await redis.hset<Partial<CompletionState>>(this.redisKey, completionState);
		}
		return this.getCompletionState();
	}

	/**
	 * Marks a task as completed and updates the overall completion state
	 */
	async handleTaskComplete(task: IBusinessIntegrationTaskEnriched): Promise<IntegrationCategoryId[]> {
		const completionResult = await this.calculateCompletion(task);
		if (!completionResult) {
			return [];
		}

		// Update state
		await redis.hincrby<CompletionState>(this.redisKey, "tasks_completed");

		const updates: Partial<CompletionState> = {};
		// Check if all integrations are complete
		updates.is_all_complete =
			(this.completionState.tasks_completed ?? 0) + 1 >= (this.completionState.tasks_required ?? 0);
		updates.completed_tasks = completionResult.completedTaskTypes;
		await this.updateCompletionState(updates);

		// If there are any new categories that are now complete, update the completion state and send the complete event
		let newlyCompletedCategories: IntegrationCategoryId[] = [];
		if (completionResult.completedCategories?.length > 0) {
			const existing = this.completionState.completed_categories ?? [];
			newlyCompletedCategories = completionResult.completedCategories.filter(category => !existing.includes(category));
			if (newlyCompletedCategories.length > 0) {
				for (const category of newlyCompletedCategories) {
					const categoryUpdates: Partial<CompletionState> = {
						// deduplicate the categories by forcing as a set then back to an array
						completed_categories: this.deduplicateArray<IntegrationCategoryId>(
							this.completionState.completed_categories,
							category
						)
					};
					await this.updateCompletionState(categoryUpdates);

					/** Only emit per-category events for real categories in INTEGRATION_CATEGORIES */
					const categoryName = getEnumKeyByValue(INTEGRATION_CATEGORIES, category);
					if (categoryName) {
						await this.sendCompleteEvent(category, "category_completed");
					}
				}
			}
		}

		// if all integrations are complete, emit the all integrations complete event
		if (updates.is_all_complete) {
			logger.info({
				business_id: task.business_id,
				message: "[RERUN_DEBUG] Emitting all integrations complete event"
			});

			await this.emitAllIntegrationsCompleteEvent(task);
		}

		logger.debug({
			task,
			completionState: this.completionState,
			message: "Updated all integrations completion state"
		});

		return newlyCompletedCategories;
	}

	/**
	 * Helper function to deduplicate two arrays of the same type
	 * Converts to a set then back to an array
	 * @param arr1
	 * @param arr2
	 * @returns
	 */
	private deduplicateArray<T>(arr1: T[], arr2: T | T[]): T[] {
		if (!Array.isArray(arr2)) {
			arr2 = [arr2];
		}
		return Array.from(new Set([...(arr1 ?? []), ...(arr2 ?? [])]));
	}

	/**
	 * Emit ALL_INTEGRATIONS_COMPLETE event
	 */
	private async emitAllIntegrationsCompleteEvent<T = any>(task: IBusinessIntegrationTaskEnriched<T>): Promise<void> {
		try {
			const { business_id: businessID } = task;

			// Create the event payload
			await this.sendCompleteEvent("all", "all_integrations_complete");

			logger.info({
				businessID,
				customerID: task.customer_id,
				caseID: task.case_id,
				scoreTriggerID: task.business_score_trigger_id as UUID,
				action: "all_integrations_complete",
				completed: this.completionState.tasks_completed,
				total: this.completionState.tasks_required,
				message: "Emitted ALL_INTEGRATIONS_COMPLETE event - scoring can now proceed"
			});
			await this.cleanupTracking();
		} catch (error) {
			logger.error({
				business_id: task.business_id,
				error: error instanceof Error ? error.message : String(error),
				message: "Failed to emit ALL_INTEGRATIONS_COMPLETE event"
			});
		}
	}

	/**
	 * Get Redis key for a business
	 */
	private static getRedisKey(businessID: string): string {
		return `${this.REDIS_KEY_PREFIX}${businessID}`;
	}
}

class IntegrationsCompletionTrackerError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "IntegrationsCompletionTrackerError";
	}
}
