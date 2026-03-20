import crypto from "crypto";
import type { Request, Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";
import {
	validateVerdataTask,
	verifyVerdataWebhookMiddleware,
	VerdataWebhookError
} from "../verifyVerdataWebhook.middleware";

// Test secret - same as in signatureUtils.test.ts
const testSecret = "test-secret-for-unit-tests-32-characters";

// Mock the environment config
jest.mock("#configs/index", () => ({
	envConfig: {
		VERDATA_CALLBACK_SECRET: "test-secret-for-unit-tests-32-characters",
		VERDATA_SIGNATURE_MAX_AGE_SECONDS: 3600
	}
}));

// Mock the logger
jest.mock("#helpers/index", () => ({
	logger: {
		warn: jest.fn(),
		error: jest.fn(),
		info: jest.fn(),
		debug: jest.fn()
	}
}));

// Mock the Verdata class for task validation
jest.mock("#lib/verdata/verdata", () => ({
	Verdata: {
		getEnrichedTask: jest.fn()
	}
}));

// Mock constants
jest.mock("#constants/index", () => ({
	INTEGRATION_ID: {
		VERDATA: 4
	},
	TASK_STATUS: {
		SUCCESS: "SUCCESS",
		IN_PROGRESS: "IN_PROGRESS",
		FAILED: "FAILED"
	},
	ERROR_CODES: {
		UNAUTHENTICATED: "UNAUTHENTICATED",
		UNAUTHORIZED: "UNAUTHORIZED",
		INVALID: "INVALID"
	}
}));

import { Verdata as VerdataClass } from "#lib/verdata/verdata";

describe("Verdata Webhook Middleware", () => {
	const mockBusinessId = "1e3a2bdd-f569-430e-85c0-0f065c41ae8a";
	const mockTaskId = "b7124d87-bfec-46c1-92b3-0d40a4a8636c";

	let mockRequest: Partial<Request>;
	let mockResponse: Partial<Response>;
	let mockNext: jest.MockedFunction<NextFunction>;

	function generateValidSignature(businessId: string, taskId: string, timestamp: number): string {
		const dataToSign = `${businessId}:${taskId}:${timestamp}`;
		return crypto.createHmac("sha256", testSecret).update(dataToSign).digest("hex");
	}

	beforeEach(() => {
		mockResponse = {
			status: jest.fn().mockReturnThis(),
			json: jest.fn().mockReturnThis(),
			jsend: {
				success: jest.fn().mockReturnThis(),
				fail: jest.fn().mockReturnThis(),
				error: jest.fn().mockReturnThis()
			}
		} as Partial<Response>;
		mockNext = jest.fn();
		jest.clearAllMocks();
	});

	describe("validateVerdataTask", () => {
		const mockGetEnrichedTask = VerdataClass.getEnrichedTask as jest.Mock;

		it("should return valid for existing Verdata task", async () => {
			mockGetEnrichedTask.mockResolvedValue({
				id: mockTaskId,
				platform_id: 4, // VERDATA
				task_status: "IN_PROGRESS"
			});

			const result = await validateVerdataTask(mockTaskId);

			expect(result.valid).toBe(true);
			expect(result.error).toBeUndefined();
		});

		it("should return MISSING_TASK_ID when task_id is undefined", async () => {
			const result = await validateVerdataTask(undefined);

			expect(result.valid).toBe(false);
			expect(result.error).toBe("MISSING_TASK_ID");
		});

		it("should return MISSING_TASK_ID when task_id is 'undefined' string", async () => {
			const result = await validateVerdataTask("undefined");

			expect(result.valid).toBe(false);
			expect(result.error).toBe("MISSING_TASK_ID");
		});

		it("should return INVALID_TASK_ID for non-UUID format", async () => {
			const result = await validateVerdataTask("not-a-valid-uuid");

			expect(result.valid).toBe(false);
			expect(result.error).toBe("INVALID_TASK_ID");
		});

		it("should return TASK_NOT_FOUND when task does not exist", async () => {
			mockGetEnrichedTask.mockResolvedValue(null);

			const result = await validateVerdataTask(mockTaskId);

			expect(result.valid).toBe(false);
			expect(result.error).toBe("TASK_NOT_FOUND");
		});

		it("should return TASK_NOT_FOUND when task has no id", async () => {
			mockGetEnrichedTask.mockResolvedValue({});

			const result = await validateVerdataTask(mockTaskId);

			expect(result.valid).toBe(false);
			expect(result.error).toBe("TASK_NOT_FOUND");
		});

		it("should return INVALID_PLATFORM when task is not a Verdata task", async () => {
			mockGetEnrichedTask.mockResolvedValue({
				id: mockTaskId,
				platform_id: 1, // PLAID, not VERDATA
				task_status: "IN_PROGRESS"
			});

			const result = await validateVerdataTask(mockTaskId);

			expect(result.valid).toBe(false);
			expect(result.error).toBe("INVALID_PLATFORM");
		});

		it("should return TASK_NOT_FOUND when database throws error", async () => {
			mockGetEnrichedTask.mockRejectedValue(new Error("Database error"));

			const result = await validateVerdataTask(mockTaskId);

			expect(result.valid).toBe(false);
			expect(result.error).toBe("TASK_NOT_FOUND");
		});

		it("should accept valid UUID formats", async () => {
			mockGetEnrichedTask.mockResolvedValue({
				id: mockTaskId,
				platform_id: 4,
				task_status: "IN_PROGRESS"
			});

			// Test various valid UUID formats
			const validUUIDs = [
				"00000000-0000-0000-0000-000000000000",
				"ffffffff-ffff-ffff-ffff-ffffffffffff",
				"a1b2c3d4-e5f6-7890-abcd-ef1234567890"
			];

			for (const uuid of validUUIDs) {
				const result = await validateVerdataTask(uuid);
				expect(result.valid).toBe(true);
			}
		});
	});

	describe("verifyVerdataWebhookMiddleware", () => {
		const mockGetEnrichedTask = VerdataClass.getEnrichedTask as jest.Mock;

		/**
		 * Note: In production, validateSchema(schema.verdataWebhook) runs before this middleware,
		 * ensuring business_id, task_id (valid UUIDs), ts, and sig are all present.
		 * Tests for missing/malformed parameters validate the middleware's defensive behavior,
		 * but these scenarios won't occur in the actual route due to schema validation.
		 */

		it("should call next() when both signature and task are valid", async () => {
			const timestamp = Math.floor(Date.now() / 1000);
			const signature = generateValidSignature(mockBusinessId, mockTaskId, timestamp);

			mockGetEnrichedTask.mockResolvedValue({
				id: mockTaskId,
				platform_id: 4,
				task_status: "IN_PROGRESS"
			});

			mockRequest = {
				query: {
					business_id: mockBusinessId,
					task_id: mockTaskId,
					ts: timestamp.toString(),
					sig: signature
				},
				ip: "127.0.0.1",
				headers: {}
			};

			await verifyVerdataWebhookMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

			expect(mockNext).toHaveBeenCalled();
		});

		it("should pass VerdataWebhookError with 401 to next() for missing signature before checking task", async () => {
			mockRequest = {
				query: {
					business_id: mockBusinessId,
					task_id: mockTaskId
				},
				ip: "127.0.0.1",
				headers: {}
			};

			await verifyVerdataWebhookMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

			// Middleware should call next with the error
			expect(mockNext).toHaveBeenCalledTimes(1);
			const error = mockNext.mock.calls[0][0] as unknown as VerdataWebhookError;
			expect(error).toBeInstanceOf(VerdataWebhookError);
			expect(error.status).toBe(StatusCodes.UNAUTHORIZED);
			expect(error.errorCode).toBe("UNAUTHENTICATED");
			// Task validation should not be called
			expect(mockGetEnrichedTask).not.toHaveBeenCalled();
		});

		it("should pass VerdataWebhookError with 403 to next() for invalid signature before checking task", async () => {
			const timestamp = Math.floor(Date.now() / 1000);

			mockRequest = {
				query: {
					business_id: mockBusinessId,
					task_id: mockTaskId,
					ts: timestamp.toString(),
					sig: "invalid"
				},
				ip: "127.0.0.1",
				headers: {}
			};

			await verifyVerdataWebhookMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

			// Middleware should call next with the error
			expect(mockNext).toHaveBeenCalledTimes(1);
			const error = mockNext.mock.calls[0][0] as unknown as VerdataWebhookError;
			expect(error).toBeInstanceOf(VerdataWebhookError);
			expect(error.status).toBe(StatusCodes.FORBIDDEN);
			expect(error.errorCode).toBe("UNAUTHORIZED");
			// Task validation should not be called
			expect(mockGetEnrichedTask).not.toHaveBeenCalled();
		});

		it("should pass VerdataWebhookError with 400 to next() for valid signature but invalid task", async () => {
			const timestamp = Math.floor(Date.now() / 1000);
			const invalidTaskId = "not-a-uuid";
			const signature = generateValidSignature(mockBusinessId, invalidTaskId, timestamp);

			mockRequest = {
				query: {
					business_id: mockBusinessId,
					task_id: invalidTaskId,
					ts: timestamp.toString(),
					sig: signature
				},
				ip: "127.0.0.1",
				headers: {}
			};

			await verifyVerdataWebhookMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

			// Middleware should call next with the error
			expect(mockNext).toHaveBeenCalledTimes(1);
			const error = mockNext.mock.calls[0][0] as unknown as VerdataWebhookError;
			expect(error).toBeInstanceOf(VerdataWebhookError);
			expect(error.status).toBe(StatusCodes.BAD_REQUEST);
			expect(error.errorCode).toBe("INVALID");
			expect(error.message).toContain("INVALID_TASK_ID");
		});

		it("should pass VerdataWebhookError with 400 to next() for valid signature but non-existent task", async () => {
			const timestamp = Math.floor(Date.now() / 1000);
			const signature = generateValidSignature(mockBusinessId, mockTaskId, timestamp);

			mockGetEnrichedTask.mockResolvedValue(null);

			mockRequest = {
				query: {
					business_id: mockBusinessId,
					task_id: mockTaskId,
					ts: timestamp.toString(),
					sig: signature
				},
				ip: "127.0.0.1",
				headers: {}
			};

			await verifyVerdataWebhookMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

			// Middleware should call next with the error
			expect(mockNext).toHaveBeenCalledTimes(1);
			const error = mockNext.mock.calls[0][0] as unknown as VerdataWebhookError;
			expect(error).toBeInstanceOf(VerdataWebhookError);
			expect(error.status).toBe(StatusCodes.BAD_REQUEST);
			expect(error.errorCode).toBe("INVALID");
			expect(error.message).toContain("TASK_NOT_FOUND");
		});
	});
});
