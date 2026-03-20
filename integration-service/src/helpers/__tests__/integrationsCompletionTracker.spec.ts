import { IntegrationsCompletionTracker, type CompletionState, type TaskType } from "../integrationsCompletionTracker";
import { redis } from "#helpers/redis";
import { logger } from "#helpers/logger";
import { producer } from "../kafka";
import { INTEGRATION_CATEGORIES, INTEGRATION_ID } from "#constants";
import type { IBusinessIntegrationTaskEnriched } from "#types";
import { PLATFORM_PROCESS_MAPPING } from "#constants/process-completion.constant";
import { getBusinessDetails, getBusinessCustomers, getCustomerCountries, getOnboardingCustomerSettings, getCustomerOnboardingStagesSettings } from "#helpers/api";
import { customerIntegrationSettings } from "#api/v1/modules/customer-integration-settings/customer-integration-settings";

// Mock dependencies
jest.mock("#helpers/redis", () => ({
	redis: {
		hset: jest.fn(),
		hgetall: jest.fn(),
		expire: jest.fn(),
		delete: jest.fn(),
		hincrby: jest.fn()
	}
}));

jest.mock("../kafka", () => ({
	producer: {
		send: jest.fn()
	}
}));

jest.mock("lodash", () => ({
	cloneDeep: jest.fn(obj => JSON.parse(JSON.stringify(obj)))
}));

// Mock API helpers for platform filtering
jest.mock("#helpers/api", () => ({
	getBusinessDetails: jest.fn(),
	getBusinessCustomers: jest.fn(),
	getCustomerCountries: jest.fn(),
	getOnboardingCustomerSettings: jest.fn(),
	getCustomerOnboardingStagesSettings: jest.fn()
}));

jest.mock("#api/v1/modules/customer-integration-settings/customer-integration-settings", () => ({
	customerIntegrationSettings: {
		findById: jest.fn(),
		getIntegrationStatusForCustomer: jest.fn()
	}
}));

describe("IntegrationsCompletionTracker", () => {
	const mockBusinessId = "550e8400-e29b-41d4-a716-446655440000";
	const mockCustomerId = "550e8400-e29b-41d4-a716-446655440001";
	const mockCaseId = "550e8400-e29b-41d4-a716-446655440002";
	const mockScoreTriggerId = "550e8400-e29b-41d4-a716-446655440003";

	const mockTask: IBusinessIntegrationTaskEnriched = {
		id: "task-1",
		business_id: mockBusinessId,
		customer_id: mockCustomerId,
		case_id: mockCaseId,
		business_score_trigger_id: mockScoreTriggerId,
		platform_code: "VERDATA",
		task_code: "fetch_public_records",
		task_status: "SUCCESS",
		platform_id: INTEGRATION_ID.VERDATA,
		platform_category_code: "PUBLIC_RECORDS",
		task_label: "Fetch Public Records"
	} as any;

	const createMockState = (overrides?: Partial<CompletionState>): CompletionState => ({
		business_id: mockBusinessId,
		customer_id: mockCustomerId,
		case_id: mockCaseId,
		score_trigger_id: mockScoreTriggerId,
		required_tasks: ["verdata:fetch_public_records", "equifax:fetch_public_records"] as TaskType[],
		required_tasks_by_category: {
			[INTEGRATION_CATEGORIES.PUBLIC_RECORDS]: [
				"verdata:fetch_public_records",
				"equifax:fetch_public_records"
			] as TaskType[]
		},
		completed_categories: [],
		completed_tasks: [],
		timed_out_tasks: [],
		tasks_required: 2,
		tasks_completed: 0,
		tasks_timed_out: 0,
		tasks_ignored: 0,
		is_all_complete: false,
		updated_at: new Date().toISOString(),
		started_at: new Date().toISOString(),
		initialized_at: new Date().toISOString(),
		timeout_threshold_seconds: 480,
		...overrides
	});

	beforeEach(() => {
		jest.clearAllMocks();
		(redis.hset as jest.Mock).mockResolvedValue(undefined);
		(redis.expire as jest.Mock).mockResolvedValue(undefined);
		(redis.delete as jest.Mock).mockResolvedValue(undefined);
		(redis.hincrby as jest.Mock).mockResolvedValue(1);
		(producer.send as jest.Mock).mockResolvedValue(undefined);
	});

	describe("initializeTracking", () => {
		it("should initialize tracking with correct state", async () => {
			const requirements = {
				[INTEGRATION_CATEGORIES.PUBLIC_RECORDS]: [
					"verdata:fetch_public_records" as TaskType,
					"equifax:fetch_public_records" as TaskType
				]
			};

			const tracker = await IntegrationsCompletionTracker.initializeTracking(mockTask, requirements);

			expect(tracker).toBeInstanceOf(IntegrationsCompletionTracker);
			expect(redis.hset).toHaveBeenCalledWith(
				expect.stringContaining(mockBusinessId),
				expect.objectContaining({
					business_id: mockBusinessId,
					customer_id: mockCustomerId,
					case_id: mockCaseId,
					score_trigger_id: mockScoreTriggerId,
					required_tasks: expect.arrayContaining(["verdata:fetch_public_records", "equifax:fetch_public_records"]),
					required_tasks_by_category: requirements,
					completed_categories: [],
					completed_tasks: [],
					timed_out_tasks: [],
					tasks_required: 2,
					tasks_completed: 0,
					tasks_timed_out: 0,
					tasks_ignored: 0,
					is_all_complete: false,
					updated_at: expect.any(String),
					initialized_at: expect.any(String),
					started_at: null,
					timeout_threshold_seconds: 480
				})
			);

			expect(redis.expire).toHaveBeenCalledWith(expect.stringContaining(mockBusinessId), 3600);
			expect(logger.info).toHaveBeenCalled();
		});

		it("should use custom timeout threshold when provided", async () => {
			const requirements = {
				[INTEGRATION_CATEGORIES.PUBLIC_RECORDS]: ["verdata:fetch_public_records" as TaskType]
			};
			const customTimeout = 600;

			await IntegrationsCompletionTracker.initializeTracking(mockTask, requirements, customTimeout);

			expect(redis.hset).toHaveBeenCalledWith(
				expect.stringContaining(mockBusinessId),
				expect.objectContaining({
					timeout_threshold_seconds: customTimeout
				})
			);
		});

		it("should deduplicate required tasks from multiple categories", async () => {
			const requirements = {
				[INTEGRATION_CATEGORIES.PUBLIC_RECORDS]: [
					"verdata:fetch_public_records" as TaskType,
					"equifax:fetch_public_records" as TaskType
				],
				[INTEGRATION_CATEGORIES.BUSINESS_ENTITY_VERIFICATION]: [
					"verdata:fetch_public_records" as TaskType // Duplicate
				]
			};

			await IntegrationsCompletionTracker.initializeTracking(mockTask, requirements);

			expect(redis.hset).toHaveBeenCalledWith(
				expect.stringContaining(mockBusinessId),
				expect.objectContaining({
					tasks_required: 2 // Should be deduplicated
				})
			);
		});
	});

	describe("forBusiness", () => {
		it("should create tracker instance from existing state", async () => {
			const mockState = createMockState();
			(redis.hgetall as jest.Mock).mockResolvedValue(mockState);

			const tracker = await IntegrationsCompletionTracker.forBusiness(mockBusinessId);

			expect(tracker).toBeInstanceOf(IntegrationsCompletionTracker);
			expect(redis.hgetall).toHaveBeenCalledWith(expect.stringContaining(mockBusinessId));
		});

		it("should throw error if no state found", async () => {
			(redis.hgetall as jest.Mock).mockResolvedValue(null);

			await expect(IntegrationsCompletionTracker.forBusiness(mockBusinessId)).rejects.toThrow(
				"No completion state found"
			);
		});

		it("should throw error if state is empty object", async () => {
			(redis.hgetall as jest.Mock).mockResolvedValue({});

			await expect(IntegrationsCompletionTracker.forBusiness(mockBusinessId)).rejects.toThrow(
				"No completion state found"
			);
		});
	});

	describe("getRequiredTasksByTaskType", () => {
		it("maps a task type to all matching integration categories", async () => {
			const taskTypes = ["verdata:fetch_public_records", "equifax:fetch_public_records"] as TaskType[];
			const expected = {
				[INTEGRATION_CATEGORIES.PUBLIC_RECORDS]: [taskTypes[0], taskTypes[1]],
				[INTEGRATION_CATEGORIES.BUREAU]: [taskTypes[1]],
				[INTEGRATION_CATEGORIES.BUSINESS_ENTITY_VERIFICATION]: [taskTypes[0], taskTypes[1]]
			};
			const result = IntegrationsCompletionTracker.getRequiredTasksByTaskType(taskTypes, PLATFORM_PROCESS_MAPPING);
			expect(result).toEqual(expected);
		});

		it("returns empty mapping when task type does not exist in process mapping", () => {
			const result = IntegrationsCompletionTracker.getRequiredTasksByTaskType(["does_not_exist:some_task" as TaskType]);
			expect(result).toEqual({});
		});
	});

	describe("handleTaskComplete", () => {
		let tracker: IntegrationsCompletionTracker;
		let mockState: CompletionState;

		beforeEach(async () => {
			mockState = createMockState();
			// Persist the mock state across multiple calls within each test
			(redis.hgetall as jest.Mock).mockResolvedValue(mockState);
			(redis.hset as jest.Mock).mockResolvedValue(undefined);
			(redis.hincrby as jest.Mock).mockResolvedValue(1);
			tracker = await IntegrationsCompletionTracker.forBusiness(mockBusinessId);
		});

		it("should mark a task as complete and update state", async () => {
			// Create a simpler state where we're completing the exact required task
			const simpleState = createMockState({
				required_tasks: ["verdata:fetch_public_records", "*:fetch_public_records", "verdata:*"] as TaskType[],
				tasks_required: 1
			});

			// Ensure state is returned consistently for all getCompletionState calls
			(redis.hgetall as jest.Mock).mockResolvedValue(simpleState);
			tracker = await IntegrationsCompletionTracker.forBusiness(mockBusinessId);

			const result = await tracker.handleTaskComplete(mockTask);

			expect(redis.hincrby).toHaveBeenCalledWith(expect.stringContaining(mockBusinessId), "tasks_completed");
			expect(logger.info).toHaveBeenCalled();
			expect(result).toEqual([]);
		});

		it("should emit category complete event when category is complete", async () => {
			const singleTaskState = createMockState({
				required_tasks: ["verdata:fetch_public_records"] as TaskType[],
				required_tasks_by_category: {
					[INTEGRATION_CATEGORIES.PUBLIC_RECORDS]: ["verdata:fetch_public_records"] as TaskType[]
				},
				tasks_required: 1
			});

			(redis.hgetall as jest.Mock).mockResolvedValue(singleTaskState);
			tracker = await IntegrationsCompletionTracker.forBusiness(mockBusinessId);

			const result = await tracker.handleTaskComplete(mockTask);

			expect(result).toEqual([INTEGRATION_CATEGORIES.PUBLIC_RECORDS]);
			expect(producer.send).toHaveBeenCalled();
		});

		it("should return empty array if task not in required tasks", async () => {
			tracker = await IntegrationsCompletionTracker.forBusiness(mockBusinessId);

			const nonRequiredTask = {
				...mockTask,
				platform_code: "QUICKBOOKS",
				task_code: "fetch_accounting_data"
			} as any;

			const result = await tracker.handleTaskComplete(nonRequiredTask);

			expect(redis.hincrby).toHaveBeenCalledWith(expect.stringContaining(mockBusinessId), "tasks_ignored");
			expect(result).toEqual([]);
		});

		it("should return empty array if task already completed", async () => {
			const completedState = createMockState({
				completed_tasks: ["verdata:fetch_public_records", "*:fetch_public_records", "verdata:*"] as TaskType[]
			});

			(redis.hgetall as jest.Mock).mockResolvedValue(completedState);
			tracker = await IntegrationsCompletionTracker.forBusiness(mockBusinessId);

			const result = await tracker.handleTaskComplete(mockTask);

			expect(redis.hincrby).not.toHaveBeenCalledWith(expect.anything(), "tasks_completed");
			expect(result).toEqual([]);
		});

		it("should handle wildcard platform task types", async () => {
			const wildcardState = createMockState({
				required_tasks: ["*:fetch_public_records"] as TaskType[],
				required_tasks_by_category: {
					[INTEGRATION_CATEGORIES.PUBLIC_RECORDS]: ["*:fetch_public_records"] as TaskType[]
				},
				tasks_required: 1
			});

			(redis.hgetall as jest.Mock).mockResolvedValue(wildcardState);
			tracker = await IntegrationsCompletionTracker.forBusiness(mockBusinessId);

			await tracker.handleTaskComplete(mockTask);

			expect(redis.hincrby).toHaveBeenCalledWith(expect.stringContaining(mockBusinessId), "tasks_completed");
		});

		it("should handle wildcard task code types", async () => {
			const wildcardState = createMockState({
				required_tasks: ["verdata:*"] as TaskType[],
				required_tasks_by_category: {
					[INTEGRATION_CATEGORIES.PUBLIC_RECORDS]: ["verdata:*"] as TaskType[]
				},
				tasks_required: 1
			});

			(redis.hgetall as jest.Mock).mockResolvedValue(wildcardState);
			tracker = await IntegrationsCompletionTracker.forBusiness(mockBusinessId);

			await tracker.handleTaskComplete(mockTask);

			expect(redis.hincrby).toHaveBeenCalledWith(expect.stringContaining(mockBusinessId), "tasks_completed");
		});

		it("should consider timed out tasks when checking category completion", async () => {
			const stateWithTimeout = createMockState({
				required_tasks_by_category: {
					[INTEGRATION_CATEGORIES.PUBLIC_RECORDS]: [
						"verdata:fetch_public_records",
						"equifax:fetch_public_records"
					] as TaskType[]
				},
				timed_out_tasks: ["equifax:fetch_public_records", "*:fetch_public_records", "equifax:*"] as TaskType[]
			});

			(redis.hgetall as jest.Mock).mockResolvedValue(stateWithTimeout);
			tracker = await IntegrationsCompletionTracker.forBusiness(mockBusinessId);

			const result = await tracker.handleTaskComplete(mockTask);

			expect(result).toEqual([INTEGRATION_CATEGORIES.PUBLIC_RECORDS]);
		});

		it("should handle multiple categories with overlapping tasks", async () => {
			const requirements = {
				[INTEGRATION_CATEGORIES.PUBLIC_RECORDS]: ["equifax:fetch_public_records" as TaskType],
				[INTEGRATION_CATEGORIES.BUREAU]: ["equifax:fetch_public_records" as TaskType]
			};

			const multiCategoryState = createMockState({
				required_tasks: ["equifax:fetch_public_records"] as TaskType[],
				required_tasks_by_category: requirements,
				tasks_required: 1
			});

			(redis.hgetall as jest.Mock).mockResolvedValue(multiCategoryState);
			tracker = await IntegrationsCompletionTracker.forBusiness(mockBusinessId);

			const equifaxTask = {
				...mockTask,
				platform_code: "EQUIFAX",
				task_code: "fetch_public_records"
			} as any;

			const result = await tracker.handleTaskComplete(equifaxTask);

			expect(result.sort()).toEqual([INTEGRATION_CATEGORIES.PUBLIC_RECORDS, INTEGRATION_CATEGORIES.BUREAU].sort());
		});
	});

	describe("getCompletionState", () => {
		it("should return completion state for existing business", async () => {
			const mockState = createMockState();
			(redis.hgetall as jest.Mock).mockResolvedValue(mockState);

			const tracker = await IntegrationsCompletionTracker.forBusiness(mockBusinessId);
			const state = await tracker.getCompletionState();

			expect(redis.hgetall).toHaveBeenCalledWith(expect.stringContaining(mockBusinessId));
			expect(state).toMatchObject(mockState);
		});

		it("should throw error if state not found", async () => {
			const mockState = createMockState();
			(redis.hgetall as jest.Mock).mockResolvedValueOnce(mockState).mockResolvedValueOnce(null);

			const tracker = await IntegrationsCompletionTracker.forBusiness(mockBusinessId);

			await expect(tracker.getCompletionState()).rejects.toThrow("No completion state found");
		});
	});

	describe("checkAndMarkTimeouts", () => {
		it("should mark tasks as timed out if threshold exceeded", async () => {
			const pastDate = new Date(Date.now() - 10 * 60 * 1000); // 10 minutes ago
			const mockState = createMockState({
				started_at: pastDate.toISOString(),
				timeout_threshold_seconds: 480 // 8 minutes
			});

			(redis.hgetall as jest.Mock).mockResolvedValue(mockState);
			const tracker = await IntegrationsCompletionTracker.forBusiness(mockBusinessId);

			await tracker.checkAndMarkTimeouts();

			expect(redis.hincrby).toHaveBeenCalled();
			expect(redis.hset).toHaveBeenCalled();
			expect(logger.debug).toHaveBeenCalled();
		});

		it("should not mark tasks as timed out if threshold not exceeded", async () => {
			const recentDate = new Date(Date.now() - 1 * 60 * 1000); // 1 minute ago
			const mockState = createMockState({
				started_at: recentDate.toISOString(),
				timeout_threshold_seconds: 480 // 8 minutes
			});

			(redis.hgetall as jest.Mock).mockResolvedValue(mockState);
			const tracker = await IntegrationsCompletionTracker.forBusiness(mockBusinessId);

			await tracker.checkAndMarkTimeouts();

			expect(redis.hincrby).not.toHaveBeenCalled();
			expect(logger.warn).not.toHaveBeenCalled();
		});

		it("should skip already completed tasks", async () => {
			const pastDate = new Date(Date.now() - 10 * 60 * 1000);
			const mockState = createMockState({
				completed_tasks: ["verdata:fetch_public_records", "*:fetch_public_records", "verdata:*"] as TaskType[],
				started_at: pastDate.toISOString(),
				timeout_threshold_seconds: 480
			});

			(redis.hgetall as jest.Mock).mockResolvedValue(mockState);
			const tracker = await IntegrationsCompletionTracker.forBusiness(mockBusinessId);

			await tracker.checkAndMarkTimeouts();

			// Should only process uncompleted task (equifax)
			expect(redis.hincrby).toHaveBeenCalledTimes(1);
		});

		it("should skip already timed out tasks", async () => {
			const pastDate = new Date(Date.now() - 10 * 60 * 1000);
			const mockState = createMockState({
				timed_out_tasks: ["verdata:fetch_public_records"] as TaskType[],
				started_at: pastDate.toISOString(),
				timeout_threshold_seconds: 480
			});

			(redis.hgetall as jest.Mock).mockResolvedValue(mockState);
			const tracker = await IntegrationsCompletionTracker.forBusiness(mockBusinessId);

			await tracker.checkAndMarkTimeouts();

			// Should only process un-timed-out task (equifax)
			expect(redis.hincrby).toHaveBeenCalledTimes(1);
		});
	});

	describe("getAllRequiredTasks", () => {
		beforeEach(() => {
			// Reset API mocks
			(getBusinessDetails as jest.Mock).mockReset();
			(getBusinessCustomers as jest.Mock).mockReset();
			(getCustomerCountries as jest.Mock).mockReset();
			(customerIntegrationSettings.findById as jest.Mock).mockReset();
			(customerIntegrationSettings.getIntegrationStatusForCustomer as jest.Mock).mockReset();
		});

		it("should return all required tasks from PLATFORM_PROCESS_MAPPING", async () => {
			// Setup US business with all integrations enabled
			(getBusinessDetails as jest.Mock).mockResolvedValue({
				status: "success",
				data: { address_country: "US" }
			});
			(customerIntegrationSettings.findById as jest.Mock).mockResolvedValue({
				settings: { equifax: { status: "ACTIVE" }, bjl: { status: "ACTIVE" } }
			});
			(customerIntegrationSettings.getIntegrationStatusForCustomer as jest.Mock).mockResolvedValue([
				{ integration_code: "middesk", status: "ENABLED" },
				{ integration_code: "verdata", status: "ENABLED" }
			]);

			const result = await IntegrationsCompletionTracker.getAllRequiredTasks(mockBusinessId, mockCustomerId);

			expect(result).toBeDefined();
			expect(typeof result).toBe("object");

			// Verify it processes PLATFORM_PROCESS_MAPPING correctly
			const publicRecordsTasks = result[INTEGRATION_CATEGORIES.PUBLIC_RECORDS];
			expect(publicRecordsTasks).toBeDefined();
			expect(Array.isArray(publicRecordsTasks)).toBe(true);
		});

		it("should skip isComplete property", async () => {
			(getBusinessDetails as jest.Mock).mockResolvedValue({
				status: "success",
				data: { address_country: "US" }
			});
			(customerIntegrationSettings.findById as jest.Mock).mockResolvedValue({ settings: {} });
			(customerIntegrationSettings.getIntegrationStatusForCustomer as jest.Mock).mockResolvedValue([]);

			const result = await IntegrationsCompletionTracker.getAllRequiredTasks(mockBusinessId, mockCustomerId);

			const allTasks = Object.values(result).flat();
			expect(allTasks.every(task => !task.includes("isComplete"))).toBe(true);
		});

		it("should convert task types to lowercase", async () => {
			(getBusinessDetails as jest.Mock).mockResolvedValue({
				status: "success",
				data: { address_country: "US" }
			});
			(customerIntegrationSettings.findById as jest.Mock).mockResolvedValue({ settings: {} });
			(customerIntegrationSettings.getIntegrationStatusForCustomer as jest.Mock).mockResolvedValue([]);

			const result = await IntegrationsCompletionTracker.getAllRequiredTasks(mockBusinessId, mockCustomerId);

			const allTasks = Object.values(result).flat();
			expect(allTasks.every(task => task === task.toLowerCase())).toBe(true);
		});
	});

	describe("Platform Filtering", () => {
		beforeEach(() => {
			// Reset all mocks
			(getBusinessDetails as jest.Mock).mockReset();
			(getBusinessCustomers as jest.Mock).mockReset();
			(getCustomerCountries as jest.Mock).mockReset();
			(customerIntegrationSettings.findById as jest.Mock).mockReset();
			(customerIntegrationSettings.getIntegrationStatusForCustomer as jest.Mock).mockReset();
		});

		describe("US Business Filtering", () => {
			it("should include MIDDESK for US business when enabled", async () => {
				(getBusinessDetails as jest.Mock).mockResolvedValue({
					status: "success",
					data: { address_country: "US" }
				});
				(customerIntegrationSettings.findById as jest.Mock).mockResolvedValue({
					settings: { equifax: { status: "ACTIVE" } }
				});
				(customerIntegrationSettings.getIntegrationStatusForCustomer as jest.Mock).mockResolvedValue([
					{ integration_code: "middesk", status: "ENABLED" }
				]);

				const result = await IntegrationsCompletionTracker.getAllRequiredTasks(mockBusinessId, mockCustomerId);

				const bevTasks = result[INTEGRATION_CATEGORIES.BUSINESS_ENTITY_VERIFICATION] || [];
				expect(bevTasks.some(t => t.includes("middesk"))).toBe(true);
			});

			it("should exclude MIDDESK for US business when disabled", async () => {
				(getBusinessDetails as jest.Mock).mockResolvedValue({
					status: "success",
					data: { address_country: "US" }
				});
				(customerIntegrationSettings.findById as jest.Mock).mockResolvedValue({ settings: {} });
				(customerIntegrationSettings.getIntegrationStatusForCustomer as jest.Mock).mockResolvedValue([
					{ integration_code: "middesk", status: "DISABLED" }
				]);

				const result = await IntegrationsCompletionTracker.getAllRequiredTasks(mockBusinessId, mockCustomerId);

				const bevTasks = result[INTEGRATION_CATEGORIES.BUSINESS_ENTITY_VERIFICATION] || [];
				expect(bevTasks.some(t => t.includes("middesk"))).toBe(false);
			});

			it("should exclude TRULIOO for US business", async () => {
				(getBusinessDetails as jest.Mock).mockResolvedValue({
					status: "success",
					data: { address_country: "US" }
				});
				(customerIntegrationSettings.findById as jest.Mock).mockResolvedValue({ settings: {} });
				(customerIntegrationSettings.getIntegrationStatusForCustomer as jest.Mock).mockResolvedValue([
					{ integration_code: "trulioo", status: "ENABLED" }
				]);

				const result = await IntegrationsCompletionTracker.getAllRequiredTasks(mockBusinessId, mockCustomerId);

				const bevTasks = result[INTEGRATION_CATEGORIES.BUSINESS_ENTITY_VERIFICATION] || [];
				expect(bevTasks.some(t => t.includes("trulioo"))).toBe(false);
			});

			it("should include EQUIFAX for US business when active", async () => {
				(getBusinessDetails as jest.Mock).mockResolvedValue({
					status: "success",
					data: { address_country: "US" }
				});
				(customerIntegrationSettings.findById as jest.Mock).mockResolvedValue({
					settings: { equifax: { status: "ACTIVE" } }
				});
				(customerIntegrationSettings.getIntegrationStatusForCustomer as jest.Mock).mockResolvedValue([]);

				const result = await IntegrationsCompletionTracker.getAllRequiredTasks(mockBusinessId, mockCustomerId);

				const publicRecordsTasks = result[INTEGRATION_CATEGORIES.PUBLIC_RECORDS] || [];
				expect(publicRecordsTasks.some(t => t.includes("equifax"))).toBe(true);
			});

			it("should exclude EQUIFAX for US business when inactive", async () => {
				(getBusinessDetails as jest.Mock).mockResolvedValue({
					status: "success",
					data: { address_country: "US" }
				});
				(customerIntegrationSettings.findById as jest.Mock).mockResolvedValue({
					settings: { equifax: { status: "INACTIVE" } }
				});
				(customerIntegrationSettings.getIntegrationStatusForCustomer as jest.Mock).mockResolvedValue([]);

				const result = await IntegrationsCompletionTracker.getAllRequiredTasks(mockBusinessId, mockCustomerId);

				const publicRecordsTasks = result[INTEGRATION_CATEGORIES.PUBLIC_RECORDS] || [];
				expect(publicRecordsTasks.some(t => t.includes("equifax"))).toBe(false);
			});

			it("should include VERDATA for US business when enabled", async () => {
				(getBusinessDetails as jest.Mock).mockResolvedValue({
					status: "success",
					data: { address_country: "US" }
				});
				(customerIntegrationSettings.findById as jest.Mock).mockResolvedValue({
					settings: { bjl: { status: "ACTIVE" } }
				});
				(customerIntegrationSettings.getIntegrationStatusForCustomer as jest.Mock).mockResolvedValue([
					{ integration_code: "verdata", status: "ENABLED" }
				]);

				const result = await IntegrationsCompletionTracker.getAllRequiredTasks(mockBusinessId, mockCustomerId);

				const publicRecordsTasks = result[INTEGRATION_CATEGORIES.PUBLIC_RECORDS] || [];
				expect(publicRecordsTasks.some(t => t.includes("verdata"))).toBe(true);
			});
		});

		describe("Non-US Business Filtering", () => {
			it("should exclude MIDDESK for Canadian business", async () => {
				(getBusinessDetails as jest.Mock).mockResolvedValue({
					status: "success",
					data: { address_country: "CA" }
				});
				(customerIntegrationSettings.findById as jest.Mock).mockResolvedValue({ settings: {} });
				(customerIntegrationSettings.getIntegrationStatusForCustomer as jest.Mock).mockResolvedValue([]);
				(getCustomerCountries as jest.Mock).mockResolvedValue([]);

				const result = await IntegrationsCompletionTracker.getAllRequiredTasks(mockBusinessId, mockCustomerId);

				const bevTasks = result[INTEGRATION_CATEGORIES.BUSINESS_ENTITY_VERIFICATION] || [];
				expect(bevTasks.some(t => t.includes("middesk"))).toBe(false);
			});

			it("should include TRULIOO for Canadian business when enabled and CA in countries", async () => {
				(getBusinessDetails as jest.Mock).mockResolvedValue({
					status: "success",
					data: { address_country: "CA" }
				});
				(customerIntegrationSettings.findById as jest.Mock).mockResolvedValue({ settings: {} });
				(customerIntegrationSettings.getIntegrationStatusForCustomer as jest.Mock).mockResolvedValue([
					{ integration_code: "trulioo", status: "ENABLED" }
				]);
				(getCustomerCountries as jest.Mock).mockResolvedValue([
					{ jurisdiction_code: "CA", is_selected: true }
				]);

				const result = await IntegrationsCompletionTracker.getAllRequiredTasks(mockBusinessId, mockCustomerId);

				const bevTasks = result[INTEGRATION_CATEGORIES.BUSINESS_ENTITY_VERIFICATION] || [];
				expect(bevTasks.some(t => t.includes("trulioo"))).toBe(true);
			});

			it("should exclude TRULIOO when country not in enabled list", async () => {
				(getBusinessDetails as jest.Mock).mockResolvedValue({
					status: "success",
					data: { address_country: "GB" }
				});
				(customerIntegrationSettings.findById as jest.Mock).mockResolvedValue({ settings: {} });
				(customerIntegrationSettings.getIntegrationStatusForCustomer as jest.Mock).mockResolvedValue([
					{ integration_code: "trulioo", status: "ENABLED" }
				]);
				(getCustomerCountries as jest.Mock).mockResolvedValue([
					{ jurisdiction_code: "CA", is_selected: true } // Only CA enabled, not GB
				]);

				const result = await IntegrationsCompletionTracker.getAllRequiredTasks(mockBusinessId, mockCustomerId);

				const bevTasks = result[INTEGRATION_CATEGORIES.BUSINESS_ENTITY_VERIFICATION] || [];
				expect(bevTasks.some(t => t.includes("trulioo"))).toBe(false);
			});

			it("should exclude TRULIOO when integration not enabled", async () => {
				(getBusinessDetails as jest.Mock).mockResolvedValue({
					status: "success",
					data: { address_country: "CA" }
				});
				(customerIntegrationSettings.findById as jest.Mock).mockResolvedValue({ settings: {} });
				(customerIntegrationSettings.getIntegrationStatusForCustomer as jest.Mock).mockResolvedValue([
					{ integration_code: "trulioo", status: "DISABLED" }
				]);
				(getCustomerCountries as jest.Mock).mockResolvedValue([
					{ jurisdiction_code: "CA", is_selected: true }
				]);

				const result = await IntegrationsCompletionTracker.getAllRequiredTasks(mockBusinessId, mockCustomerId);

				const bevTasks = result[INTEGRATION_CATEGORIES.BUSINESS_ENTITY_VERIFICATION] || [];
				expect(bevTasks.some(t => t.includes("trulioo"))).toBe(false);
			});

			it("should include CANADA_OPEN only for Canadian business", async () => {
				(getBusinessDetails as jest.Mock).mockResolvedValue({
					status: "success",
					data: { address_country: "CA" }
				});
				(customerIntegrationSettings.findById as jest.Mock).mockResolvedValue({ settings: {} });
				(customerIntegrationSettings.getIntegrationStatusForCustomer as jest.Mock).mockResolvedValue([]);
				(getCustomerCountries as jest.Mock).mockResolvedValue([]);

				const result = await IntegrationsCompletionTracker.getAllRequiredTasks(mockBusinessId, mockCustomerId);

				const bevTasks = result[INTEGRATION_CATEGORIES.BUSINESS_ENTITY_VERIFICATION] || [];
				expect(bevTasks.some(t => t.includes("canada_open"))).toBe(true);
			});

			it("should exclude CANADA_OPEN for non-Canadian business", async () => {
				(getBusinessDetails as jest.Mock).mockResolvedValue({
					status: "success",
					data: { address_country: "GB" }
				});
				(customerIntegrationSettings.findById as jest.Mock).mockResolvedValue({ settings: {} });
				(customerIntegrationSettings.getIntegrationStatusForCustomer as jest.Mock).mockResolvedValue([]);
				(getCustomerCountries as jest.Mock).mockResolvedValue([]);

				const result = await IntegrationsCompletionTracker.getAllRequiredTasks(mockBusinessId, mockCustomerId);

				const bevTasks = result[INTEGRATION_CATEGORIES.BUSINESS_ENTITY_VERIFICATION] || [];
				expect(bevTasks.some(t => t.includes("canada_open"))).toBe(false);
			});

			it("should exclude EQUIFAX for non-US business", async () => {
				(getBusinessDetails as jest.Mock).mockResolvedValue({
					status: "success",
					data: { address_country: "CA" }
				});
				(customerIntegrationSettings.findById as jest.Mock).mockResolvedValue({
					settings: { equifax: { status: "ACTIVE" } }
				});
				(customerIntegrationSettings.getIntegrationStatusForCustomer as jest.Mock).mockResolvedValue([]);
				(getCustomerCountries as jest.Mock).mockResolvedValue([]);

				const result = await IntegrationsCompletionTracker.getAllRequiredTasks(mockBusinessId, mockCustomerId);

				const publicRecordsTasks = result[INTEGRATION_CATEGORIES.PUBLIC_RECORDS] || [];
				expect(publicRecordsTasks.some(t => t.includes("equifax"))).toBe(false);
			});
		});

		describe("Settings-based Platform Filtering", () => {
			it("should include PLAID_IDV when identity_verification is active and ownership stage enabled", async () => {
				(getBusinessDetails as jest.Mock).mockResolvedValue({
					status: "success",
					data: { address_country: "US" }
				});
				(customerIntegrationSettings.findById as jest.Mock).mockResolvedValue({
					settings: { identity_verification: { status: "ACTIVE" } }
				});
				(customerIntegrationSettings.getIntegrationStatusForCustomer as jest.Mock).mockResolvedValue([]);
				// Mock onboarding settings to enable ownership stage
				(getOnboardingCustomerSettings as jest.Mock).mockResolvedValue([
					{ code: "modify_pages_fields_setup", is_enabled: true }
				]);
				(getCustomerOnboardingStagesSettings as jest.Mock).mockResolvedValue([
					{ stage_code: "ownership", is_enabled: true }
				]);

				const result = await IntegrationsCompletionTracker.getAllRequiredTasks(mockBusinessId, mockCustomerId);

				const verificationTasks = result[INTEGRATION_CATEGORIES.VERIFICATION] || [];
				expect(verificationTasks.some(t => t.includes("plaid_idv"))).toBe(true);
			});

			it("should exclude PLAID_IDV when identity_verification is inactive", async () => {
				(getBusinessDetails as jest.Mock).mockResolvedValue({
					status: "success",
					data: { address_country: "US" }
				});
				(customerIntegrationSettings.findById as jest.Mock).mockResolvedValue({
					settings: { identity_verification: { status: "INACTIVE" } }
				});
				(customerIntegrationSettings.getIntegrationStatusForCustomer as jest.Mock).mockResolvedValue([]);

				const result = await IntegrationsCompletionTracker.getAllRequiredTasks(mockBusinessId, mockCustomerId);

				const verificationTasks = result[INTEGRATION_CATEGORIES.VERIFICATION] || [];
				expect(verificationTasks.some(t => t.includes("plaid_idv"))).toBe(false);
			});

			it("should exclude PLAID_IDV when identity_verification setting is missing from settings object", async () => {
				(getBusinessDetails as jest.Mock).mockResolvedValue({
					status: "success",
					data: { address_country: "US" }
				});
				// Settings object exists but identity_verification key is missing
				(customerIntegrationSettings.findById as jest.Mock).mockResolvedValue({
					settings: { equifax: { status: "ACTIVE" } } // other settings exist, but not identity_verification
				});
				(customerIntegrationSettings.getIntegrationStatusForCustomer as jest.Mock).mockResolvedValue([]);

				const result = await IntegrationsCompletionTracker.getAllRequiredTasks(mockBusinessId, mockCustomerId);

				const verificationTasks = result[INTEGRATION_CATEGORIES.VERIFICATION] || [];
				// Should be excluded because setting must be explicitly ACTIVE (opt-in behavior)
				expect(verificationTasks.some(t => t.includes("plaid_idv"))).toBe(false);
			});

			it("should exclude EQUIFAX when equifax setting is missing from settings object", async () => {
				(getBusinessDetails as jest.Mock).mockResolvedValue({
					status: "success",
					data: { address_country: "US" }
				});
				// Settings object exists but equifax key is missing
				(customerIntegrationSettings.findById as jest.Mock).mockResolvedValue({
					settings: { identity_verification: { status: "ACTIVE" } } // other settings exist, but not equifax
				});
				(customerIntegrationSettings.getIntegrationStatusForCustomer as jest.Mock).mockResolvedValue([]);

				const result = await IntegrationsCompletionTracker.getAllRequiredTasks(mockBusinessId, mockCustomerId);

				const publicRecordsTasks = result[INTEGRATION_CATEGORIES.PUBLIC_RECORDS] || [];
				// Should be excluded because setting must be explicitly ACTIVE (opt-in behavior)
				expect(publicRecordsTasks.some(t => t.includes("equifax"))).toBe(false);
			});

			it("should exclude setting-based platforms when settings object is empty", async () => {
				(getBusinessDetails as jest.Mock).mockResolvedValue({
					status: "success",
					data: { address_country: "US" }
				});
				// Empty settings object
				(customerIntegrationSettings.findById as jest.Mock).mockResolvedValue({
					settings: {}
				});
				(customerIntegrationSettings.getIntegrationStatusForCustomer as jest.Mock).mockResolvedValue([]);

				const result = await IntegrationsCompletionTracker.getAllRequiredTasks(mockBusinessId, mockCustomerId);

				// PLAID_IDV should be excluded (requires identity_verification: ACTIVE)
				const verificationTasks = result[INTEGRATION_CATEGORIES.VERIFICATION] || [];
				expect(verificationTasks.some(t => t.includes("plaid_idv"))).toBe(false);

				// EQUIFAX should be excluded (requires equifax: ACTIVE)
				const publicRecordsTasks = result[INTEGRATION_CATEGORIES.PUBLIC_RECORDS] || [];
				expect(publicRecordsTasks.some(t => t.includes("equifax"))).toBe(false);
			});

			it("should exclude setting-based platforms when settings is null", async () => {
				(getBusinessDetails as jest.Mock).mockResolvedValue({
					status: "success",
					data: { address_country: "US" }
				});
				// Null settings
				(customerIntegrationSettings.findById as jest.Mock).mockResolvedValue({
					settings: null
				});
				(customerIntegrationSettings.getIntegrationStatusForCustomer as jest.Mock).mockResolvedValue([]);

				const result = await IntegrationsCompletionTracker.getAllRequiredTasks(mockBusinessId, mockCustomerId);

				// PLAID_IDV should be excluded
				const verificationTasks = result[INTEGRATION_CATEGORIES.VERIFICATION] || [];
				expect(verificationTasks.some(t => t.includes("plaid_idv"))).toBe(false);

				// EQUIFAX should be excluded
				const publicRecordsTasks = result[INTEGRATION_CATEGORIES.PUBLIC_RECORDS] || [];
				expect(publicRecordsTasks.some(t => t.includes("equifax"))).toBe(false);
			});

			it("should exclude setting-based platforms when findById returns null", async () => {
				(getBusinessDetails as jest.Mock).mockResolvedValue({
					status: "success",
					data: { address_country: "US" }
				});
				// findById returns null (customer integration settings not found)
				(customerIntegrationSettings.findById as jest.Mock).mockResolvedValue(null);
				(customerIntegrationSettings.getIntegrationStatusForCustomer as jest.Mock).mockResolvedValue([]);

				const result = await IntegrationsCompletionTracker.getAllRequiredTasks(mockBusinessId, mockCustomerId);

				// PLAID_IDV should be excluded
				const verificationTasks = result[INTEGRATION_CATEGORIES.VERIFICATION] || [];
				expect(verificationTasks.some(t => t.includes("plaid_idv"))).toBe(false);

				// EQUIFAX should be excluded
				const publicRecordsTasks = result[INTEGRATION_CATEGORIES.PUBLIC_RECORDS] || [];
				expect(publicRecordsTasks.some(t => t.includes("equifax"))).toBe(false);
			});
		});

		describe("Always Included Platforms", () => {
			it("should always include ZOOMINFO regardless of settings", async () => {
				(getBusinessDetails as jest.Mock).mockResolvedValue({
					status: "success",
					data: { address_country: "US" }
				});
				(customerIntegrationSettings.findById as jest.Mock).mockResolvedValue({ settings: {} });
				(customerIntegrationSettings.getIntegrationStatusForCustomer as jest.Mock).mockResolvedValue([]);

				const result = await IntegrationsCompletionTracker.getAllRequiredTasks(mockBusinessId, mockCustomerId);

				const bevTasks = result[INTEGRATION_CATEGORIES.BUSINESS_ENTITY_VERIFICATION] || [];
				expect(bevTasks.some(t => t.includes("zoominfo"))).toBe(true);
			});

			it("should always include OPENCORPORATES regardless of settings", async () => {
				(getBusinessDetails as jest.Mock).mockResolvedValue({
					status: "success",
					data: { address_country: "US" }
				});
				(customerIntegrationSettings.findById as jest.Mock).mockResolvedValue({ settings: {} });
				(customerIntegrationSettings.getIntegrationStatusForCustomer as jest.Mock).mockResolvedValue([]);

				const result = await IntegrationsCompletionTracker.getAllRequiredTasks(mockBusinessId, mockCustomerId);

				const bevTasks = result[INTEGRATION_CATEGORIES.BUSINESS_ENTITY_VERIFICATION] || [];
				expect(bevTasks.some(t => t.includes("opencorporates"))).toBe(true);
			});

			it("should always include MATCH regardless of settings", async () => {
				(getBusinessDetails as jest.Mock).mockResolvedValue({
					status: "success",
					data: { address_country: "US" }
				});
				(customerIntegrationSettings.findById as jest.Mock).mockResolvedValue({ settings: {} });
				(customerIntegrationSettings.getIntegrationStatusForCustomer as jest.Mock).mockResolvedValue([]);

				const result = await IntegrationsCompletionTracker.getAllRequiredTasks(mockBusinessId, mockCustomerId);

				const bevTasks = result[INTEGRATION_CATEGORIES.BUSINESS_ENTITY_VERIFICATION] || [];
				expect(bevTasks.some(t => t.includes("match"))).toBe(true);
			});
		});

		describe("Error Handling", () => {
			it("should use defaults when getBusinessDetails fails", async () => {
				(getBusinessDetails as jest.Mock).mockRejectedValue(new Error("API Error"));
				(customerIntegrationSettings.findById as jest.Mock).mockResolvedValue({ settings: {} });
				(customerIntegrationSettings.getIntegrationStatusForCustomer as jest.Mock).mockResolvedValue([]);

				const result = await IntegrationsCompletionTracker.getAllRequiredTasks(mockBusinessId, mockCustomerId);

				// Should still return results (defaults to US)
				expect(result).toBeDefined();
			});

			it("should use defaults when customerIntegrationSettings fails", async () => {
				(getBusinessDetails as jest.Mock).mockResolvedValue({
					status: "success",
					data: { address_country: "US" }
				});
				(customerIntegrationSettings.findById as jest.Mock).mockRejectedValue(new Error("API Error"));
				(customerIntegrationSettings.getIntegrationStatusForCustomer as jest.Mock).mockRejectedValue(
					new Error("API Error")
				);

				const result = await IntegrationsCompletionTracker.getAllRequiredTasks(mockBusinessId, mockCustomerId);

				// Should still return results with defaults
				expect(result).toBeDefined();
			});

			it("should handle missing customer ID by fetching from business", async () => {
				(getBusinessDetails as jest.Mock).mockResolvedValue({
					status: "success",
					data: { address_country: "US" }
				});
				(getBusinessCustomers as jest.Mock).mockResolvedValue({
					customer_ids: [mockCustomerId]
				});
				(customerIntegrationSettings.findById as jest.Mock).mockResolvedValue({ settings: {} });
				(customerIntegrationSettings.getIntegrationStatusForCustomer as jest.Mock).mockResolvedValue([]);

				const result = await IntegrationsCompletionTracker.getAllRequiredTasks(mockBusinessId, null);

				expect(getBusinessCustomers).toHaveBeenCalledWith(mockBusinessId);
				expect(result).toBeDefined();
			});
		});
	});

	describe("cleanupTracking", () => {
		it("should delete tracking data from Redis", async () => {
			const mockState = createMockState();
			(redis.hgetall as jest.Mock).mockResolvedValue(mockState);

			const tracker = await IntegrationsCompletionTracker.forBusiness(mockBusinessId);
			await tracker.cleanupTracking();

			expect(redis.delete).toHaveBeenCalledWith(expect.stringContaining(mockBusinessId));
			expect(logger.debug).toHaveBeenCalledWith(
				expect.objectContaining({
					businessID: mockBusinessId,
					message: "Cleaned up all integrations completion tracking"
				})
			);
		});
	});

	describe("getRedisKeyPattern", () => {
		it("should return the Redis key prefix", () => {
			const pattern = IntegrationsCompletionTracker.getRedisKeyPattern();
			expect(pattern).toBe("{integration_completion}:all_integrations_completion:");
		});
	});

	describe("edge cases", () => {
		it("should handle null customer_id", async () => {
			const taskWithoutCustomer = { ...mockTask, customer_id: undefined };
			const requirements = {
				[INTEGRATION_CATEGORIES.PUBLIC_RECORDS]: ["verdata:fetch_public_records" as TaskType]
			};

			await IntegrationsCompletionTracker.initializeTracking(taskWithoutCustomer, requirements);

			expect(redis.hset).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({
					customer_id: null
				})
			);
		});

		it("should handle null case_id", async () => {
			const taskWithoutCase = { ...mockTask, case_id: undefined };
			const requirements = {
				[INTEGRATION_CATEGORIES.PUBLIC_RECORDS]: ["verdata:fetch_public_records" as TaskType]
			};

			await IntegrationsCompletionTracker.initializeTracking(taskWithoutCase, requirements);

			expect(redis.hset).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({
					case_id: null
				})
			);
		});

		it("should handle empty requirements", async () => {
			const requirements = {};

			await IntegrationsCompletionTracker.initializeTracking(mockTask, requirements);

			expect(redis.hset).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({
					tasks_required: 0,
					required_tasks: []
				})
			);
		});
	});

	describe("mergeAndInitializeTracking", () => {
		const newRequirements = {
			[INTEGRATION_CATEGORIES.PUBLIC_RECORDS]: ["middesk:fetch_business_entity_verification" as TaskType]
		};

		it("should initialize normally when no existing tracker is found", async () => {
			/** Arrange — forBusiness throws (no existing tracker) */
			(redis.hgetall as jest.Mock).mockResolvedValue(null);

			/** Act */
			await IntegrationsCompletionTracker.mergeAndInitializeTracking(mockTask, newRequirements);

			/** Assert — should call initializeTracking with original requirements */
			expect(redis.hset).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({
					required_tasks: ["middesk:fetch_business_entity_verification"]
				})
			);
			/** Assert — should send reset event */
			expect(producer.send).toHaveBeenCalled();
		});

		it("should merge in-flight tasks from an existing tracker", async () => {
			/** Arrange — existing tracker has 2 required tasks, 1 completed */
			const existingState = createMockState({
				required_tasks: ["verdata:fetch_public_records", "equifax:fetch_public_records"] as TaskType[],
				required_tasks_by_category: {
					[INTEGRATION_CATEGORIES.PUBLIC_RECORDS]: [
						"verdata:fetch_public_records",
						"equifax:fetch_public_records"
					] as TaskType[]
				},
				completed_tasks: ["verdata:fetch_public_records"] as TaskType[],
				timed_out_tasks: [],
				tasks_completed: 1,
				tasks_required: 2
			});

			/** First hgetall returns existing state (for forBusiness), second returns null (for initializeTracking internals) */
			(redis.hgetall as jest.Mock)
				.mockResolvedValueOnce(existingState)
				.mockResolvedValue(null);

			/** Act */
			await IntegrationsCompletionTracker.mergeAndInitializeTracking(mockTask, newRequirements);

			/** Assert — merged required tasks should include in-flight equifax + new middesk */
			expect(redis.hset).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({
					required_tasks: expect.arrayContaining([
						"equifax:fetch_public_records",
						"middesk:fetch_business_entity_verification"
					])
				})
			);
		});

		it("should not carry forward completed or timed out tasks", async () => {
			/** Arrange — all tasks either completed or timed out */
			const existingState = createMockState({
				required_tasks: ["verdata:fetch_public_records", "equifax:fetch_public_records"] as TaskType[],
				completed_tasks: ["verdata:fetch_public_records"] as TaskType[],
				timed_out_tasks: ["equifax:fetch_public_records"] as TaskType[]
			});

			(redis.hgetall as jest.Mock)
				.mockResolvedValueOnce(existingState)
				.mockResolvedValue(null);

			/** Act */
			await IntegrationsCompletionTracker.mergeAndInitializeTracking(mockTask, newRequirements);

			/** Assert — only new requirements, no carry-forward */
			expect(redis.hset).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({
					required_tasks: ["middesk:fetch_business_entity_verification"]
				})
			);
		});

		it("should deduplicate when rerun task overlaps with in-flight task", async () => {
			/** Arrange — existing tracker has equifax in-flight, rerun also requests equifax */
			const existingState = createMockState({
				required_tasks: ["equifax:fetch_public_records"] as TaskType[],
				completed_tasks: [],
				timed_out_tasks: []
			});

			(redis.hgetall as jest.Mock)
				.mockResolvedValueOnce(existingState)
				.mockResolvedValue(null);

			const overlappingRequirements = {
				[INTEGRATION_CATEGORIES.PUBLIC_RECORDS]: ["equifax:fetch_public_records" as TaskType]
			};

			/** Act */
			await IntegrationsCompletionTracker.mergeAndInitializeTracking(mockTask, overlappingRequirements);

			/** Assert — should not have duplicates */
			expect(redis.hset).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({
					required_tasks: ["equifax:fetch_public_records"],
					tasks_required: 1
				})
			);
		});

		it("should emit a reset event after initialization", async () => {
			/** Arrange */
			(redis.hgetall as jest.Mock).mockResolvedValue(null);

			/** Act */
			await IntegrationsCompletionTracker.mergeAndInitializeTracking(mockTask, newRequirements);

			/** Assert */
			expect(producer.send).toHaveBeenCalledWith(
				expect.objectContaining({
					messages: expect.arrayContaining([
						expect.objectContaining({
							value: expect.objectContaining({
								action: "rerun_started",
								category_name: "all"
							})
						})
					])
				})
			);
		});
	});
});

