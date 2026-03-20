import { TASK_STATUS, ERROR_CODES, CONNECTION_STATUS } from "#constants";
import { StatusCodes } from "http-status-codes";
import { DeferrableTaskError, DeferrableTaskManager } from "../deferrableTaskManager";
import { Tracker } from "knex-mock-client";
import { createTracker } from "knex-mock-client";
import { db } from "#helpers/knex";
import { TaskEvent } from "#models/taskEvent";
import type { DependentTask } from "../types";
import type { EnqueuedJob } from "#lib/aiEnrichment/types";
import type { FactEngine } from "#lib/facts/factEngine";
import type { IBusinessIntegrationTask, IBusinessIntegrationTaskEnriched, IDBConnection } from "#types/db";
import type { Job } from "bull";
import type { UUID } from "crypto";
import type BullQueue from "#helpers/bull-queue";
import type { QueueEnum, EventEnum, TaskCode, IntegrationPlatformId } from "#constants";

// Set to true to have logger calls output to stdout via `console` commands
const DEBUG = false;

// Mock dependencies
jest.mock("#helpers/logger", () => ({
	logger: {
		debug: (...args: any[]) => DEBUG && console.debug(...args),
		error: (...args: any[]) => DEBUG && console.error(...args),
		info: (...args: any[]) => DEBUG && console.info(...args)
	}
}));

jest.mock("#models/taskEvent", () => ({
	TaskEvent: {
		getEventsForTask: jest.fn()
	}
}));

jest.mock("#helpers/knex", () => {
	const knex = require("knex");
	const { MockClient } = require("knex-mock-client");
	return {
		db: knex({ client: MockClient, dialect: "pg" })
	};
});

class TestDeferrableTaskManager extends DeferrableTaskManager {
	static readonly QUEUE_NAME: QueueEnum = "TEST_QUEUE" as QueueEnum;
	static readonly QUEUE_EVENT: EventEnum = "TEST_EVENT" as EventEnum;

	protected async executeDeferrableTask<T = any>(task: IBusinessIntegrationTask<T>, job: Job<EnqueuedJob>): Promise<boolean> {
		return true; // Always succeed for testing
	}

	// Override the sendTaskCompleteMessage method to return the task in the test
	public async sendTaskCompleteMessage<T = any>(task: IBusinessIntegrationTaskEnriched<T> | UUID): Promise<IBusinessIntegrationTaskEnriched<T>> {
		return task as IBusinessIntegrationTaskEnriched<T>;
	}
	// Redefine as public for testing
	public async updateTask<T = any>(task: IBusinessIntegrationTaskEnriched<T> | UUID, event: any): Promise<IBusinessIntegrationTaskEnriched<T>> {
		return task as IBusinessIntegrationTaskEnriched<T>;
	}
	public async updateTaskStatus<T = any>(task: IBusinessIntegrationTaskEnriched<T> | UUID, event: any): Promise<IBusinessIntegrationTaskEnriched<T>> {
		return task as IBusinessIntegrationTaskEnriched<T>;
	}

	/* override access from protected to public for all these */
	public async deferJob(job: Job<EnqueuedJob>, msg?: string): Promise<void> {
		await super.deferJob(job, msg ?? "Defer");
	}
	public async completeJob(job: Job<EnqueuedJob>, msg?: string): Promise<void> {
		await super.completeJob(job, msg ?? "Test");
	}
	public async discardJob(job: Job<EnqueuedJob>, msg?: string): Promise<void> {
		await super.discardJob(job, msg ?? "Discard");
	}
}
// Create concrete implementation for testing

describe("DeferrableTaskManager", () => {
	let tracker: Tracker;

	let manager: TestDeferrableTaskManager;
	let mockDbConnection: IDBConnection;
	let mockBullQueue: BullQueue;
	let mockFactEngine: FactEngine;
	let mockJob: Job<EnqueuedJob>;
	let mockTask: IBusinessIntegrationTaskEnriched;

	const taskID: UUID = "0000-0000-0000-0000-000000000009";
	const eventID: UUID = "0000-0000-0000-0000-000000000001";
	const businessID: UUID = "0000-0000-0000-0000-000000000002";
	const connectionID: UUID = "0000-0000-0000-0000-000000000003";
	const jobID: UUID = "0000-0000-0000-0000-000000000003";
	const platformID: IntegrationPlatformId = 999 as IntegrationPlatformId;

	beforeEach(() => {
		// Setup mocks

		tracker = createTracker(db);

		mockDbConnection = {
			id: "123" as UUID,
			business_id: businessID,
			platform_id: platformID as IntegrationPlatformId,
			connection_type: "test",
			created_at: new Date(Date.now() - 5000).toISOString(),
			updated_at: new Date(Date.now() - 5000).toISOString(),
			configuration: {},
			connection_status: CONNECTION_STATUS.SUCCESS
		} as IDBConnection;

		mockBullQueue = {
			addJob: jest.fn().mockResolvedValue({ id: jobID }),
			queue: { name: "test-queue" },
			getDelay: jest.fn().mockReturnValue(500),
			isSandboxedJob: jest.fn().mockImplementation(job => !Object(job).hasOwnProperty("moveToCompleted"))
		} as unknown as BullQueue;

		mockFactEngine = {
			applyRules: jest.fn().mockResolvedValue({}),
			getAllResolvedFacts: jest.fn().mockReturnValue({}),
			isValidFactValue: jest.fn().mockReturnValue(true),
			getNumberOfSourcesForFact: jest.fn().mockReturnValue(1)
		} as unknown as FactEngine;

		mockJob = {
			id: taskID,
			data: { task_id: taskID, platform_id: platformID, business_id: businessID },
			attemptsMade: 1,
			opts: { attempts: 3 },
			log: jest.fn().mockImplementation(() => {}),
			progress: jest.fn().mockImplementation(n => {
				if (!n) {
					return 0;
				}
				return Promise.resolve(n);
			}),
			moveToCompleted: jest.fn().mockResolvedValue({}),
			moveToFailed: jest.fn().mockResolvedValue({})
		} as unknown as Job<EnqueuedJob>;

		// Create test instance
		manager = new TestDeferrableTaskManager({
			dbConnection: mockDbConnection,
			db,
			bullQueue: mockBullQueue,
			factEngine: mockFactEngine
		});

		manager.getMostRecentTasksByPlatformIdAndTaskCodeTuples = jest.fn().mockResolvedValue([]);
		manager.updateTask = jest.fn().mockResolvedValue(mockTask);
		manager.sendTaskCompleteMessage = jest.fn().mockResolvedValue(mockTask);
		manager.updateTaskStatus = jest.fn().mockImplementation((taskId, event, sendCompleteMessage) => {
			if (sendCompleteMessage) {
				manager.sendTaskCompleteMessage(mockTask);
			}
			return { ...mockTask, ...event, sendCompleteMessage };
		});
		// spy on defer, complete, and discard
		const originalCompleteJob = manager.completeJob;
		manager.completeJob = jest.fn((...args) => {
			return originalCompleteJob.apply(manager, args);
		});
		const originalDiscardJob = manager.discardJob;
		manager.discardJob = jest.fn((...args) => {
			return originalDiscardJob.apply(manager, args);
		});
		const originalDeferJob = manager.deferJob;
		manager.deferJob = jest.fn((...args) => {
			return originalDeferJob.apply(manager, args);
		});

		mockTask = {
			id: taskID,
			business_id: businessID,
			platform_id: platformID,
			task_status: TASK_STATUS.CREATED,
			task_code: "TEST_CODE" as TaskCode,
			connection_id: connectionID,
			// mock it being created 5 seconds ago
			created_at: new Date(Date.now() - 5000).toISOString(),
			metadata: {},
			platform_code: "abc",
			platform_category_code: "MANUAL",
			task_label: "task",
			integration_task_id: 12
		} as IBusinessIntegrationTaskEnriched;

		// Mock static methods
		TestDeferrableTaskManager.getEnrichedTask = jest.fn().mockResolvedValue(mockTask);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe("constructor", () => {
		it("should throw error if QUEUE_NAME is not set", () => {
			class InvalidTaskManager extends DeferrableTaskManager {
				static readonly QUEUE_NAME = undefined as unknown as QueueEnum;
				static readonly QUEUE_EVENT: EventEnum = "TEST_EVENT" as EventEnum;

				protected async executeDeferrableTask(): Promise<boolean> {
					return true;
				}
			}

			expect(
				() =>
					new InvalidTaskManager({
						dbConnection: mockDbConnection,
						db: db,
						bullQueue: mockBullQueue
					})
			).toThrow("Queue name is not set");
		});

		it("should throw error if QUEUE_EVENT is not set", () => {
			class InvalidTaskManager extends DeferrableTaskManager {
				static readonly QUEUE_NAME: QueueEnum = "TEST_QUEUE" as QueueEnum;
				static readonly QUEUE_EVENT = undefined as unknown as EventEnum;

				protected async executeDeferrableTask(): Promise<boolean> {
					return true;
				}
			}

			expect(
				() =>
					new InvalidTaskManager({
						dbConnection: mockDbConnection,
						db: db,
						bullQueue: mockBullQueue
					})
			).toThrow("Queue event is not set");
		});
	});

	describe("processTask", () => {
		it("should throw error if task is not found", async () => {
			TestDeferrableTaskManager.getEnrichedTask = jest.fn().mockResolvedValue(null);

			await expect(manager.processTask({ taskId: "123" as UUID })).rejects.toThrow(new DeferrableTaskError("Could not fetch task 123", null, StatusCodes.NOT_FOUND, ERROR_CODES.INVALID));
		});

		it("should throw error if task is not in pending state", async () => {
			const completedTask = { ...mockTask, task_status: TASK_STATUS.SUCCESS };
			TestDeferrableTaskManager.getEnrichedTask = jest.fn().mockResolvedValue(completedTask);

			await expect(manager.processTask({ taskId: "123" as UUID })).rejects.toThrow(
				new DeferrableTaskError("Task is not in a pending state", completedTask, StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID)
			);
		});

		it("should enqueue the task and return updated task", async () => {
			const result = await manager.processTask({ taskId: taskID });
			expect(TestDeferrableTaskManager.getEnrichedTask).toHaveBeenCalledWith(taskID);
			expect(mockBullQueue.addJob).toHaveBeenCalledWith("TEST_EVENT", { task_id: taskID, platform_id: platformID, business_id: businessID }, expect.any(Object));
			expect(result).toEqual(mockTask);
		});
	});

	describe("evaluateJob", () => {
		it("should handle DEFER when the task is dependent on another task finishing sucessfully and it hasn't finished", async () => {
			// Setup a requirement that the task is dependent upon another task finishing sucessfully
			manager.getDependentFacts = jest.fn().mockReturnValue({});
			manager.getDependentTasks = jest.fn().mockReturnValue({
				TEST_CODE: [
					{
						platformId: null
					}
				]
			});
			// Mock that the dependent task has not finished
			manager.getMostRecentTasksByPlatformIdAndTaskCodeTuples = jest.fn().mockResolvedValue([]);
			await manager.evaluateJob(mockJob);
			// Should tell the job to retry (fail) as the dependent task has not finished
			expect(manager.deferJob).toHaveBeenCalled();
			expect(mockJob.attemptsMade).toBe(1);
		});
		it("should be DEFER when the task is dependent on a resolved fact", async () => {
			// Setup a requirement that the task is dependent upon another task finishing sucessfully
			mockFactEngine.getNumberOfSourcesForFact = jest.fn().mockReturnValue(1);
			mockFactEngine.getAllResolvedFacts = jest.fn().mockReturnValue({ testFact: { name: "testFact", value: "abc" } });
			manager.getDependentFacts = jest.fn().mockReturnValue({
				testFact: {
					minimumSources: 2
				}
			}); // Mock that the dependent task has not finished
			await manager.evaluateJob(mockJob);
			// Should tell the job to retry (fail) as the dependent task has not finished
			expect(manager.deferJob).toHaveBeenCalled();
			expect(mockJob.attemptsMade).toBe(1);
		});
		it("should be READY when the task is dependent on a fact and it has been resolved", async () => {
			// Setup a requirement that the task is dependent upon another task finishing sucessfully
			mockFactEngine.getNumberOfSourcesForFact = jest.fn().mockReturnValue(3);
			mockFactEngine.getAllResolvedFacts = jest.fn().mockReturnValue({ testFact: { name: "testFact", value: "abc" } });
			manager.getDependentFacts = jest.fn().mockReturnValue({
				testFact: {
					minimumSources: 2
				}
			}); // Mock that the dependent task has not finished
			await manager.evaluateJob(mockJob);
			expect(mockFactEngine.getAllResolvedFacts).toHaveBeenCalled();
			// Should tell the job to retry (fail) as the dependent task has not finished
			expect(manager.completeJob).toHaveBeenCalled();
			expect(mockJob.attemptsMade).toBe(1);
			expect(manager.updateTaskStatus).toHaveBeenCalledWith(taskID, TASK_STATUS.STARTED, expect.objectContaining({ message: expect.stringContaining("Criteria met") }));
			expect(manager.updateTaskStatus).toHaveBeenCalledWith(taskID, TASK_STATUS.SUCCESS, expect.objectContaining({ message: expect.stringContaining("Completing") }), true);
			expect(manager.sendTaskCompleteMessage).toHaveBeenCalledWith(mockTask);
		});
		it("should be READY when timeout has exceeded despite other conditions not being met", async () => {
			// Setup a requirement that the task is dependent upon another task finishing sucessfully
			mockTask.created_at = new Date(Date.now() - 100000).toISOString() as unknown as Date;
			mockFactEngine.getNumberOfSourcesForFact = jest.fn().mockReturnValue(1);
			mockFactEngine.getAllResolvedFacts = jest.fn().mockReturnValue({ testFact: { name: "testFact", value: "abc" } });
			manager.getDependentFacts = jest.fn().mockReturnValue({
				testFact: {
					minimumSources: 10
				}
			}); // Mock that the dependent task has not finished
			await manager.evaluateJob(mockJob);
			expect(mockFactEngine.getAllResolvedFacts).toHaveBeenCalled();
			// Should tell the job to retry (fail) as the dependent task has not finished
			expect(manager.completeJob).toHaveBeenCalled();
			expect(mockJob.attemptsMade).toBe(1);
			expect(manager.updateTaskStatus).toHaveBeenCalledWith(taskID, TASK_STATUS.STARTED, expect.objectContaining({ message: expect.stringContaining("Criteria met") }));
			expect(manager.updateTaskStatus).toHaveBeenCalledWith(taskID, TASK_STATUS.SUCCESS, expect.objectContaining({ message: expect.stringContaining("Completing") }), true);
			expect(manager.sendTaskCompleteMessage).toHaveBeenCalledWith(mockTask);
		});
		it("should be SUCCESS when the task is dependent on a fact with a maximum number of sources", async () => {
			// Setup a requirement that the task is dependent upon another task finishing sucessfully
			mockFactEngine.getNumberOfSourcesForFact = jest.fn().mockReturnValue(3);

			mockFactEngine.getAllResolvedFacts = jest.fn().mockReturnValue({ testFact: { name: "testFact", value: "abc" } });
			manager.getDependentFacts = jest.fn().mockReturnValue({
				testFact: {
					maximumSources: 2
				}
			}); // Mock that the dependent fact has a maximum number of 2 sources but we have 3
			await manager.evaluateJob(mockJob);
			expect(mockFactEngine.getAllResolvedFacts).toHaveBeenCalled();
			// Should tell the job to retry (fail) as the dependent task has not finished
			expect(manager.completeJob).toHaveBeenCalled();
			expect(mockJob.attemptsMade).toBe(1);
			expect(manager.updateTaskStatus).not.toHaveBeenCalledWith(taskID, TASK_STATUS.STARTED);
			expect(manager.updateTaskStatus).toHaveBeenCalledWith(taskID, TASK_STATUS.SUCCESS, expect.objectContaining({ message: expect.stringContaining("Skipping execution") }), true);
			expect(manager.sendTaskCompleteMessage).toHaveBeenCalledWith(mockTask);
		});
		it("should be READY when a task is dependent on another task finishing and it has finished for any platform", async () => {
			TestDeferrableTaskManager.getEnrichedTask = jest.fn().mockResolvedValue({ ...mockTask, task_code: "fetch_assets_data" });
			TaskEvent.getEventsForTask = jest
				.fn()
				.mockResolvedValue([{ getRecord: jest.fn().mockReturnValue({ task_status: TASK_STATUS.SUCCESS, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }) }]);

			// Setup a requirement that the task is dependent upon another task finishing sucessfully
			manager.getDependentFacts = jest.fn().mockReturnValue({});
			const dependentTask: Partial<DependentTask> = {
				fetch_assets_data: [
					{
						platformId: null,
						lastRunAtInSeconds: 100
					}
				]
			};
			manager.getDependentTasks = jest.fn().mockReturnValue(dependentTask);
			// Mock that the dependent task has finished
			manager.getMostRecentTasksByPlatformIdAndTaskCodeTuples = jest.fn().mockResolvedValueOnce([
				{
					task_code: "fetch_assets_data",
					platform_id: platformID,
					integration_task_id: mockTask.integration_task_id,
					id: taskID,
					task_status: TASK_STATUS.SUCCESS,
					created_at: new Date().toISOString()
				}
			]);
			await manager.evaluateJob(mockJob);
			expect(manager.completeJob).toHaveBeenCalled();
			expect(manager.updateTaskStatus).toHaveBeenCalledWith(taskID, TASK_STATUS.STARTED, expect.objectContaining({ message: expect.stringContaining("Criteria met") }));
			expect(manager.updateTaskStatus).toHaveBeenCalledWith(taskID, TASK_STATUS.SUCCESS, expect.anything(), true);
			expect(manager.sendTaskCompleteMessage).toHaveBeenCalledWith(mockTask);
		});
		it("should be READY when a task is dependent on another task finishing and it has finished for a specific platform", async () => {
			TestDeferrableTaskManager.getEnrichedTask = jest.fn().mockResolvedValue({ ...mockTask, task_code: "fetch_assets_data" });
			TaskEvent.getEventsForTask = jest
				.fn()
				.mockResolvedValue([{ getRecord: jest.fn().mockReturnValue({ task_status: TASK_STATUS.SUCCESS, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }) }]);

			// Setup a requirement that the task is dependent upon another task finishing sucessfully
			manager.getDependentFacts = jest.fn().mockReturnValue({});
			const dependentTask: Partial<DependentTask> = {
				fetch_assets_data: [
					{
						platformId: platformID,
						lastRunAtInSeconds: 100
					}
				]
			};
			manager.getDependentTasks = jest.fn().mockReturnValue(dependentTask);
			// Mock that the dependent task has finished
			manager.getMostRecentTasksByPlatformIdAndTaskCodeTuples = jest.fn().mockResolvedValueOnce([
				{
					task_code: "fetch_assets_data",
					platform_id: platformID,
					integration_task_id: mockTask.integration_task_id,
					id: taskID,
					task_status: TASK_STATUS.SUCCESS,
					created_at: new Date().toISOString()
				}
			]);
			await manager.evaluateJob(mockJob);
			expect(manager.completeJob).toHaveBeenCalled();
			expect(manager.updateTaskStatus).toHaveBeenCalledWith(taskID, TASK_STATUS.STARTED, expect.objectContaining({ message: expect.stringContaining("Criteria met") }));
			expect(manager.updateTaskStatus).toHaveBeenCalledWith(taskID, TASK_STATUS.SUCCESS, expect.anything(), true);

			expect(manager.sendTaskCompleteMessage).toHaveBeenCalledWith(mockTask);
		});
		it("should be READY when a task is dependent on another task finishing and it has timed out", async () => {
			TestDeferrableTaskManager.getEnrichedTask = jest.fn().mockResolvedValue({ ...mockTask, task_code: "fetch_assets_data" });
			TaskEvent.getEventsForTask = jest
				.fn()
				.mockResolvedValue([{ getRecord: jest.fn().mockReturnValue({ task_status: TASK_STATUS.SUCCESS, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }) }]);

			// Setup a requirement that the task is dependent upon another task finishing sucessfully but has a timeout of 500 seconds
			manager.getDependentFacts = jest.fn().mockReturnValue({});
			const dependentTask: Partial<DependentTask> = {
				fetch_assets_data: [
					{
						platformId: platformID,
						timeoutInSeconds: 500
					}
				]
			};
			manager.getDependentTasks = jest.fn().mockReturnValue(dependentTask);
			// Mock that the dependent task is still pending and was created 501 seconds ago
			manager.getMostRecentTasksByPlatformIdAndTaskCodeTuples = jest.fn().mockImplementation((tuples, statuses) => {
				if (statuses.includes(TASK_STATUS.CREATED)) {
					const forceTimeout = 501 * 1000;
					return [
						{
							task_code: "fetch_assets_data",
							platform_id: platformID,
							integration_task_id: mockTask.integration_task_id,
							id: taskID,
							task_status: TASK_STATUS.CREATED,
							created_at: new Date(Date.now() - forceTimeout).toISOString(),
							updated_at: new Date(Date.now() - forceTimeout).toISOString()
						}
					];
				}
				return [];
			});
			await manager.evaluateJob(mockJob);
			expect(manager.completeJob).toHaveBeenCalled();
			expect(manager.updateTaskStatus).toHaveBeenCalledWith(taskID, TASK_STATUS.STARTED, expect.objectContaining({ message: expect.stringContaining("Criteria met") }));
			expect(manager.updateTaskStatus).toHaveBeenCalledWith(taskID, TASK_STATUS.SUCCESS, expect.anything(), true);
			expect(manager.sendTaskCompleteMessage).toHaveBeenCalledWith(mockTask);
		});
		it("should be DEFER when a task is dependent on another task finishing and has not timed out or finished", async () => {
			TestDeferrableTaskManager.getEnrichedTask = jest.fn().mockResolvedValue({ ...mockTask, task_code: "fetch_assets_data" });
			TaskEvent.getEventsForTask = jest
				.fn()
				.mockResolvedValue([{ getRecord: jest.fn().mockReturnValue({ task_status: TASK_STATUS.SUCCESS, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }) }]);

			// Setup a requirement that the task is dependent upon another task finishing sucessfully but has a timeout of 500 seconds
			manager.getDependentFacts = jest.fn().mockReturnValue({});
			const dependentTask: Partial<DependentTask> = {
				fetch_assets_data: [
					{
						platformId: platformID,
						timeoutInSeconds: 500,
						lastRunAtInSeconds: 100
					}
				]
			};
			manager.getDependentTasks = jest.fn().mockReturnValue(dependentTask);
			// Mock that the dependent task is still pending and was 50 seconds ago
			manager.getMostRecentTasksByPlatformIdAndTaskCodeTuples = jest.fn().mockImplementation((tuples, statuses) => {
				if (statuses.includes(TASK_STATUS.CREATED)) {
					const forceNoTimeout = 50 * 1000;
					return [
						{
							task_code: "fetch_assets_data",
							platform_id: platformID,
							integration_task_id: mockTask.integration_task_id,
							id: taskID,
							task_status: TASK_STATUS.CREATED,
							created_at: new Date(Date.now() - forceNoTimeout).toISOString(),
							updated_at: new Date(Date.now() - forceNoTimeout).toISOString()
						}
					];
				}
				return [];
			});
			await manager.evaluateJob(mockJob);
			expect(manager.deferJob).toHaveBeenCalled();
			expect(manager.updateTaskStatus).toHaveBeenCalledWith(taskID, TASK_STATUS.IN_PROGRESS, expect.anything());
		});
	});

	describe("enqueueTask", () => {
		it("should add job to queue and update task status", async () => {
			await manager.processTask({ taskId: taskID });

			expect(mockBullQueue.addJob).toHaveBeenCalledWith(
				"TEST_EVENT",
				{
					task_id: taskID,
					platform_id: platformID,
					business_id: businessID
				},
				expect.objectContaining({
					jobId: taskID,
					backoff: {
						delay: expect.any(Number),
						type: "exponential"
					},
					delay: expect.any(Number),
					attempts: 10
				})
			);

			expect(manager.updateTaskStatus).toHaveBeenCalledWith(
				taskID,
				TASK_STATUS.INITIALIZED,
				expect.objectContaining({
					job_id: jobID,
					message: expect.stringContaining("Enqueued for processing")
				})
			);
		});
	});

	describe("getFacts", () => {
		it("should return fact objects when factEngine has resolved facts", async () => {
			const mockBusinessNameFact = { name: "business_name", value: "Test Company", confidence: 0.9 };
			const mockBusinessIdFact = { name: "business_id", value: "12345", confidence: 1.0 };
			mockFactEngine.getAllResolvedFacts = jest.fn().mockReturnValue({
				business_name: mockBusinessNameFact,
				business_id: mockBusinessIdFact
			});
			mockFactEngine.isValidFactValue = jest.fn().mockReturnValue(true);
			manager.getDependentFacts = jest.fn().mockReturnValue({ business_name: {}, business_id: {} });

			const result = await manager["getFacts"]();

			expect(result).toEqual({
				business_name: mockBusinessNameFact,
				business_id: mockBusinessIdFact
			});
		});

		it("should filter out facts with invalid values", async () => {
			const mockBusinessNameFact = { name: "business_name", value: "Test Company", confidence: 0.9 };
			const mockBusinessIdFact = { name: "business_id", value: null, confidence: 0 };
			mockFactEngine.getAllResolvedFacts = jest.fn().mockReturnValue({
				business_name: mockBusinessNameFact,
				business_id: mockBusinessIdFact
			});
			mockFactEngine.isValidFactValue = jest
				.fn()
				.mockImplementation((value: any) => value !== null && value !== undefined);
			manager.getDependentFacts = jest.fn().mockReturnValue({ business_name: {}, business_id: {} });

			const result = await manager["getFacts"]();

			expect(result).toEqual({ business_name: mockBusinessNameFact });
		});

		it("should use provided factNames parameter", async () => {
			const mockBusinessNameFact = { name: "business_name", value: "Test Company", confidence: 0.9 };
			const mockBusinessIdFact = { name: "business_id", value: "12345", confidence: 1.0 };
			const mockCityFact = { name: "city", value: "San Francisco", confidence: 0.8 };
			mockFactEngine.getAllResolvedFacts = jest.fn().mockReturnValue({
				business_name: mockBusinessNameFact,
				business_id: mockBusinessIdFact,
				city: mockCityFact
			});
			mockFactEngine.isValidFactValue = jest.fn().mockReturnValue(true);

			const result = await manager["getFacts"](["business_name", "city"]);

			expect(result).toEqual({
				business_name: mockBusinessNameFact,
				city: mockCityFact
			});
		});

		it("should throw error when factEngine is not initialized", async () => {
			const managerWithoutFactEngine = new TestDeferrableTaskManager({
				dbConnection: mockDbConnection,
				db,
				bullQueue: mockBullQueue
			});

			await expect(managerWithoutFactEngine["getFacts"]()).rejects.toThrow("FactEngine is not initialized");
		});
	});

	describe("getFactValues", () => {
		it("should return fact values when factEngine has resolved facts", async () => {
			mockFactEngine.getAllResolvedFacts = jest.fn().mockReturnValue({
				business_name: { name: "business_name", value: "Test Company" },
				business_id: { name: "business_id", value: "12345" }
			});
			mockFactEngine.isValidFactValue = jest.fn().mockReturnValue(true);
			manager.getDependentFacts = jest.fn().mockReturnValue({ business_name: {}, business_id: {} });

			const result = await manager["getFactValues"]();

			expect(result).toEqual({ business_name: "Test Company", business_id: "12345" });
		});

		it("should filter out facts with invalid values", async () => {
			mockFactEngine.getAllResolvedFacts = jest.fn().mockReturnValue({
				business_name: { name: "business_name", value: "Test Company" },
				business_id: { name: "business_id", value: undefined }
			});
			mockFactEngine.isValidFactValue = jest
				.fn()
				.mockImplementation((value: any) => value !== undefined);
			manager.getDependentFacts = jest.fn().mockReturnValue({ business_name: {}, business_id: {} });

			const result = await manager["getFactValues"]();

			expect(result).toEqual({ business_name: "Test Company" });
		});

		it("should use provided factNames parameter", async () => {
			mockFactEngine.getAllResolvedFacts = jest.fn().mockReturnValue({
				business_name: { name: "business_name", value: "Test Company" },
				business_id: { name: "business_id", value: "12345" },
				city: { name: "city", value: "San Francisco" }
			});
			mockFactEngine.isValidFactValue = jest.fn().mockReturnValue(true);

			const result = await manager["getFactValues"](["business_name", "city"]);

			expect(result).toEqual({ business_name: "Test Company", city: "San Francisco" });
		});

		it("should throw error when factEngine is not initialized", async () => {
			const managerWithoutFactEngine = new TestDeferrableTaskManager({
				dbConnection: mockDbConnection,
				db,
				bullQueue: mockBullQueue
			});

			await expect(managerWithoutFactEngine["getFactValues"]()).rejects.toThrow("FactEngine is not initialized");
		});
	});
});

describe("DeferrableTaskError", () => {
	it("should construct error properly", () => {
		const error = new DeferrableTaskError("Test error", { foo: "bar" }, StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);

		expect(error.message).toBe("Test error");
		expect(error.name).toBe("DeferrableTaskError");
		expect(error.data).toEqual({ foo: "bar" });
		expect(error.status).toBe(StatusCodes.BAD_REQUEST);
		expect(error.errorCode).toBe(ERROR_CODES.INVALID);
	});

	it("should use default status code if not provided", () => {
		const error = new DeferrableTaskError("Test error");

		expect(error.status).toBe(StatusCodes.BAD_REQUEST);
	});
});
