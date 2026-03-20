import { validateWebhookRequest } from "../plaid.middleware";
import { Plaid } from "#lib/index";
import { decodeToken, verifyPlaidToken } from "#utils/token";
import { envConfig } from "#configs";
import { StatusCodes } from "http-status-codes";
import { logger } from "#helpers/logger";
import type { Request, Response, NextFunction } from "express";

// Mock dependencies
jest.mock("#lib/index");
jest.mock("#utils/token");
jest.mock("#helpers/logger", () => ({
	logger: {
		info: jest.fn()
	}
}));
jest.mock("#configs", () => ({
	envConfig: {
		PLAID_ENV: "production",
		PLAID_SANDBOX_ENV: "sandbox"
	}
}));

describe("Plaid Middleware - validateWebhookRequest", () => {
	let mockRequest: Partial<Request>;
	let mockResponse: Partial<Response>;
	let mockNext: jest.MockedFunction<NextFunction>;

	const mockPlaid = Plaid as jest.MockedClass<typeof Plaid>;
	const mockDecodeToken = decodeToken as jest.MockedFunction<typeof decodeToken>;
	const mockVerifyPlaidToken = verifyPlaidToken as jest.MockedFunction<typeof verifyPlaidToken>;
	const mockLogger = logger as jest.Mocked<typeof logger>;

	const validToken = "valid.jwt.token";
	const validKeyId = "key_123";
	const mockVerificationKey = {
		alg: "ES256",
		crv: "P-256",
		kid: validKeyId,
		kty: "EC",
		use: "sig",
		x: "mock_x_value",
		y: "mock_y_value",
		expired_at: Date.now() + 3600000 // 1 hour from now
	};

	beforeEach(() => {
		mockRequest = {
			headers: {
				"plaid-verification": validToken
			},
			body: {
				webhook_type: "IDENTITY_VERIFICATION",
				webhook_code: "STATUS_UPDATED",
				identity_verification_id: "test_idv_123",
				environment: "sandbox"
			}
		};

		mockResponse = {
			status: jest.fn().mockReturnThis(),
			json: jest.fn()
		};
		mockNext = jest.fn();

		mockDecodeToken.mockReturnValue({
			header: { kid: validKeyId },
			payload: {},
			signature: "mock_signature"
		});

		const mockPlaidInstance = {
			getWebhookVerificationKey: jest.fn().mockResolvedValue({ key: mockVerificationKey })
		} as unknown as Plaid;
		mockPlaid.mockImplementation(() => mockPlaidInstance);

		mockVerifyPlaidToken.mockImplementation(() => true);

		jest.clearAllMocks();
		jest.resetModules();

		// Reset envConfig values for each test
		envConfig.PLAID_ENV = "production";
		envConfig.PLAID_SANDBOX_ENV = "sandbox";
	});

	describe("Environment validation", () => {
		it("should allow webhooks from configured production environment", async () => {
			mockRequest.body.environment = "production";

			await validateWebhookRequest(mockRequest as Request, mockResponse as Response, mockNext);

			expect(mockNext).toHaveBeenCalledWith(); // No error
		});

		it("should allow webhooks from configured sandbox environment", async () => {
			mockRequest.body.environment = "sandbox";

			await validateWebhookRequest(mockRequest as Request, mockResponse as Response, mockNext);

			expect(mockNext).toHaveBeenCalledWith(); // No error
		});

		it("should return 200 for webhooks from unconfigured environment", async () => {
			mockRequest.body.environment = "development";

			await validateWebhookRequest(mockRequest as Request, mockResponse as Response, mockNext);

			expect(mockResponse.status).toHaveBeenCalledWith(StatusCodes.OK);
			expect(mockResponse.json).toHaveBeenCalledWith({ message: "Webhook received" });
			expect(mockNext).not.toHaveBeenCalled();
			expect(mockLogger.info).toHaveBeenCalledWith(
				expect.objectContaining({
					identity_verification_id: "test_idv_123",
					webhook_environment: "development",
					configured_production_environment: "production",
					configured_sandbox_environment: "sandbox",
					webhook_type: "IDENTITY_VERIFICATION",
					webhook_code: "STATUS_UPDATED",
					reason: "Invalid environment"
				}),
				"Plaid webhook received for invalid environment"
			);
		});

		it("should handle missing environment in request body", async () => {
			delete mockRequest.body.environment;

			await validateWebhookRequest(mockRequest as Request, mockResponse as Response, mockNext);

			expect(mockNext).toHaveBeenCalledWith(); // Should pass validation
		});

		it("should return 200 when only PLAID_ENV is configured and webhook from unconfigured sandbox", async () => {
			// Mock envConfig to only have PLAID_ENV
			envConfig.PLAID_SANDBOX_ENV = undefined;
			mockRequest.body.environment = "sandbox";

			await validateWebhookRequest(mockRequest as Request, mockResponse as Response, mockNext);

			expect(mockResponse.status).toHaveBeenCalledWith(StatusCodes.OK);
			expect(mockResponse.json).toHaveBeenCalledWith({ message: "Webhook received" });
			expect(mockNext).not.toHaveBeenCalled();
		});

		it("should return 200 when both environments configured to sandbox but webhook from production", async () => {
			// Mock envConfig with both PLAID_ENV and PLAID_SANDBOX_ENV configured to sandbox
			envConfig.PLAID_SANDBOX_ENV = "sandbox";
			envConfig.PLAID_ENV = "sandbox";
			mockRequest.body.environment = "production";

			await validateWebhookRequest(mockRequest as Request, mockResponse as Response, mockNext);

			expect(mockResponse.status).toHaveBeenCalledWith(StatusCodes.OK);
			expect(mockResponse.json).toHaveBeenCalledWith({ message: "Webhook received" });
			expect(mockNext).not.toHaveBeenCalled();
		});
	});
});
