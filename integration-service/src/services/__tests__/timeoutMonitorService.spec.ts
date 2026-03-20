import { TimeoutMonitorService } from "../timeoutMonitorService";
import { IntegrationsCompletionTracker, type CompletionState } from "#helpers/integrationsCompletionTracker";
import { logger } from "#helpers/logger";
import { producer } from "#helpers/kafka";
import { redis } from "#helpers/redis";
import BullQueue from "#helpers/bull-queue";
import { INTEGRATION_CATEGORIES } from "#constants";
import type { UUID } from "crypto";

// Mock dependencies
jest.mock("#helpers/logger", () => ({
	logger: {
		debug: jest.fn(),
		error: jest.fn(),
		info: jest.fn(),
		warn: jest.fn()
	}
}));

jest.mock("#helpers/kafka", () => ({
	producer: {
		send: jest.fn()
	}
}));

jest.mock("#helpers/redis", () => ({
	redis: {
		getHashByPattern: jest.fn()
	}
}));

jest.mock("#helpers/bull-queue", () => {
	return jest.fn().mockImplementation(() => ({
		queue: {
			process: jest.fn(),
			add: jest.fn(),
			close: jest.fn(),
			removeJobs: jest.fn(),
			removeRepeatableByKey: jest.fn()
		}
	}));
});

// Mock IntegrationsCompletionTracker as a class with static methods
jest.mock("#helpers/integrationsCompletionTracker", () => {
	return {
		IntegrationsCompletionTracker: {
			forBusiness: jest.fn(),
			getRedisKeyPattern: jest.fn()
		}
	};
});

describe("TimeoutMonitorService", () => {
	const mockBusinessId: UUID = "550e8400-e29b-41d4-a716-446655440000";
	const mockBusinessId2: UUID = "550e8400-e29b-41d4-a716-446655440001";

	let mockQueue: any;
	let mockTrackerInstance: any;

	beforeEach(() => {
		jest.clearAllMocks();

		// Reset the service state
		(TimeoutMonitorService as any).isInitialized = false;
		(TimeoutMonitorService as any).timeoutQueue = null;

		// Setup default mock queue
		mockQueue = {
			process: jest.fn(),
			add: jest.fn().mockResolvedValue({}),
			close: jest.fn().mockResolvedValue(undefined),
			removeJobs: jest.fn().mockResolvedValue(undefined),
			removeRepeatableByKey: jest.fn().mockResolvedValue(undefined)
		};

		(BullQueue as jest.MockedClass<typeof BullQueue>).mockImplementation(
			() =>
				({
					queue: mockQueue
				}) as BullQueue
		);

		// Create a mock tracker instance with all the methods
		mockTrackerInstance = {
			getCompletionState: jest.fn(),
			checkAndMarkTimeouts: jest.fn(),
			getTimeoutStatus: jest.fn(),
			cleanupTracking: jest.fn(),
			sendCompleteEvent: jest.fn()
		};

		// Setup default IntegrationsCompletionTracker mocks
		(IntegrationsCompletionTracker.forBusiness as jest.Mock).mockResolvedValue(mockTrackerInstance);
		(IntegrationsCompletionTracker.getRedisKeyPattern as jest.Mock).mockReturnValue(
			"{integration_completion}:all_integrations_completion:"
		);

		// Setup default instance method responses
		mockTrackerInstance.getCompletionState.mockResolvedValue(null);
		mockTrackerInstance.checkAndMarkTimeouts.mockResolvedValue(false);
		mockTrackerInstance.getTimeoutStatus.mockResolvedValue({
			hasTimeouts: false,
			timedOutTasks: [],
			timeoutThresholdSeconds: 300
		});
		mockTrackerInstance.cleanupTracking.mockResolvedValue(undefined);
		mockTrackerInstance.sendCompleteEvent.mockResolvedValue(undefined);

		(redis.getHashByPattern as jest.Mock).mockResolvedValue({});
		(producer.send as jest.Mock).mockResolvedValue(undefined);
	});

	describe("initialize", () => {
		it("should successfully initialize the service", async () => {
			await TimeoutMonitorService.initialize();

			expect(BullQueue).toHaveBeenCalledWith("timeout-monitor");
			expect(mockQueue.process).toHaveBeenCalledWith("check-timeouts", 1, expect.any(Function));
			expect(mockQueue.add).toHaveBeenCalledWith(
				"check-timeouts",
				{},
				{
					jobId: "timeout-monitor",
					repeat: { every: 60000 },
					removeOnComplete: true,
					removeOnFail: false
				}
			);

			const status = TimeoutMonitorService.getStatus();
			expect(status.isInitialized).toBe(true);
		});

		it("should warn if already initialized", async () => {
			await TimeoutMonitorService.initialize();
			await TimeoutMonitorService.initialize();

			expect(logger.warn).toHaveBeenCalledWith("Timeout monitoring service is already initialized");
			expect(BullQueue).toHaveBeenCalledTimes(1);
		});

		it("should handle initialization errors", async () => {
			const error = new Error("Bull queue error");
			(BullQueue as jest.MockedClass<typeof BullQueue>).mockImplementation(() => {
				throw error;
			});

			await expect(TimeoutMonitorService.initialize()).rejects.toThrow(error);

			expect(logger.error).toHaveBeenCalledWith({
				error: "Bull queue error",
				message: "Failed to initialize timeout monitoring service"
			});
		});
	});

	describe("stop", () => {
		it("should successfully stop the service", async () => {
			await TimeoutMonitorService.initialize();
			await TimeoutMonitorService.stop();

			expect(mockQueue.close).toHaveBeenCalled();
			expect(logger.info).toHaveBeenCalledWith("Stopped timeout monitoring service");

			const status = TimeoutMonitorService.getStatus();
			expect(status.isInitialized).toBe(false);
		});

		it("should warn if not initialized", async () => {
			await TimeoutMonitorService.stop();

			expect(logger.warn).toHaveBeenCalledWith("Timeout monitoring service is not initialized");
			expect(mockQueue.close).not.toHaveBeenCalled();
		});

		it("should handle stop errors gracefully", async () => {
			await TimeoutMonitorService.initialize();

			const error = new Error("Close error");
			mockQueue.close.mockRejectedValue(error);

			await TimeoutMonitorService.stop();

			expect(logger.error).toHaveBeenCalledWith({
				error: "Close error",
				message: "Failed to stop timeout monitoring service"
			});
		});
	});

	describe("getStatus", () => {
		it("should return correct status when not initialized", () => {
			const status = TimeoutMonitorService.getStatus();

			expect(status).toEqual({
				isInitialized: false,
				jobId: "timeout-monitor",
				checkIntervalMs: 60000
			});
		});

		it("should return correct status when initialized", async () => {
			await TimeoutMonitorService.initialize();
			const status = TimeoutMonitorService.getStatus();

			expect(status).toEqual({
				isInitialized: true,
				jobId: "timeout-monitor",
				checkIntervalMs: 60000
			});
		});
	});

	describe("stopJob", () => {
		beforeEach(async () => {
			await TimeoutMonitorService.initialize();
		});

		it("should stop the default job when no jobId provided", async () => {
			await TimeoutMonitorService.stopJob();

			expect(mockQueue.removeJobs).toHaveBeenCalledWith("timeout-monitor*");
			expect(mockQueue.removeRepeatableByKey).toHaveBeenCalledWith("timeout-monitor");
		});

		it("should stop a specific job when jobId provided", async () => {
			await TimeoutMonitorService.stopJob("custom-job-id");

			expect(mockQueue.removeJobs).toHaveBeenCalledWith("custom-job-id*");
			expect(mockQueue.removeRepeatableByKey).toHaveBeenCalledWith("custom-job-id");
		});
	});

	describe("checkAllBusinessesForTimeouts (via process callback)", () => {
		let processCallback: Function;

		beforeEach(async () => {
			await TimeoutMonitorService.initialize();
			processCallback = mockQueue.process.mock.calls[0][2];
		});

		it("should check all businesses when keys found", async () => {
			const redisKeys = {
				[`{integration_completion}:all_integrations_completion:${mockBusinessId}`]: { business_id: mockBusinessId },
				[`{integration_completion}:all_integrations_completion:${mockBusinessId2}`]: { business_id: mockBusinessId2 }
			};

			(redis.getHashByPattern as jest.Mock).mockResolvedValue(redisKeys);

			const mockState: CompletionState = {
				business_id: mockBusinessId,
				customer_id: null,
				case_id: null,
				score_trigger_id: null,
				required_tasks: [],
				required_tasks_by_category: {},
				completed_categories: [],
				completed_tasks: [],
				timed_out_tasks: [],
				tasks_required: 1,
				tasks_completed: 0,
				tasks_timed_out: 0,
				tasks_ignored: 0,
				is_all_complete: false,
				updated_at: new Date().toISOString(),
				timeout_threshold_seconds: 480,
				started_at: new Date().toISOString(),
				initialized_at: new Date().toISOString()
			};

			mockTrackerInstance.getCompletionState.mockResolvedValue(mockState);

			await processCallback({});

			expect(redis.getHashByPattern).toHaveBeenCalledWith(
				"{integration_completion}:all_integrations_completion:*",
				1000
			);
			expect(IntegrationsCompletionTracker.forBusiness).toHaveBeenCalledTimes(2);
			expect(mockTrackerInstance.checkAndMarkTimeouts).toHaveBeenCalledTimes(2);
		});

		it("should handle no active businesses", async () => {
			(redis.getHashByPattern as jest.Mock).mockResolvedValue({});

			await processCallback({});

			expect(IntegrationsCompletionTracker.forBusiness).not.toHaveBeenCalled();
		});

		it("should handle Redis errors gracefully", async () => {
			const error = new Error("Redis error");
			(redis.getHashByPattern as jest.Mock).mockRejectedValue(error);

			await processCallback({});

			expect(logger.error).toHaveBeenCalled();
		});

		it("should skip invalid keys", async () => {
			const redisKeys = {
				"invalid:key": { business_id: mockBusinessId }
			};

			(redis.getHashByPattern as jest.Mock).mockResolvedValue(redisKeys);

			await processCallback({});

			expect(IntegrationsCompletionTracker.forBusiness).not.toHaveBeenCalled();
		});
	});

	describe("checkBusinessForTimeouts (via process callback)", () => {
		let processCallback: Function;

		beforeEach(async () => {
			await TimeoutMonitorService.initialize();
			processCallback = mockQueue.process.mock.calls[0][2];
		});

		it("should handle business with no completion state", async () => {
			const redisKeys = {
				[`{integration_completion}:all_integrations_completion:${mockBusinessId}`]: { business_id: mockBusinessId }
			};

			(redis.getHashByPattern as jest.Mock).mockResolvedValue(redisKeys);
			// Mock forBusiness to throw an error (no state found)
			const error = new Error("No completion state found");
			error.name = "IntegrationsCompletionTrackerError";
			(IntegrationsCompletionTracker.forBusiness as jest.Mock).mockRejectedValue(error);

			await processCallback({});

			expect(logger.error).toHaveBeenCalledWith({
				businessID: mockBusinessId,
				error,
				message: "Failed to check business for timeouts"
			});
			expect(mockTrackerInstance.checkAndMarkTimeouts).not.toHaveBeenCalled();
		});

		it("should emit events when business completes due to timeouts", async () => {
			const mockState: CompletionState = {
				business_id: mockBusinessId,
				customer_id: null,
				case_id: null,
				score_trigger_id: null,
				required_tasks: [],
				required_tasks_by_category: {
					[INTEGRATION_CATEGORIES.PUBLIC_RECORDS]: []
				},
				completed_categories: [],
				completed_tasks: [],
				timed_out_tasks: ["verdata:fetch_public_records"],
				tasks_required: 1,
				tasks_completed: 0,
				tasks_timed_out: 1,
				is_all_complete: true,
				updated_at: new Date().toISOString(),
				timeout_threshold_seconds: 480,
				tasks_ignored: 0,
				initialized_at: new Date().toISOString(),
				started_at: new Date().toISOString()
			};

			const redisKeys = {
				[`{integration_completion}:all_integrations_completion:${mockBusinessId}`]: { business_id: mockBusinessId }
			};

			(redis.getHashByPattern as jest.Mock).mockResolvedValue(redisKeys);
			mockTrackerInstance.getCompletionState.mockResolvedValue(mockState);
			mockTrackerInstance.checkAndMarkTimeouts.mockResolvedValue(true);
			mockTrackerInstance.getTimeoutStatus.mockResolvedValue({
				hasTimeouts: true,
				timedOutTasks: ["verdata:fetch_public_records"],
				timeoutThresholdSeconds: 480
			});

			await processCallback({});

			// Should emit category complete events
			expect(mockTrackerInstance.sendCompleteEvent).toHaveBeenCalled();
			expect(mockTrackerInstance.cleanupTracking).toHaveBeenCalled();
		});

		it("should not emit category events if already completed", async () => {
			const mockState: CompletionState = {
				business_id: mockBusinessId,
				customer_id: null,
				case_id: null,
				score_trigger_id: null,
				required_tasks: [],
				required_tasks_by_category: {
					[INTEGRATION_CATEGORIES.PUBLIC_RECORDS]: []
				},
				completed_categories: [INTEGRATION_CATEGORIES.PUBLIC_RECORDS], // Already completed
				completed_tasks: [],
				timed_out_tasks: [],
				tasks_required: 1,
				tasks_completed: 0,
				tasks_timed_out: 0,
				is_all_complete: true,
				updated_at: new Date().toISOString(),
				timeout_threshold_seconds: 480,
				tasks_ignored: 0,
				started_at: new Date().toISOString(),
				initialized_at: new Date().toISOString()
			};

			const redisKeys = {
				[`{integration_completion}:all_integrations_completion:${mockBusinessId}`]: { business_id: mockBusinessId }
			};

			(redis.getHashByPattern as jest.Mock).mockResolvedValue(redisKeys);
			mockTrackerInstance.getCompletionState.mockResolvedValue(mockState);
			mockTrackerInstance.checkAndMarkTimeouts.mockResolvedValue(true);

			await processCallback({});

			// Category event should not be sent (already completed)
			// But all complete event should still be sent
			expect(mockTrackerInstance.sendCompleteEvent).toHaveBeenCalledWith("all", "timeout_monitor");
			expect(mockTrackerInstance.cleanupTracking).toHaveBeenCalled();
		});

		it("should handle errors in checkBusinessForTimeouts", async () => {
			const redisKeys = {
				[`{integration_completion}:all_integrations_completion:${mockBusinessId}`]: { business_id: mockBusinessId }
			};

			(redis.getHashByPattern as jest.Mock).mockResolvedValue(redisKeys);
			const error = new Error("Check error");
			(IntegrationsCompletionTracker.forBusiness as jest.Mock).mockRejectedValue(error);

			await processCallback({});

			expect(logger.error).toHaveBeenCalledWith({
				businessID: mockBusinessId,
				error,
				message: "Failed to check business for timeouts"
			});
		});
	});

	describe("emitTimeoutCompletionEvent (via process callback)", () => {
		let processCallback: Function;

		beforeEach(async () => {
			await TimeoutMonitorService.initialize();
			processCallback = mockQueue.process.mock.calls[0][2];
		});

		it("should emit event with timeout metadata", async () => {
			const mockState: CompletionState = {
				business_id: mockBusinessId,
				customer_id: null,
				case_id: null,
				score_trigger_id: null,
				required_tasks: [],
				required_tasks_by_category: {},
				completed_categories: [],
				completed_tasks: [],
				timed_out_tasks: ["verdata:fetch_public_records"],
				tasks_required: 1,
				tasks_completed: 0,
				tasks_timed_out: 1,
				is_all_complete: true,
				updated_at: new Date().toISOString(),
				timeout_threshold_seconds: 480,
				tasks_ignored: 0,
				initialized_at: new Date().toISOString(),
				started_at: new Date().toISOString()
			};

			const redisKeys = {
				[`{integration_completion}:all_integrations_completion:${mockBusinessId}`]: { business_id: mockBusinessId }
			};

			(redis.getHashByPattern as jest.Mock).mockResolvedValue(redisKeys);
			mockTrackerInstance.getCompletionState.mockResolvedValue(mockState);
			mockTrackerInstance.checkAndMarkTimeouts.mockResolvedValue(true);

			await processCallback({});

			expect(mockTrackerInstance.sendCompleteEvent).toHaveBeenCalledWith("all", "timeout_monitor");

			expect(logger.info).toHaveBeenCalledWith({
				businessID: mockBusinessId,
				timedOutIntegrations: ["verdata:fetch_public_records"],
				timeoutThresholdSeconds: 480,
				message: "Emitted ALL_INTEGRATIONS_COMPLETE event due to timeouts"
			});
		});

		it("should handle missing completion state gracefully", async () => {
			const mockState: CompletionState = {
				business_id: mockBusinessId,
				customer_id: null,
				case_id: null,
				score_trigger_id: null,
				required_tasks: [],
				required_tasks_by_category: {},
				completed_categories: [],
				completed_tasks: [],
				timed_out_tasks: [],
				tasks_required: 1,
				tasks_completed: 0,
				tasks_timed_out: 0,
				tasks_ignored: 0,
				is_all_complete: true,
				updated_at: new Date().toISOString(),
				timeout_threshold_seconds: 480,
				initialized_at: new Date().toISOString(),
				started_at: new Date().toISOString()
			};

			const redisKeys = {
				[`{integration_completion}:all_integrations_completion:${mockBusinessId}`]: { business_id: mockBusinessId }
			};

			// Create separate mock instances for different calls
			const firstInstance = { ...mockTrackerInstance };
			const secondInstance = { ...mockTrackerInstance };

			firstInstance.getCompletionState = jest.fn().mockResolvedValue(mockState);
			firstInstance.checkAndMarkTimeouts = jest.fn().mockResolvedValue(true);
			secondInstance.getCompletionState = jest.fn().mockRejectedValue(new Error("No completion state found"));

			(IntegrationsCompletionTracker.forBusiness as jest.Mock)
				.mockResolvedValueOnce(firstInstance) // First call for checkBusinessForTimeouts
				.mockResolvedValueOnce(secondInstance); // Second call for emitTimeoutCompletionEvent

			(redis.getHashByPattern as jest.Mock).mockResolvedValue(redisKeys);

			await processCallback({});

			expect(logger.error).toHaveBeenCalledWith({
				businessID: mockBusinessId,
				error: "No completion state found",
				message: "Failed to emit timeout completion event"
			});
		});

		it("should handle sendCompleteEvent errors gracefully", async () => {
			const mockState: CompletionState = {
				business_id: mockBusinessId,
				customer_id: null,
				case_id: null,
				score_trigger_id: null,
				required_tasks: [],
				required_tasks_by_category: {},
				completed_categories: [],
				completed_tasks: [],
				timed_out_tasks: ["verdata:fetch_public_records"],
				tasks_required: 1,
				tasks_completed: 0,
				tasks_timed_out: 1,
				tasks_ignored: 0,
				is_all_complete: true,
				updated_at: new Date().toISOString(),
				started_at: new Date().toISOString(),
				initialized_at: new Date().toISOString(),
				timeout_threshold_seconds: 480
			};

			const redisKeys = {
				[`{integration_completion}:all_integrations_completion:${mockBusinessId}`]: { business_id: mockBusinessId }
			};

			(redis.getHashByPattern as jest.Mock).mockResolvedValue(redisKeys);
			mockTrackerInstance.getCompletionState.mockResolvedValue(mockState);
			mockTrackerInstance.checkAndMarkTimeouts.mockResolvedValue(true);

			const error = new Error("Kafka error");
			mockTrackerInstance.sendCompleteEvent.mockRejectedValue(error);

			await processCallback({});

			expect(logger.error).toHaveBeenCalledWith({
				businessID: mockBusinessId,
				error: "Kafka error",
				message: "Failed to emit timeout completion event"
			});
		});
	});

	describe("extractBusinessIDFromKey", () => {
		it("should extract business ID from valid key", () => {
			const key = `{integration_completion}:all_integrations_completion:${mockBusinessId}`;
			const extracted = (TimeoutMonitorService as any).extractBusinessIDFromKey(key);

			expect(extracted).toBe(mockBusinessId);
		});

		it("should return null for invalid key", () => {
			const key = "invalid:key:format";
			const extracted = (TimeoutMonitorService as any).extractBusinessIDFromKey(key);

			expect(extracted).toBeNull();
		});

		it("should handle empty key", () => {
			const extracted = (TimeoutMonitorService as any).extractBusinessIDFromKey("");

			expect(extracted).toBeNull();
		});
	});

	describe("getAllActiveCompletionKeys", () => {
		it("should return keys from Redis pattern scan", async () => {
			const redisKeys = {
				[`{integration_completion}:all_integrations_completion:${mockBusinessId}`]: { business_id: mockBusinessId },
				[`{integration_completion}:all_integrations_completion:${mockBusinessId2}`]: { business_id: mockBusinessId2 }
			};

			(redis.getHashByPattern as jest.Mock).mockResolvedValue(redisKeys);

			const keys = await (TimeoutMonitorService as any).getAllActiveCompletionKeys();

			expect(keys).toHaveLength(2);
			expect(keys).toContain(`{integration_completion}:all_integrations_completion:${mockBusinessId}`);
			expect(keys).toContain(`{integration_completion}:all_integrations_completion:${mockBusinessId2}`);
		});

		it("should return empty array when no keys found", async () => {
			(redis.getHashByPattern as jest.Mock).mockResolvedValue({});

			const keys = await (TimeoutMonitorService as any).getAllActiveCompletionKeys();

			expect(keys).toEqual([]);
		});

		it("should filter out null/undefined values", async () => {
			const redisKeys = {
				[`{integration_completion}:all_integrations_completion:${mockBusinessId}`]: { business_id: mockBusinessId },
				[`{integration_completion}:all_integrations_completion:${mockBusinessId2}`]: null
			};

			(redis.getHashByPattern as jest.Mock).mockResolvedValue(redisKeys);

			const keys = await (TimeoutMonitorService as any).getAllActiveCompletionKeys();

			expect(keys).toHaveLength(1);
			expect(keys).toContain(`{integration_completion}:all_integrations_completion:${mockBusinessId}`);
		});

		it("should handle Redis errors gracefully", async () => {
			const error = new Error("Redis scan error");
			(redis.getHashByPattern as jest.Mock).mockRejectedValue(error);

			const keys = await (TimeoutMonitorService as any).getAllActiveCompletionKeys();

			expect(keys).toEqual([]);
			expect(logger.error).toHaveBeenCalled();
		});
	});
});
