import { defaultAdapterProcessFunction } from "../defaultAdapterProcessFunction";
import { logger } from "#helpers/logger";
import { db } from "#helpers/knex";
import type { TaskManager } from "#api/v1/modules/tasks/taskManager";
import type { IntegrationProcessFunctionParams } from "../../types";
import { INTEGRATION_ID } from "#constants";

jest.mock("#helpers/logger", () => ({
	logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }
}));
jest.mock("#helpers/knex", () => ({
	db: { raw: jest.fn() }
}));

/** Mock constants */
const mockLoggerInfo = logger.info as jest.MockedFunction<typeof logger.info>;
const mockDbRaw = db.raw as jest.MockedFunction<typeof db.raw>;

describe("defaultAdapterProcessFunction", () => {
	/** Factory function for creating mock platform */
	const createMockPlatform = (overrides: Partial<TaskManager> = {}): TaskManager =>
		({
			getOrCreateTaskForCode: jest.fn(),
			processTask: jest.fn(),
			getTasksForCode: jest.fn(),
			...overrides
		}) as unknown as TaskManager;

	/** Factory function for creating function params */
	const createParams = (
		overrides: Partial<IntegrationProcessFunctionParams> = {}
	): IntegrationProcessFunctionParams => ({
		platform: createMockPlatform(),
		platform_id: INTEGRATION_ID.SERP_GOOGLE_PROFILE,
		platform_code: "serp_google_profile",
		connection_id: "conn-123",
		business_id: "business-456",
		task_code: "fetch_business_profile",
		metadata: { name: "Test Business", address: "123 Main St" },
		...overrides
	});

	beforeEach(() => {
		jest.clearAllMocks();
		mockDbRaw.mockReturnValue("mock-db-raw" as any);
	});

	describe("successful task creation and processing", () => {
		it("should create task, process it, and return task ID", async () => {
			/** Arrange */
			const taskId = "task-789";
			const mockPlatform = createMockPlatform({
				getOrCreateTaskForCode: jest.fn().mockResolvedValue(taskId),
				processTask: jest.fn().mockResolvedValue(undefined)
			});
			const params = createParams({ platform: mockPlatform });

			/** Act */
			const result = await defaultAdapterProcessFunction(params);

			/** Assert */
			expect(result).toEqual([taskId]);
			expect(mockPlatform.getOrCreateTaskForCode).toHaveBeenCalledWith({
				taskCode: params.task_code,
				metadata: params.metadata,
				reference_id: undefined,
				conditions: ["mock-db-raw"]
			});
			expect(mockPlatform.processTask).toHaveBeenCalledWith({ taskId });
			expect(mockLoggerInfo).toHaveBeenCalledWith(expect.stringContaining(`Successfully ran task ${params.task_code}`));
		});

		it("should include metadata condition using db.raw", async () => {
			/** Arrange */
			const mockPlatform = createMockPlatform({
				getOrCreateTaskForCode: jest.fn().mockResolvedValue("task-123"),
				processTask: jest.fn().mockResolvedValue(undefined)
			});
			const metadata = { name: "Test", address: "123 St" };
			const params = createParams({ platform: mockPlatform, metadata });

			/** Act */
			await defaultAdapterProcessFunction(params);

			/** Assert */
			expect(mockDbRaw).toHaveBeenCalledWith("metadata::text = ?", [JSON.stringify(metadata)]);
		});
	});

	describe("metadata validation", () => {
		it.each([
			{ metadata: undefined, description: "undefined" },
			{ metadata: null, description: "null" },
			{ metadata: {}, description: "empty object" },
			{ metadata: [], description: "empty array" }
		])("should throw error when metadata is $description", async ({ metadata }) => {
			/** Arrange */
			const params = createParams({ metadata: metadata as any });

			/** Act & Assert */
			await expect(defaultAdapterProcessFunction(params)).rejects.toThrow(
				`No metadata provided for ${params.platform_code} - ${params.task_code}`
			);
		});
	});

	describe("task creation failures", () => {
		it("should throw error when getOrCreateTaskForCode returns null or undefined", async () => {
			/** Arrange */
			const mockPlatform = createMockPlatform({
				getOrCreateTaskForCode: jest.fn().mockResolvedValue(null)
			});
			const params = createParams({ platform: mockPlatform });

			/** Act & Assert */
			await expect(defaultAdapterProcessFunction(params)).rejects.toThrow(
				`Could not get or create task for ${params.platform_code} - ${params.task_code}`
			);
		});

		it("should not call processTask when task creation fails", async () => {
			/** Arrange */
			const mockPlatform = createMockPlatform({
				getOrCreateTaskForCode: jest.fn().mockResolvedValue(null),
				processTask: jest.fn()
			});
			const params = createParams({ platform: mockPlatform });

			/** Act & Assert */
			await expect(defaultAdapterProcessFunction(params)).rejects.toThrow();
			expect(mockPlatform.processTask).not.toHaveBeenCalled();
		});
	});

	describe("task processing failures", () => {
		it("should log error when processTask fails", async () => {
			/** Arrange */
			const error = new Error("Task processing failed");
			const mockPlatform = createMockPlatform({
				getOrCreateTaskForCode: jest.fn().mockResolvedValue("task-123"),
				processTask: jest.fn().mockRejectedValue(error)
			});
			const params = createParams({ platform: mockPlatform });

			/** Act */
			await defaultAdapterProcessFunction(params);

			/** The actual processTask call is not awaited, so we have to wait for it to be called */
			await new Promise(resolve => setTimeout(resolve, 1));

			/** Assert */
			expect(logger.error).toHaveBeenCalledWith({error}, expect.stringContaining(`Error processing task ${params.task_code} for platform ${params.platform_code}`));
		});
	});

	describe("different metadata types", () => {
		it.each([
			{ metadata: { name: "Test" }, description: "simple object" },
			{ metadata: { names: ["Name1", "Name2"], nested: { field: "value" } }, description: "nested object" },
			{ metadata: { array: [1, 2, 3], boolean: true, number: 42 }, description: "mixed types" }
		])("should handle metadata with $description", async ({ metadata }) => {
			/** Arrange */
			const mockPlatform = createMockPlatform({
				getOrCreateTaskForCode: jest.fn().mockResolvedValue("task-123"),
				processTask: jest.fn().mockResolvedValue(undefined)
			});
			const params = createParams({ platform: mockPlatform, metadata });

			/** Act */
			const result = await defaultAdapterProcessFunction(params);

			/** Assert */
			expect(result).toEqual(["task-123"]);
			expect(mockPlatform.getOrCreateTaskForCode).toHaveBeenCalledWith(expect.objectContaining({ metadata }));
		});
	});
});
