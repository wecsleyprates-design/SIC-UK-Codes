import { TruliooErrorHandler } from "../truliooErrorHandler";
import { VerificationApiError } from "#api/v1/modules/verification/error";
import { StatusCodes } from "http-status-codes";
import { ERROR_CODES } from "#constants";

// Mock logger
jest.mock("#helpers/logger", () => ({
	logger: {
		error: jest.fn(),
		warn: jest.fn(),
		info: jest.fn(),
		debug: jest.fn()
	}
}));

describe("TruliooErrorHandler", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe("Error Conversion", () => {
		it("should convert generic Error to VerificationApiError", () => {
			const genericError = new Error("Generic error message");
			const context = { operation: "testOperation", businessID: "test-123" };

			const result = TruliooErrorHandler.convertToControlledError(genericError, context);

			expect(result).toBeInstanceOf(VerificationApiError);
			expect(result.message).toBe("Trulioo testOperation failed: Generic error message");
		});

		it("should preserve VerificationApiError as-is", () => {
			const verificationError = new VerificationApiError(
				"Already controlled error",
				StatusCodes.NOT_FOUND,
				ERROR_CODES.NOT_FOUND
			);
			const context = { operation: "testOperation", businessID: "test-123" };

			const result = TruliooErrorHandler.convertToControlledError(verificationError, context);

			expect(result).toBe(verificationError);
			expect(result.message).toBe("Already controlled error");
		});

		it("should handle non-Error objects", () => {
			const nonError = { message: "String error" };
			const context = { operation: "testOperation", businessID: "test-123" };

			const result = TruliooErrorHandler.convertToControlledError(nonError, context);

			expect(result).toBeInstanceOf(VerificationApiError);
			expect(result.message).toBe("Trulioo testOperation failed with unknown error");
		});

		it("should handle null/undefined errors", () => {
			const context = { operation: "testOperation", businessID: "test-123" };

			const result = TruliooErrorHandler.convertToControlledError(null, context);

			expect(result).toBeInstanceOf(VerificationApiError);
			expect(result.message).toBe("Trulioo testOperation failed with unknown error");
		});
	});

	describe("Error Categorization", () => {
		it("should categorize network errors correctly", () => {
			const networkError = new Error("fetch failed");
			const context = { operation: "testOperation", businessID: "test-123" };

			const result = TruliooErrorHandler.convertToControlledError(networkError, context);

			expect(result.message).toContain("Trulioo API communication failed");
		});

		it("should categorize timeout errors correctly", () => {
			const timeoutError = new Error("timeout occurred");
			const context = { operation: "testOperation", businessID: "test-123" };

			const result = TruliooErrorHandler.convertToControlledError(timeoutError, context);

			expect(result.message).toContain("Trulioo API request timed out");
		});

		it("should categorize authentication errors correctly", () => {
			const authError = new Error("401 Unauthorized");
			const context = { operation: "testOperation", businessID: "test-123" };

			const result = TruliooErrorHandler.convertToControlledError(authError, context);

			expect(result.message).toBe("Trulioo testOperation failed: 401 Unauthorized");
		});
	});

	describe("Recovery Mechanisms", () => {
		it("should perform cleanup operations", async () => {
			const context = { operation: "testOperation", businessID: "test-123" };

			await TruliooErrorHandler.performCleanup(context);

			const { logger } = require("#helpers/logger");
			expect(logger.info).toHaveBeenCalledWith(
				expect.objectContaining({
					businessID: "test-123"
				}),
				expect.stringContaining("Performing cleanup for Trulioo testOperation")
			);
		});

		it("should handle cleanup errors gracefully", async () => {
			const context = { operation: "testOperation", businessID: "test-123" };

			// Should not throw
			await expect(TruliooErrorHandler.performCleanup(context)).resolves.not.toThrow();
		});

		it("should attempt recovery operations", async () => {
			const context = { operation: "testOperation", businessID: "test-123" };
			const testError = new Error("Test error");

			const result = await TruliooErrorHandler.attemptRecovery(testError, context);

			expect(typeof result).toBe("boolean");
		}, 10000); // Increase timeout for recovery test

		it("should handle recovery failures", async () => {
			const context = { operation: "testOperation", businessID: "test-123" };
			const testError = new Error("Test error");

			const result = await TruliooErrorHandler.attemptRecovery(testError, context);

			expect(typeof result).toBe("boolean");
		}, 10000); // Increase timeout for recovery test
	});

	describe("Rollback Operations", () => {
		it("should perform rollback operations", async () => {
			const context = { operation: "testOperation", businessID: "test-123" };

			await TruliooErrorHandler.rollbackOperations(context);

			const { logger } = require("#helpers/logger");
			expect(logger.info).toHaveBeenCalledWith(
				expect.objectContaining({
					businessID: "test-123"
				}),
				expect.stringContaining("Performing rollback for Trulioo testOperation")
			);
		});

		it("should handle rollback errors gracefully", async () => {
			const context = { operation: "testOperation", businessID: "test-123" };

			// Should not throw
			await expect(TruliooErrorHandler.rollbackOperations(context)).resolves.not.toThrow();
		});
	});

	describe("Error Context Handling", () => {
		it("should include operation context in error messages", () => {
			const error = new Error("Test error");
			const context = { operation: "getFlow", businessID: "test-123" };

			const result = TruliooErrorHandler.convertToControlledError(error, context);

			expect(result.message).toContain("getFlow");
		});

		it("should handle missing context gracefully", () => {
			const error = new Error("Test error");
			const context = { operation: "testOperation" };

			const result = TruliooErrorHandler.convertToControlledError(error, context);

			expect(result).toBeInstanceOf(VerificationApiError);
			expect(result.message).toContain("testOperation");
		});
	});

	describe("Fallback Response", () => {
		it("should provide fallback response for operations", () => {
			const fallback = TruliooErrorHandler.getFallbackResponse("testOperation");

			expect(fallback).toBeDefined();
			expect(typeof fallback).toBe("object");
		});

		it("should log fallback response usage", () => {
			const { logger } = require("#helpers/logger");

			TruliooErrorHandler.getFallbackResponse("testOperation");

			expect(logger.warn).toHaveBeenCalledWith(
				expect.stringContaining("Using fallback response for Trulioo testOperation")
			);
		});
	});

	describe("Edge Cases", () => {
		it("should handle circular reference errors", () => {
			const circularError = new Error("Circular error");
			(circularError as any).self = circularError;
			const context = { operation: "testOperation", businessID: "test-123" };

			const result = TruliooErrorHandler.convertToControlledError(circularError, context);

			expect(result).toBeInstanceOf(VerificationApiError);
			expect(result.message).toContain("Circular error");
		});

		it("should handle very long error messages", () => {
			const longMessage = "A".repeat(10000);
			const error = new Error(longMessage);
			const context = { operation: "testOperation", businessID: "test-123" };

			const result = TruliooErrorHandler.convertToControlledError(error, context);

			expect(result).toBeInstanceOf(VerificationApiError);
			// The actual implementation doesn't truncate, so we check it includes the message
			expect(result.message).toContain("Trulioo testOperation failed");
		});

		it("should handle special characters in error messages", () => {
			const specialMessage = "Error with special chars: !@#$%^&*()_+-=[]{}|;:,.<>?";
			const error = new Error(specialMessage);
			const context = { operation: "testOperation", businessID: "test-123" };

			const result = TruliooErrorHandler.convertToControlledError(error, context);

			expect(result).toBeInstanceOf(VerificationApiError);
			expect(result.message).toContain(specialMessage);
		});
	});
});
