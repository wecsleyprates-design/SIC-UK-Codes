import { processTasksForConnection } from "../processTasksForConnection";
import { getOrCreateConnection, platformFactory } from "#helpers/platformHelper";
import { getTaskCodesToRun } from "../getTaskCodesToRun";
import { canExecuteConnection } from "../canExecuteConnection";
import { CONNECTION_STATUS, INTEGRATION_ID } from "#constants";
import type { ConnectionWithTasks } from "../getConnectionsAndTasks";
import type { TaskManager } from "#api/v1/modules/tasks/taskManager";
import * as adapterModule from "../../adapters/getAdapter";
import type { IntegrationFactAdapter } from "../../adapters/types";

jest.mock("#helpers/platformHelper");
jest.mock("../getTaskCodesToRun");
jest.mock("../canExecuteConnection");
jest.mock("../../adapters/getAdapter");
jest.mock("#helpers/logger", () => ({
	logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }
}));

const mockGetOrCreateConnection = getOrCreateConnection as jest.MockedFunction<typeof getOrCreateConnection>;
const mockPlatformFactory = platformFactory as jest.MockedFunction<typeof platformFactory>;
const mockGetTaskCodesToRun = getTaskCodesToRun as jest.MockedFunction<typeof getTaskCodesToRun>;
const mockCanExecuteConnection = canExecuteConnection as jest.MockedFunction<typeof canExecuteConnection>;
const mockGetAdapter = adapterModule.getAdapter as jest.MockedFunction<typeof adapterModule.getAdapter>;

describe("processTasksForConnection", () => {
	const businessID = "test-business-id";
	const createMockConnection = (overrides = {}): ConnectionWithTasks => ({
		connection_id: "conn-1",
		platform_id: INTEGRATION_ID.SERP_GOOGLE_PROFILE,
		platform_code: "serp_google_profile",
		task_codes: ["task1", "task2"],
		...overrides
	});

	const createMockDbConnection = (overrides = {}) => ({
		id: "conn-1",
		business_id: businessID,
		platform_id: INTEGRATION_ID.SERP_GOOGLE_PROFILE,
		connection_status: CONNECTION_STATUS.SUCCESS,
		...overrides
	});

	const createMockAdapter = (overrides: Partial<IntegrationFactAdapter> = {}): IntegrationFactAdapter => ({
		process: jest.fn(),
		getMetadata: jest.fn(),
		checkRunnable: jest.fn().mockResolvedValue(true),
		...overrides
	});

	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe("when connection cannot be retrieved", () => {
		it("should return error when getOrCreateConnection returns null", async () => {
			/** Arrange */
			const conn = createMockConnection();
			mockGetOrCreateConnection.mockResolvedValue(null as any);

			/** Act */
			const result = await processTasksForConnection(businessID, conn);

			/** Assert */
			expect(result.tasksCreated).toHaveLength(0);
			expect(result.errors).toHaveLength(1);
			expect(result.errors[0]).toEqual({
				connection_id: conn.connection_id,
				platform_code: conn.platform_code,
				error: `Could not get or create business ${businessID} - connection ${conn.connection_id}`
			});
		});
	});

	describe("when connection status does not allow execution", () => {
		it("should return error when canExecuteConnection returns false", async () => {
			/** Arrange */
			const conn = createMockConnection();
			const dbConnection = createMockDbConnection({ connection_status: CONNECTION_STATUS.FAILED });
			mockGetOrCreateConnection.mockResolvedValue(dbConnection as any);
			mockCanExecuteConnection.mockReturnValue(false);

			/** Act */
			const result = await processTasksForConnection(businessID, conn);

			/** Assert */
			expect(result.tasksCreated).toHaveLength(0);
			expect(result.errors).toHaveLength(1);
			expect(result.errors[0].error).toContain("does not allow execution");
		});
	});

	describe("when no task codes are available", () => {
		it("should return error when no task codes are found", async () => {
			/** Arrange */
			const conn = createMockConnection({ task_codes: [] });
			const dbConnection = createMockDbConnection();
			mockGetOrCreateConnection.mockResolvedValue(dbConnection as any);
			mockCanExecuteConnection.mockReturnValue(true);
			mockGetTaskCodesToRun.mockResolvedValue([]);

			/** Act */
			const result = await processTasksForConnection(businessID, conn);

			/** Assert */
			expect(result.tasksCreated).toHaveLength(0);
			expect(result.errors).toHaveLength(1);
			expect(result.errors[0].error).toContain("No task codes available");
		});

		it("should return error with requested codes when no matching task codes found", async () => {
			/** Arrange */
			const conn = createMockConnection({ task_codes: ["task1"] });
			const dbConnection = createMockDbConnection();
			mockGetOrCreateConnection.mockResolvedValue(dbConnection as any);
			mockCanExecuteConnection.mockReturnValue(true);
			mockGetTaskCodesToRun.mockResolvedValue([]);

			/** Act */
			const result = await processTasksForConnection(businessID, conn, ["task2"]);

			/** Assert */
			expect(result.tasksCreated).toHaveLength(0);
			expect(result.errors).toHaveLength(1);
			expect(result.errors[0].error).toContain("No matching task codes found");
			expect(result.errors[0].error).toContain("task2");
		});
	});

	describe("when processing tasks", () => {
		it("should process tasks successfully", async () => {
			/** Arrange */
			const conn = createMockConnection();
			const dbConnection = createMockDbConnection();
			const mockPlatform = {} as TaskManager;
			const mockAdapter = createMockAdapter();
			const mockMetadata = { name: "test", address: "123 Main St" };
			(mockAdapter.getMetadata as jest.Mock).mockResolvedValue(mockMetadata);
			(mockAdapter.process as jest.Mock).mockResolvedValue(["task-id-1"]);

			mockGetOrCreateConnection.mockResolvedValue(dbConnection as any);
			mockCanExecuteConnection.mockReturnValue(true);
			mockGetTaskCodesToRun.mockResolvedValue(["task1"]);
			mockPlatformFactory.mockReturnValue(mockPlatform);
			mockGetAdapter.mockReturnValue(mockAdapter);

			/** Act */
			const result = await processTasksForConnection(businessID, conn);

			/** Assert */
			expect(result.tasksCreated).toHaveLength(1);
			expect(result.tasksCreated[0]).toEqual({
				connection_id: conn.connection_id,
				platform_code: conn.platform_code,
				task_code: "task1",
				task_id: "task-id-1"
			});
			expect(result.errors).toHaveLength(0);
			expect(mockAdapter.getMetadata).toHaveBeenCalledWith(businessID);
			expect(mockAdapter.process).toHaveBeenCalledWith({
				platform: mockPlatform,
				task_code: "task1",
				connection_id: conn.connection_id,
				platform_code: conn.platform_code,
				platform_id: conn.platform_id,
				business_id: businessID,
				scoreTriggerId: undefined,
				metadata: mockMetadata
			});
		});

		it("should pass scoreTriggerId to adapter.process when provided", async () => {
			/** Arrange */
			const conn = createMockConnection();
			const dbConnection = createMockDbConnection();
			const mockPlatform = {} as TaskManager;
			const mockAdapter = createMockAdapter();
			const mockMetadata = { name: "test" };
			const scoreTriggerId = "00000000-0000-0000-0000-000000000001";
			(mockAdapter.getMetadata as jest.Mock).mockResolvedValue(mockMetadata);
			(mockAdapter.process as jest.Mock).mockResolvedValue(["task-id-1"]);

			mockGetOrCreateConnection.mockResolvedValue(dbConnection as any);
			mockCanExecuteConnection.mockReturnValue(true);
			mockGetTaskCodesToRun.mockResolvedValue(["task1"]);
			mockPlatformFactory.mockReturnValue(mockPlatform);
			mockGetAdapter.mockReturnValue(mockAdapter);

			/** Act */
			await processTasksForConnection(businessID, conn, undefined, undefined, scoreTriggerId);

			/** Assert */
			expect(mockAdapter.process).toHaveBeenCalledWith(
				expect.objectContaining({ scoreTriggerId })
			);
		});

		it("should handle task processing errors", async () => {
			/** Arrange */
			const conn = createMockConnection();
			const dbConnection = createMockDbConnection();
			const mockPlatform = {} as TaskManager;
			const mockAdapter = createMockAdapter();
			const mockMetadata = { name: "test", address: "123 Main St" };
			(mockAdapter.getMetadata as jest.Mock).mockResolvedValue(mockMetadata);
			(mockAdapter.process as jest.Mock).mockRejectedValue(new Error("Task processing failed"));

			mockGetOrCreateConnection.mockResolvedValue(dbConnection as any);
			mockCanExecuteConnection.mockReturnValue(true);
			mockGetTaskCodesToRun.mockResolvedValue(["task1"]);
			mockPlatformFactory.mockReturnValue(mockPlatform);
			mockGetAdapter.mockReturnValue(mockAdapter);

			/** Act */
			const result = await processTasksForConnection(businessID, conn);

			/** Assert */
			expect(result.tasksCreated).toHaveLength(0);
			expect(result.errors).toHaveLength(1);
			expect(result.errors[0]).toEqual({
				connection_id: conn.connection_id,
				platform_code: conn.platform_code,
				error: "Task processing failed"
			});
		});

		it("should process multiple tasks", async () => {
			/** Arrange */
			const conn = createMockConnection();
			const dbConnection = createMockDbConnection();
			const mockPlatform = {} as TaskManager;
			const mockAdapter = createMockAdapter();
			const mockMetadata = { name: "test", address: "123 Main St" };
			(mockAdapter.getMetadata as jest.Mock).mockResolvedValue(mockMetadata);
			(mockAdapter.process as jest.Mock)
				.mockResolvedValueOnce(["task-id-1"])
				.mockRejectedValueOnce(new Error("Task 2 failed"));

			mockGetOrCreateConnection.mockResolvedValue(dbConnection as any);
			mockCanExecuteConnection.mockReturnValue(true);
			mockGetTaskCodesToRun.mockResolvedValue(["task1", "task2"]);
			mockPlatformFactory.mockReturnValue(mockPlatform);
			mockGetAdapter.mockReturnValue(mockAdapter);

			/** Act */
			const result = await processTasksForConnection(businessID, conn);

			/** Assert */
			expect(result.tasksCreated).toHaveLength(1);
			expect(result.errors).toHaveLength(1);
			expect(mockAdapter.process).toHaveBeenCalledTimes(2);
		});

		it("should pass metadata to adapter process", async () => {
			/** Arrange */
			const conn = createMockConnection();
			const dbConnection = createMockDbConnection();
			const mockPlatform = {} as TaskManager;
			const metadata = { key: "value" };
			const mockAdapter = createMockAdapter();
			(mockAdapter.process as jest.Mock).mockResolvedValue("task-id-1");

			mockGetOrCreateConnection.mockResolvedValue(dbConnection as any);
			mockCanExecuteConnection.mockReturnValue(true);
			mockGetTaskCodesToRun.mockResolvedValue(["task1"]);
			mockPlatformFactory.mockReturnValue(mockPlatform);
			mockGetAdapter.mockReturnValue(mockAdapter);

			/** Act */
			await processTasksForConnection(businessID, conn, undefined, metadata);

			/** Assert */
			expect(mockAdapter.getMetadata).not.toHaveBeenCalled();
			expect(mockAdapter.process).toHaveBeenCalledWith({
				platform: mockPlatform,
				task_code: "task1",
				connection_id: conn.connection_id,
				platform_code: conn.platform_code,
				platform_id: conn.platform_id,
				business_id: businessID,
				scoreTriggerId: undefined,
				metadata
			});
		});

		it("should pass requestedTaskCodes to getTaskCodesToRun", async () => {
			/** Arrange */
			const conn = createMockConnection();
			const dbConnection = createMockDbConnection();
			const mockPlatform = {} as TaskManager;
			const mockAdapter = createMockAdapter();
			const mockMetadata = { name: "test", address: "123 Main St" };
			(mockAdapter.getMetadata as jest.Mock).mockResolvedValue(mockMetadata);
			(mockAdapter.process as jest.Mock).mockResolvedValue("task-id-1");

			mockGetOrCreateConnection.mockResolvedValue(dbConnection as any);
			mockCanExecuteConnection.mockReturnValue(true);
			mockGetTaskCodesToRun.mockResolvedValue(["task1"]);
			mockPlatformFactory.mockReturnValue(mockPlatform);
			mockGetAdapter.mockReturnValue(mockAdapter);

			/** Act */
			await processTasksForConnection(businessID, conn, ["task1", "task2"]);

			/** Assert */
			expect(mockGetTaskCodesToRun).toHaveBeenCalledWith({
				connectionTaskCodes: conn.task_codes,
				platformId: conn.platform_id,
				requestedTaskCodes: ["task1", "task2"]
			});
		});

		it("should handle when no adapter is found", async () => {
			/** Arrange */
			const conn = createMockConnection();
			const dbConnection = createMockDbConnection();
			const mockPlatform = {} as TaskManager;

			mockGetOrCreateConnection.mockResolvedValue(dbConnection as any);
			mockCanExecuteConnection.mockReturnValue(true);
			mockGetTaskCodesToRun.mockResolvedValue(["task1"]);
			mockPlatformFactory.mockReturnValue(mockPlatform);
			mockGetAdapter.mockReturnValue(undefined);

			/** Act */
			const result = await processTasksForConnection(businessID, conn);

			/** Assert */
			expect(result.tasksCreated).toHaveLength(0);
			expect(result.errors).toHaveLength(1);
			expect(result.errors[0]).toEqual({
				connection_id: conn.connection_id,
				platform_code: conn.platform_code,
				error: `No adapter found for business ${businessID} - platform ${conn.platform_code} (${conn.platform_id})`
			});
		});

		it("should handle errors from getMetadata", async () => {
			/** Arrange */
			const conn = createMockConnection();
			const dbConnection = createMockDbConnection();
			const mockPlatform = {} as TaskManager;
			const mockAdapter = createMockAdapter();
			(mockAdapter.getMetadata as jest.Mock).mockRejectedValue(new Error("Metadata generation failed"));

			mockGetOrCreateConnection.mockResolvedValue(dbConnection as any);
			mockCanExecuteConnection.mockReturnValue(true);
			mockGetTaskCodesToRun.mockResolvedValue(["task1"]);
			mockPlatformFactory.mockReturnValue(mockPlatform);
			mockGetAdapter.mockReturnValue(mockAdapter);

			/** Act */
			const result = await processTasksForConnection(businessID, conn);

			/** Assert */
			expect(result.tasksCreated).toHaveLength(0);
			expect(result.errors).toHaveLength(1);
			expect(result.errors[0]).toEqual({
				connection_id: conn.connection_id,
				platform_code: conn.platform_code,
				error: "Metadata generation failed"
			});
		});

		it("should handle when getMetadata returns undefined", async () => {
			/** Arrange */
			const conn = createMockConnection();
			const dbConnection = createMockDbConnection();
			const mockPlatform = {} as TaskManager;
			const mockAdapter = createMockAdapter();
			(mockAdapter.getMetadata as jest.Mock).mockResolvedValue(undefined);

			mockGetOrCreateConnection.mockResolvedValue(dbConnection as any);
			mockCanExecuteConnection.mockReturnValue(true);
			mockGetTaskCodesToRun.mockResolvedValue(["task1"]);
			mockPlatformFactory.mockReturnValue(mockPlatform);
			mockGetAdapter.mockReturnValue(mockAdapter);

			/** Act */
			const result = await processTasksForConnection(businessID, conn);

			/** Assert */
			expect(result.tasksCreated).toHaveLength(0);
			expect(result.errors).toHaveLength(1);
			expect(result.errors[0].error).toContain("No metadata generated");
		});
	});

	describe("error handling", () => {
		it("should catch and handle errors from getOrCreateConnection", async () => {
			/** Arrange */
			const conn = createMockConnection();
			mockGetOrCreateConnection.mockRejectedValue(new Error("Database error"));

			/** Act */
			const result = await processTasksForConnection(businessID, conn);

			/** Assert */
			expect(result.tasksCreated).toHaveLength(0);
			expect(result.errors).toHaveLength(1);
			expect(result.errors[0].error).toBe("Database error");
		});

		it("should handle non-Error exceptions", async () => {
			/** Arrange */
			const conn = createMockConnection();
			mockGetOrCreateConnection.mockRejectedValue("String error");

			/** Act */
			const result = await processTasksForConnection(businessID, conn);

			/** Assert */
			expect(result.tasksCreated).toHaveLength(0);
			expect(result.errors).toHaveLength(1);
			expect(result.errors[0].error).toBe("Unknown error");
		});
	});
});
