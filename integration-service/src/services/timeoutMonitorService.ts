import { IntegrationsCompletionTracker, type CompletionState } from "#helpers/integrationsCompletionTracker";
import { logger } from "#helpers/logger";
import { redis } from "#helpers/redis";
import BullQueue from "#helpers/bull-queue";
import type { UUID } from "crypto";
import type { IntegrationCategoryId } from "#constants";
import type Bull from "bull";

/**
 * Timeout Monitor Service using Bull Queue
 * Provides robust periodic monitoring of integration timeouts and completion events
 */
export class TimeoutMonitorService {
	private static timeoutQueue: Bull.Queue | null = null;
	private static readonly TIMEOUT_CHECK_INTERVAL_SECONDS: number = 60; // 1 minute
	private static isInitialized: boolean = false;
	private static readonly JOB_ID: string = "timeout-monitor";

	/**
	 * Initialize the timeout monitoring service with Bull Queue
	 */
	static async initialize(): Promise<void> {
		if (this.isInitialized) {
			logger.warn("Timeout monitoring service is already initialized");
			return;
		}

		try {
			this.timeoutQueue = new BullQueue("timeout-monitor").queue;

			// Process timeout checks
			this.timeoutQueue.process("check-timeouts", 1, async job => {
				await this.checkAllBusinessesForTimeouts();
			});

			// Schedule recurring timeout checks every minute
			await this.timeoutQueue.add(
				"check-timeouts",
				{},
				{
					jobId: this.JOB_ID,
					repeat: { every: this.TIMEOUT_CHECK_INTERVAL_SECONDS * 1000 },
					removeOnComplete: true,
					removeOnFail: false
				}
			);

			this.isInitialized = true;
		} catch (error) {
			logger.error({
				error: error instanceof Error ? error.message : String(error),
				message: "Failed to initialize timeout monitoring service"
			});
			throw error;
		}
	}

	/**
	 * Stop the timeout monitoring service
	 */
	static async stop(): Promise<void> {
		if (!this.isInitialized) {
			logger.warn("Timeout monitoring service is not initialized");
			return;
		}

		try {
			if (this.timeoutQueue) {
				await this.timeoutQueue.close();
				this.timeoutQueue = null;
			}

			this.isInitialized = false;
			logger.info("Stopped timeout monitoring service");
		} catch (error) {
			logger.error({
				error: error instanceof Error ? error.message : String(error),
				message: "Failed to stop timeout monitoring service"
			});
		}
	}

	/**
	 * Get service status
	 */
	static getStatus(): { isInitialized: boolean; jobId: string; checkIntervalMs: number } {
		return {
			isInitialized: this.isInitialized,
			jobId: this.JOB_ID,
			checkIntervalMs: this.TIMEOUT_CHECK_INTERVAL_SECONDS * 1000
		};
	}

	static async stopJob(jobId?: string): Promise<void> {
		if (!jobId) {
			jobId = this.JOB_ID;
		}
		await this.timeoutQueue?.removeJobs(`${jobId}*`);
		await this.timeoutQueue?.removeRepeatableByKey(jobId);
	}
	/**
	 * Check all businesses for timed out integrations
	 */
	private static async checkAllBusinessesForTimeouts(): Promise<void> {
		try {
			// Get all active completion tracking keys from Redis
			const keys = await this.getAllActiveCompletionKeys();

			logger.debug({
				activeBusinesses: keys.length,
				message: "Checking businesses for timeouts"
			});

			for (const key of keys) {
				const businessID = this.extractBusinessIDFromKey(key);
				if (!businessID) continue;

				await this.checkBusinessForTimeouts(businessID as UUID);
			}
		} catch (error) {
			logger.error({
				error: error instanceof Error ? error.message : String(error),
				message: "Failed to check businesses for timeouts"
			});
		}
	}

	/**
	 * Check a specific business for timeouts
	 */
	private static async checkBusinessForTimeouts(businessID: UUID): Promise<void> {
		try {
			const integrationsCompletionTracker = await IntegrationsCompletionTracker.forBusiness(businessID);
			const currentState = await integrationsCompletionTracker.getCompletionState();

			const isNowComplete = await integrationsCompletionTracker.checkAndMarkTimeouts();
			// If completion status changed due to timeouts, emit event
			if (isNowComplete) {
				for (const category of Object.keys(currentState.required_tasks_by_category)) {
					const categoryID = Number(category) as IntegrationCategoryId;
					if (!currentState.completed_categories.includes(categoryID)) {
						await integrationsCompletionTracker.sendCompleteEvent(categoryID, "timeout_monitor");
					}
				}
				await this.emitTimeoutCompletionEvent(businessID);
				await integrationsCompletionTracker.cleanupTracking();
			}
		} catch (error) {
			logger.error({
				businessID,
				error,
				message: "Failed to check business for timeouts"
			});
		}
	}

	/**
	 * Emit completion event when timeouts cause completion
	 */
	private static async emitTimeoutCompletionEvent(businessID: UUID): Promise<void> {
		try {
			const integrationsCompletionTracker = await IntegrationsCompletionTracker.forBusiness(businessID);
			const completionState = await integrationsCompletionTracker.getCompletionState();

			await integrationsCompletionTracker.sendCompleteEvent("all", "timeout_monitor");

			logger.info({
				businessID,
				timedOutIntegrations: completionState.timed_out_tasks,
				timeoutThresholdSeconds: completionState.timeout_threshold_seconds,
				message: "Emitted ALL_INTEGRATIONS_COMPLETE event due to timeouts"
			});
		} catch (error) {
			logger.error({
				businessID,
				error: error instanceof Error ? error.message : String(error),
				message: "Failed to emit timeout completion event"
			});
		}
	}

	/**
	 * Get all active completion tracking keys from Redis using proper Redis helper
	 */
	private static async getAllActiveCompletionKeys(): Promise<string[]> {
		try {
			const redisKeyPattern = IntegrationsCompletionTracker.getRedisKeyPattern();
			const pattern = `${redisKeyPattern}*`;

			// Use the Redis helper's getHashByPattern method which uses scanStream internally
			const result = await redis.getHashByPattern<CompletionState>(pattern, 1000);

			if (!result || Object.keys(result).length === 0) {
				logger.debug({
					pattern,
					message: "No active completion tracking keys found"
				});
				return [];
			}

			// Each key is the actual Redis key that matched the pattern
			const keys: string[] = [];
			for (const [key, value] of Object.entries(result)) {
				if (value) {
					// The value is the Redis key that matched the pattern
					if (typeof key === "string" && key.startsWith(redisKeyPattern)) {
						keys.push(key);
					}
				}
			}

			logger.debug({
				pattern,
				foundKeys: keys.length,
				message: "Retrieved active completion tracking keys"
			});

			return keys;
		} catch (error) {
			logger.error({
				error,
				message: "Failed to scan Redis keys for active completion tracking"
			});
			return [];
		}
	}

	/**
	 * Extract business ID from Redis key
	 */
	private static extractBusinessIDFromKey(key: string): string | null {
		const prefix = IntegrationsCompletionTracker.getRedisKeyPattern();
		if (key.startsWith(prefix)) {
			return key.substring(prefix.length);
		}
		return null;
	}
}
