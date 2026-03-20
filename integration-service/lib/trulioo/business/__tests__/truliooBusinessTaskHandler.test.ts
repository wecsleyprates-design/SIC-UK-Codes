import { TruliooBusinessTaskHandler } from "../truliooBusinessTaskHandler";
import { TruliooBase } from "../../common/truliooBase";
import { ITruliooBusinessKYBProcessor } from "../types";
import { TaskManager } from "#api/v1/modules/tasks/taskManager";
import { getBusinessDetails } from "#helpers";
import { UUID } from "crypto";

// Mock dependencies
jest.mock("#helpers/logger", () => ({
	logger: {
		error: jest.fn(),
		warn: jest.fn(),
		info: jest.fn(),
		debug: jest.fn()
	}
}));

jest.mock("#helpers", () => ({
	getBusinessDetails: jest.fn()
}));

jest.mock("../../common/truliooBase");

jest.mock("#api/v1/modules/tasks/taskManager");

const mockGetBusinessDetails = getBusinessDetails as jest.MockedFunction<typeof getBusinessDetails>;

describe("TruliooBusinessTaskHandler", () => {
	let taskHandler: TruliooBusinessTaskHandler;
	let mockTruliooBase: jest.Mocked<TruliooBase>;
	let mockKYBProcessor: jest.Mocked<ITruliooBusinessKYBProcessor>;
	let mockUpdateTask: jest.Mock;

	beforeEach(() => {
		jest.clearAllMocks();

		// Create mocks
		mockTruliooBase = {
			businessID: "test-business-123",
			getBusinessId: jest.fn().mockReturnValue("test-business-123")
		} as any;

		mockKYBProcessor = {
			processKYBFlow: jest.fn()
		};

		// Clear getBusinessDetails mock - will be set up in individual tests
		mockGetBusinessDetails.mockClear();

		mockUpdateTask = jest.fn().mockResolvedValue({});

		TaskManager.getEnrichedTask = jest.fn().mockResolvedValue({
			metadata: {}
		});

		// Create task handler instance
		taskHandler = new TruliooBusinessTaskHandler(mockTruliooBase, mockKYBProcessor);
	});

	describe("Task Handler Creation", () => {
		it("should create task handler with correct dependencies", () => {
			expect(taskHandler).toBeInstanceOf(TruliooBusinessTaskHandler);
			expect(mockTruliooBase).toBeDefined();
			expect(mockKYBProcessor).toBeDefined();
		});

		it("should create task handler map with correct structure", () => {
			const handlerMap = taskHandler.createTaskHandlerMap(mockUpdateTask);

			expect(handlerMap).toHaveProperty("fetch_business_entity_verification");
			expect(typeof handlerMap.fetch_business_entity_verification).toBe("function");
		});
	});

	describe("Business Entity Verification Handler", () => {
		it("should handle successful business verification task", async () => {
			const mockTask = {
				id: "task-123",
				business_id: "test-business-123",
				connection_id: "connection-123",
				platform_id: 38,
				task_code: "fetch_business_entity_verification",
				task_status: "CREATED",
				metadata: {}
			};

			const mockBusinessData = {
				name: "Test Company Ltd",
				business_addresses: [
					{
						addressLine1: "123 Test Street",
						city: "London",
						postalCode: "SW1A 1AA",
						country: "GB"
					}
				]
			};

			// Mock successful business details fetch
			const { getBusinessDetails } = require("#helpers");
			getBusinessDetails.mockResolvedValue({ data: mockBusinessData });

			// Mock successful KYB processing
			mockKYBProcessor.processKYBFlow.mockResolvedValue(undefined);

			const handlerMap = taskHandler.createTaskHandlerMap(mockUpdateTask);
			const handler = handlerMap.fetch_business_entity_verification;

			if (handler) {
				await handler(mockTask.id as any);
			}

			expect(getBusinessDetails).toHaveBeenCalledWith("test-business-123");
			expect(mockKYBProcessor.processKYBFlow).toHaveBeenCalledWith(mockTask.id, mockBusinessData);
			expect(mockUpdateTask).toHaveBeenCalledWith(mockTask.id, {
				metadata: expect.objectContaining({
					businessId: "test-business-123",
					flowType: "KYB",
					status: "completed"
				})
			});
		});

		it("should handle business verification task with missing business data", async () => {
			const mockTask = {
				id: "task-123",
				business_id: "test-business-123",
				connection_id: "connection-123",
				platform_id: 38,
				task_code: "fetch_business_entity_verification",
				task_status: "CREATED",
				metadata: {}
			};

			// Mock business details fetch returning null
			const { getBusinessDetails } = require("#helpers");
			getBusinessDetails.mockResolvedValue(null);

			const handlerMap = taskHandler.createTaskHandlerMap(mockUpdateTask);
			const handler = handlerMap.fetch_business_entity_verification;

			if (handler) {
				await handler(mockTask.id as any);
			}

			expect(getBusinessDetails).toHaveBeenCalledWith("test-business-123");
			expect(mockUpdateTask).toHaveBeenCalledWith(mockTask.id, {
				metadata: {
					status: "❌ Business with id test-business-123 could not be found in Trulioo integration process"
				}
			});
		});

		it("should handle business verification task with KYB processing failure", async () => {
			const mockTask = {
				id: "task-123",
				business_id: "test-business-123",
				connection_id: "connection-123",
				platform_id: 38,
				task_code: "fetch_business_entity_verification",
				task_status: "CREATED",
				metadata: {}
			};

			const mockBusinessData = {
				name: "Test Company Ltd",
				business_addresses: [
					{
						addressLine1: "123 Test Street",
						city: "London",
						postalCode: "SW1A 1AA",
						country: "GB"
					}
				]
			};

			// Mock successful business details fetch
			const { getBusinessDetails } = require("#helpers");
			getBusinessDetails.mockResolvedValue({ data: mockBusinessData });

			// Mock KYB processing failure
			mockKYBProcessor.processKYBFlow.mockRejectedValue(new Error("KYB processing failed"));

			const handlerMap = taskHandler.createTaskHandlerMap(mockUpdateTask);
			const handler = handlerMap.fetch_business_entity_verification;

			if (handler) {
				await handler(mockTask.id as any);
			}

			expect(getBusinessDetails).toHaveBeenCalledWith("test-business-123");
			expect(mockKYBProcessor.processKYBFlow).toHaveBeenCalledWith(mockTask.id, mockBusinessData);
			expect(mockUpdateTask).toHaveBeenCalledWith(mockTask.id, {
				metadata: expect.objectContaining({
					error: "Trulioo KYB flow failed: KYB processing failed",
					status: "failed"
				})
			});
		});

		it("should handle business verification task with case service error", async () => {
			const mockTask = {
				id: "task-123",
				business_id: "test-business-123",
				connection_id: "connection-123",
				platform_id: 38,
				task_code: "fetch_business_entity_verification",
				task_status: "CREATED",
				metadata: {}
			};

			// Mock case service error
			const { getBusinessDetails } = require("#helpers");
			getBusinessDetails.mockImplementation(() => Promise.reject(new Error("Case service unavailable")));

			// Mock successful KYB processing (even though it won't be called)
			mockKYBProcessor.processKYBFlow.mockResolvedValue();

			const handlerMap = taskHandler.createTaskHandlerMap(mockUpdateTask);
			const handler = handlerMap.fetch_business_entity_verification;

			if (handler) {
				await expect(handler(mockTask.id as any)).rejects.toThrow("Case service unavailable");
			}

			expect(getBusinessDetails).toHaveBeenCalledWith("test-business-123");
			// The handler doesn't catch getBusinessDetails errors, so updateTask won't be called
			expect(mockUpdateTask).not.toHaveBeenCalled();
		});

		it("should not call getBusinessDetails and should use the task metadata if it already has the business data", async () => {
			/** Arrange */
			const metadata = {
				name: "Test Company Ltd",
				business_addresses: [
					{
						addressLine1: "123 Test Street",
						city: "London",
						postalCode: "SW1A 1AA",
						country: "GB"
					}
				]
			};

			const task = {
				id: "task-123" as UUID,
				business_id: "test-business-123",
				connection_id: "connection-123",
				platform_id: 38,
				task_code: "fetch_business_entity_verification",
				task_status: "CREATED",
				metadata: metadata
			};

			TaskManager.getEnrichedTask = jest.fn().mockResolvedValueOnce(task);

			// Mock successful KYB processing
			mockKYBProcessor.processKYBFlow.mockResolvedValue(undefined);

			/** Act */
			const handlerMap = taskHandler.createTaskHandlerMap(mockUpdateTask);
			const handler = handlerMap.fetch_business_entity_verification;
			await handler!(task.id);

			/** Assert */
			expect(getBusinessDetails).not.toHaveBeenCalled();
			expect(mockKYBProcessor.processKYBFlow).toHaveBeenCalledWith(task.id, task.metadata);
		});
	});

	describe("Error Handling", () => {
		it("should handle unexpected errors gracefully", async () => {
			const mockTask = {
				id: "task-123",
				business_id: "test-business-123",
				connection_id: "connection-123",
				platform_id: 38,
				task_code: "fetch_business_entity_verification",
				task_status: "CREATED",
				metadata: {}
			};

			// Mock unexpected error
			const { getBusinessDetails } = require("#helpers");
			getBusinessDetails.mockImplementation(() => Promise.reject(new Error("Unexpected error")));

			// Mock successful KYB processing (even though it won't be called)
			mockKYBProcessor.processKYBFlow.mockResolvedValue();

			const handlerMap = taskHandler.createTaskHandlerMap(mockUpdateTask);
			const handler = handlerMap.fetch_business_entity_verification;

			if (handler) {
				await expect(handler(mockTask.id as any)).rejects.toThrow("Unexpected error");
			}

			// The handler doesn't catch getBusinessDetails errors, so updateTask won't be called
			expect(mockUpdateTask).not.toHaveBeenCalled();
		});

		it("should handle task update failures gracefully", async () => {
			const mockTask = {
				id: "task-123",
				business_id: "test-business-123",
				connection_id: "connection-123",
				platform_id: 38,
				task_code: "fetch_business_entity_verification",
				task_status: "CREATED",
				metadata: {}
			};

			const mockBusinessData = {
				name: "Test Company Ltd",
				business_addresses: [
					{
						addressLine1: "123 Test Street",
						city: "London",
						postalCode: "SW1A 1AA",
						country: "GB"
					}
				]
			};

			// Mock successful business details fetch
			const { getBusinessDetails } = require("#helpers");
			getBusinessDetails.mockResolvedValue({ data: mockBusinessData });

			// Mock successful KYB processing
			mockKYBProcessor.processKYBFlow.mockResolvedValue(undefined);

			// Mock task update failure
			mockUpdateTask.mockRejectedValue(new Error("Task update failed"));

			const handlerMap = taskHandler.createTaskHandlerMap(mockUpdateTask);
			const handler = handlerMap.fetch_business_entity_verification;

			// Should throw error if task update fails
			if (handler) {
				await expect(handler(mockTask.id as any)).rejects.toThrow("Task update failed");
			}

			expect(mockUpdateTask).toHaveBeenCalledWith(mockTask.id, {
				metadata: expect.objectContaining({
					businessId: "test-business-123",
					flowType: "KYB",
					status: "completed"
				})
			});
		});
	});

	describe("Task Handler Map Structure", () => {
		it("should create handler map with correct task codes", () => {
			const handlerMap = taskHandler.createTaskHandlerMap(mockUpdateTask);

			expect(handlerMap).toHaveProperty("fetch_business_entity_verification");
			expect(Object.keys(handlerMap)).toContain("fetch_business_entity_verification");
		});

		it("should create handlers that accept correct parameters", async () => {
			const handlerMap = taskHandler.createTaskHandlerMap(mockUpdateTask);
			const handler = handlerMap.fetch_business_entity_verification;

			// Mock successful flow
			const { getBusinessDetails } = require("#helpers");
			getBusinessDetails.mockResolvedValue({ data: { name: "Test Company" } });
			mockKYBProcessor.processKYBFlow.mockResolvedValue(undefined);

			// Should accept taskId and data parameters
			if (handler) {
				await expect(handler("task-123" as any)).resolves.not.toThrow();
			}
		});
	});
});
