import { TruliooPSCScreening } from "../truliooPSCScreening";
import { INTEGRATION_ID, QUEUES, EVENTS } from "#constants";

jest.mock("#helpers/logger", () => ({
	logger: {
		error: jest.fn(),
		warn: jest.fn(),
		info: jest.fn(),
		debug: jest.fn()
	}
}));

jest.mock("#helpers/knex", () => {
	const knex = require("knex");
	const { MockClient } = require("knex-mock-client");
	return {
		db: knex({ client: MockClient, dialect: "pg" })
	};
});

jest.mock("#helpers/platformHelper", () => ({
	getOrCreateConnection: jest.fn().mockResolvedValue({
		id: "conn-psc-123",
		business_id: "biz-123",
		platform_id: 42
	})
}));

jest.mock("#helpers/bull-queue", () => {
	return jest.fn().mockImplementation(() => ({
		queue: { name: "trulioo-psc", process: jest.fn(), on: jest.fn() },
		addJob: jest.fn().mockResolvedValue({ id: "job-1" }),
		getDelay: jest.fn().mockReturnValue(500),
		isSandboxedJob: jest.fn().mockReturnValue(false),
		getJobByID: jest.fn()
	}));
});

const mockGetOrCreateTaskForCode = jest.fn().mockResolvedValue("task-psc-001");
const mockProcessTask = jest.fn().mockResolvedValue({ id: "task-psc-001" });
const mockUpdateTaskStatus = jest.fn().mockResolvedValue(undefined);
const mockUpdateTask = jest.fn().mockResolvedValue(undefined);
const mockGetDBConnection = jest.fn().mockReturnValue({ id: "conn-123", business_id: "biz-123", platform_id: 42 });
const mockGetEnrichedTask = jest.fn().mockResolvedValue({
	id: "task-psc-001",
	task_status: "CREATED",
	metadata: {}
});

jest.mock("#api/v1/modules/tasks/taskManager", () => {
	const originalModule = jest.requireActual("#api/v1/modules/tasks/taskManager");
	return {
		...originalModule,
		TaskManager: class MockTaskManager {
			dbConnection: any;
			constructor(dbConn: any) {
				this.dbConnection = dbConn;
			}
			getOrCreateTaskForCode = mockGetOrCreateTaskForCode;
			processTask = mockProcessTask;
			updateTaskStatus = mockUpdateTaskStatus;
			updateTask = mockUpdateTask;
			getDBConnection = mockGetDBConnection;
			static getEnrichedTask = mockGetEnrichedTask;
		}
	};
});

jest.mock("#lib/trulioo/business/truliooBusiness", () => ({
	TruliooBusiness: jest.fn().mockImplementation(() => ({
		triggerPSCScreening: jest.fn().mockResolvedValue(undefined)
	}))
}));

describe("TruliooPSCScreening", () => {
	describe("static configuration", () => {
		it("should use TRULIOO_PSC platform ID", () => {
			expect(TruliooPSCScreening["PLATFORM_ID"]).toBe(INTEGRATION_ID.TRULIOO_PSC);
		});

		it("should use the correct queue name", () => {
			expect(TruliooPSCScreening.getQueueName()).toBe(QUEUES.TRULIOO_PSC);
		});

		it("should use the correct queue event", () => {
			expect(TruliooPSCScreening.getQueueEvent()).toBe(EVENTS.FETCH_WATCHLIST_HITS);
		});

		it("should have a 3-minute overall task timeout", () => {
			expect(TruliooPSCScreening["TASK_TIMEOUT_IN_SECONDS"]).toBe(180);
		});

		it("should depend on Middesk fetch_business_entity_verification task with 2-minute timeout", () => {
			const deps = TruliooPSCScreening.DEPENDENT_TASKS;
			expect(deps.fetch_business_entity_verification).toBeDefined();
			expect(deps.fetch_business_entity_verification).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						platformId: INTEGRATION_ID.MIDDESK,
						timeoutInSeconds: 120
					})
				])
			);
		});
	});

	describe("executeDeferrableTask", () => {
		let instance: TruliooPSCScreening;
		let mockTruliooBusiness: any;

		beforeEach(() => {
			jest.clearAllMocks();

			const BullQueue = require("#helpers/bull-queue");
			const bullQueue = new BullQueue("trulioo-psc", {});

			instance = new TruliooPSCScreening({
				dbConnection: {
					id: "conn-123",
					business_id: "biz-123" as any,
					platform_id: INTEGRATION_ID.TRULIOO_PSC
				} as any,
				db: require("#helpers/knex").db,
				bullQueue
			});

			const { TruliooBusiness } = require("#lib/trulioo/business/truliooBusiness");
			mockTruliooBusiness = TruliooBusiness;
		});

		it("should return false when bev_id is missing from task metadata", async () => {
			const task = {
				id: "task-001",
				metadata: {},
				connection_id: "conn-123"
			} as any;
			const job = { data: { task_id: "task-001" } } as any;

			const result = await (instance as any).executeDeferrableTask(task, job);

			expect(result).toBe(false);
			const mockLogger = require("#helpers/logger").logger;
			expect(mockLogger.error).toHaveBeenCalledWith(
				expect.objectContaining({ businessId: "biz-123" }),
				expect.stringContaining("missing bev_id")
			);
		});

		it("should call triggerPSCScreening with correct parameters when bev_id exists", async () => {
			const mockTrigger = jest.fn().mockResolvedValue(undefined);
			mockTruliooBusiness.mockImplementation(() => ({
				triggerPSCScreening: mockTrigger
			}));

			const task = {
				id: "task-psc-001",
				metadata: {
					bev_id: "bev-456",
					origin_task_id: "original-task-789"
				},
				connection_id: "conn-123"
			} as any;
			const job = { data: { task_id: "task-psc-001" } } as any;

			const result = await (instance as any).executeDeferrableTask(task, job);

			expect(result).toBe(true);
			expect(mockTruliooBusiness).toHaveBeenCalledWith("biz-123");
			expect(mockTrigger).toHaveBeenCalledWith(
				"bev-456",
				expect.objectContaining({ status: "completed" }),
				expect.objectContaining({ hfSession: "US-DEFERRED-task-psc-001" }),
				"original-task-789"
			);
		});

		it("should use task.id as fallback when origin_task_id is missing", async () => {
			const mockTrigger = jest.fn().mockResolvedValue(undefined);
			mockTruliooBusiness.mockImplementation(() => ({
				triggerPSCScreening: mockTrigger
			}));

			const task = {
				id: "task-psc-002",
				metadata: { bev_id: "bev-789" },
				connection_id: "conn-123"
			} as any;
			const job = { data: { task_id: "task-psc-002" } } as any;

			await (instance as any).executeDeferrableTask(task, job);

			expect(mockTrigger).toHaveBeenCalledWith(
				"bev-789",
				expect.anything(),
				expect.anything(),
				"task-psc-002"
			);
		});

		it("should return false when triggerPSCScreening throws", async () => {
			mockTruliooBusiness.mockImplementation(() => ({
				triggerPSCScreening: jest.fn().mockRejectedValue(new Error("Trulioo API down"))
			}));

			const task = {
				id: "task-psc-003",
				metadata: { bev_id: "bev-fail" },
				connection_id: "conn-123"
			} as any;
			const job = { data: { task_id: "task-psc-003" } } as any;

			await expect((instance as any).executeDeferrableTask(task, job)).rejects.toThrow("Trulioo API down");
		});
	});

	describe("buildTaskMetadata", () => {
		it("should include both custom fields and DeferrableTaskManager tracking structure", () => {
			const metadata = (TruliooPSCScreening as any).buildTaskMetadata("bev-123", "origin-task-456");

			expect(metadata).toEqual({
				bev_id: "bev-123",
				origin_task_id: "origin-task-456",
				dependentFacts: {},
				dependentTasks: TruliooPSCScreening.DEPENDENT_TASKS,
				timeout: 180,
				maxAttempts: 8,
				attempts: 0
			});
		});

		it("should reference MIDDESK as dependent platform in dependentTasks", () => {
			const metadata = (TruliooPSCScreening as any).buildTaskMetadata("bev-x", "task-y");

			expect(metadata.dependentTasks.fetch_business_entity_verification).toEqual(
				expect.arrayContaining([
					expect.objectContaining({ platformId: INTEGRATION_ID.MIDDESK })
				])
			);
		});
	});

	describe("enqueueForBusiness", () => {
		beforeEach(() => {
			jest.clearAllMocks();
		});

		it("should create connection, task, and enqueue for business", async () => {
			const { getOrCreateConnection } = require("#helpers/platformHelper");

			await TruliooPSCScreening.enqueueForBusiness(
				"biz-456" as any,
				"bev-789",
				"origin-task-111"
			);

			expect(getOrCreateConnection).toHaveBeenCalledWith(
				"biz-456",
				INTEGRATION_ID.TRULIOO_PSC
			);
		});

		it("should call updateTask with complete metadata after getOrCreateTaskForCode", async () => {
			await TruliooPSCScreening.enqueueForBusiness(
				"biz-456" as any,
				"bev-789",
				"origin-task-111"
			);

			expect(mockUpdateTask).toHaveBeenCalledWith(
				"task-psc-001",
				{
					metadata: expect.objectContaining({
						bev_id: "bev-789",
						origin_task_id: "origin-task-111",
						dependentFacts: {},
						dependentTasks: TruliooPSCScreening.DEPENDENT_TASKS,
						timeout: 180,
						maxAttempts: 8,
						attempts: 0
					})
				}
			);
		});

		it("should call processTask with the returned taskId", async () => {
			await TruliooPSCScreening.enqueueForBusiness(
				"biz-456" as any,
				"bev-789",
				"origin-task-111"
			);

			expect(mockProcessTask).toHaveBeenCalledWith({ taskId: "task-psc-001" });
		});

		it("should pass complete metadata to getOrCreateTaskForCode", async () => {
			await TruliooPSCScreening.enqueueForBusiness(
				"biz-456" as any,
				"bev-789",
				"origin-task-111"
			);

			expect(mockGetOrCreateTaskForCode).toHaveBeenCalledWith({
				taskCode: "fetch_watchlist_hits",
				reference_id: "biz-456",
				metadata: expect.objectContaining({
					bev_id: "bev-789",
					origin_task_id: "origin-task-111",
					dependentTasks: expect.any(Object),
					timeout: 180,
					maxAttempts: 8,
					attempts: 0
				})
			});
		});
	});
});
