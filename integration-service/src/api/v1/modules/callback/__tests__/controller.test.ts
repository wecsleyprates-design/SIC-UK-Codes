import { controller } from "../controller";
import { PlaidIdv } from "#lib/plaid/plaidIdv";
import { getConnectionByTaskId } from "#helpers/platformHelper";
import { strategyPlatformFactory } from "#helpers/strategyPlatformFactory";
import { envConfig } from "#configs";
import { logger } from "#helpers";
import type { Request } from "express";
import type { Response } from "#types/index";
import type { UUID } from "crypto";
import type { IdentityVerificationStatusUpdatedWebhook } from "plaid";

// Mock dependencies
jest.mock("#lib/plaid/plaidIdv");
jest.mock("#helpers/platformHelper");
jest.mock("#helpers/strategyPlatformFactory");
jest.mock("#helpers", () => ({
	logger: {
		info: jest.fn(),
		debug: jest.fn(),
		error: jest.fn()
	}
}));
jest.mock("#configs", () => ({
	envConfig: {
		PLAID_ENV: "production",
		PLAID_SANDBOX_ENV: "sandbox"
	}
}));

jest.mock("#utils/catchAsync", () => ({
	catchAsync: (fn: any) => fn
}));

describe("Callback Controller - handlePlaidIdv", () => {
	let mockRequest: Partial<Request>;
	let mockResponse: Partial<Response>;

	const mockPlaidIdv = PlaidIdv as jest.Mocked<typeof PlaidIdv>;
	const mockGetConnectionByTaskId = getConnectionByTaskId as jest.MockedFunction<typeof getConnectionByTaskId>;
	const mockStrategyPlatformFactory = strategyPlatformFactory as jest.MockedFunction<typeof strategyPlatformFactory>;
	const mockLogger = logger as jest.Mocked<typeof logger>;

	beforeEach(() => {
		mockRequest = {
			body: {
				webhook_type: "IDENTITY_VERIFICATION",
				webhook_code: "STATUS_UPDATED",
				identity_verification_id: "test_idv_123",
				environment: "sandbox"
			} as IdentityVerificationStatusUpdatedWebhook
		};

		mockResponse = {
			jsend: {
				success: jest.fn(),
				fail: jest.fn()
			},
			status: jest.fn().mockReturnThis(),
			json: jest.fn()
		} as any;

		jest.clearAllMocks();
	});

	describe("when no tasks are found for identity verification ID", () => {
		beforeEach(() => {
			mockPlaidIdv.getTasksForIdentityVerificationId.mockResolvedValue([]);
		});

		it("should return 200 with webhook received message", async () => {
			await controller.handlePlaidIdv(mockRequest as Request, mockResponse as Response);

			expect(mockResponse.status).toHaveBeenCalledWith(200);
			expect(mockResponse.json).toHaveBeenCalledWith({ message: "Webhook received" });
		});

		it("should log debug information when no tasks found", async () => {
			await controller.handlePlaidIdv(mockRequest as Request, mockResponse as Response);

			expect(mockLogger.info).toHaveBeenCalledWith(
				{
					identity_verification_id: "test_idv_123",
					webhook_environment: "sandbox",
					configured_production_environment: "production",
					configured_sandbox_environment: "sandbox",
					webhook_type: "IDENTITY_VERIFICATION",
					webhook_code: "STATUS_UPDATED",
					reason: "No tasks found - task likely originated from different environment"
				},
				"Plaid IDV webhook received for unknown identity verification ID"
			);
		});
	});

	describe("when tasks are found", () => {
		const mockTask = {
			id: "task_123" as UUID,
			business_id: "business_123" as UUID
		};

		const mockConnection = {
			id: "connection_123" as UUID,
			business_id: "business_123" as UUID,
			platform_id: "PLAID_IDV"
		};

		const mockPlatform = {
			processIdentityVerificationWebhook: jest.fn()
		};

		const mockWebhookResponse = {
			id: "test_idv_123",
			status: "success",
			user: { client_user_id: "user_123" }
		};

		beforeEach(() => {
			mockPlaidIdv.getTasksForIdentityVerificationId.mockResolvedValue([mockTask as any]);
			mockGetConnectionByTaskId.mockResolvedValue(mockConnection as any);
			mockStrategyPlatformFactory.mockResolvedValue(mockPlatform as any);
			mockPlatform.processIdentityVerificationWebhook.mockResolvedValue(mockWebhookResponse);
		});

		it("should successfully process webhook for valid tasks", async () => {
			await controller.handlePlaidIdv(mockRequest as Request, mockResponse as Response);

			expect(mockPlaidIdv.getTasksForIdentityVerificationId).toHaveBeenCalledWith("test_idv_123");
			expect(mockGetConnectionByTaskId).toHaveBeenCalledWith("task_123");
			expect(mockStrategyPlatformFactory).toHaveBeenCalledWith({ dbConnection: mockConnection });
			expect(mockPlatform.processIdentityVerificationWebhook).toHaveBeenCalledWith(mockTask, "test_idv_123");
		});

		it("should return success response with processed results", async () => {
			await controller.handlePlaidIdv(mockRequest as Request, mockResponse as Response);

			expect(mockResponse.jsend?.success).toHaveBeenCalledWith({
				[mockConnection.id]: mockWebhookResponse
			});
		});

		it("should handle multiple tasks", async () => {
			const secondTask = { id: "task_456" as UUID, business_id: "business_456" as UUID };
			const secondConnection = { id: "connection_456" as UUID, business_id: "business_456" as UUID };
			const secondResponse = { id: "test_idv_123", status: "pending" };

			mockPlaidIdv.getTasksForIdentityVerificationId.mockResolvedValue([mockTask, secondTask] as any);

			mockGetConnectionByTaskId
				.mockResolvedValueOnce(mockConnection as any)
				.mockResolvedValueOnce(secondConnection as any);

			const secondPlatform = { processIdentityVerificationWebhook: jest.fn().mockResolvedValue(secondResponse) };
			mockStrategyPlatformFactory
				.mockResolvedValueOnce(mockPlatform as any)
				.mockResolvedValueOnce(secondPlatform as any);

			await controller.handlePlaidIdv(mockRequest as Request, mockResponse as Response);

			expect(mockResponse.jsend?.success).toHaveBeenCalledWith({
				[mockConnection.id]: mockWebhookResponse,
				[secondConnection.id]: secondResponse
			});
		});

		it("should skip tasks with no connection", async () => {
			mockGetConnectionByTaskId.mockResolvedValue(null);

			await controller.handlePlaidIdv(mockRequest as Request, mockResponse as Response);

			expect(mockStrategyPlatformFactory).not.toHaveBeenCalled();
			expect(mockResponse.jsend?.success).toHaveBeenCalledWith({});
		});

		it("should skip tasks with connection but no id", async () => {
			mockGetConnectionByTaskId.mockResolvedValue({ ...mockConnection, id: undefined } as any);

			await controller.handlePlaidIdv(mockRequest as Request, mockResponse as Response);

			expect(mockStrategyPlatformFactory).not.toHaveBeenCalled();
			expect(mockResponse.jsend?.success).toHaveBeenCalledWith({});
		});
	});

	describe("environment configuration", () => {
		it("should handle environment with only PLAID_ENV configured", async () => {
			// Mock envConfig to only have PLAID_ENV
			envConfig.PLAID_SANDBOX_ENV = undefined;

			mockPlaidIdv.getTasksForIdentityVerificationId.mockResolvedValue([]);

			await controller.handlePlaidIdv(mockRequest as Request, mockResponse as Response);

			expect(mockResponse.status).toHaveBeenCalledWith(200);
			expect(mockResponse.json).toHaveBeenCalledWith({ message: "Webhook received" });
		});

		it("should filter out undefined environment configurations", async () => {
			// Mock envConfig with undefined values
			envConfig.PLAID_ENV = undefined;
			envConfig.PLAID_SANDBOX_ENV = "sandbox";

			mockPlaidIdv.getTasksForIdentityVerificationId.mockResolvedValue([]);

			await controller.handlePlaidIdv(mockRequest as Request, mockResponse as Response);

			expect(mockResponse.status).toHaveBeenCalledWith(200);
			expect(mockResponse.json).toHaveBeenCalledWith({ message: "Webhook received" });
		});

		it("should handle environment with both PLAID_ENV and PLAID_SANDBOX_ENV configured to sandbox", async () => {
			// Mock envConfig with both PLAID_ENV and PLAID_SANDBOX_ENV configured to sandbox
			envConfig.PLAID_ENV = "sandbox";
			envConfig.PLAID_SANDBOX_ENV = "sandbox";

			mockPlaidIdv.getTasksForIdentityVerificationId.mockResolvedValue([]);

			await controller.handlePlaidIdv(mockRequest as Request, mockResponse as Response);

			expect(mockResponse.status).toHaveBeenCalledWith(200);
			expect(mockResponse.json).toHaveBeenCalledWith({ message: "Webhook received" });
		});

		it("should handle environment with both PLAID_ENV and PLAID_SANDBOX_ENV configured to sandbox and webhook environment is production", async () => {
			// Mock envConfig with both PLAID_ENV and PLAID_SANDBOX_ENV configured to sandbox
			envConfig.PLAID_ENV = "sandbox";
			envConfig.PLAID_SANDBOX_ENV = "sandbox";

			// Mock webhook environment to production
			mockRequest.body.environment = "production";

			mockPlaidIdv.getTasksForIdentityVerificationId.mockResolvedValue([]);

			await controller.handlePlaidIdv(mockRequest as Request, mockResponse as Response);

			expect(mockLogger.info).toHaveBeenCalledWith(
				{
					identity_verification_id: "test_idv_123",
					webhook_environment: "production",
					configured_production_environment: "sandbox",
					configured_sandbox_environment: "sandbox",
					webhook_type: "IDENTITY_VERIFICATION",
					webhook_code: "STATUS_UPDATED",
					reason: "No tasks found - task likely originated from different environment"
				},
				"Plaid IDV webhook received for unknown identity verification ID"
			);

			expect(mockResponse.status).toHaveBeenCalledWith(200);
			expect(mockResponse.json).toHaveBeenCalledWith({ message: "Webhook received" });
		});
	});
});
