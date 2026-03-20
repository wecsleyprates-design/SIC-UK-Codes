import { TruliooRetryManager } from "../truliooRetryManager";

// Mock logger
jest.mock("#helpers/logger", () => ({
	logger: {
		error: jest.fn(),
		warn: jest.fn(),
		info: jest.fn(),
		debug: jest.fn()
	}
}));

/**
 * TODO: Refactor these tests to use mock timers to simulate the exponential backoff delays
 *       instead of *actually* waiting for the delays (which is crazy!!!)
 */
describe("TruliooRetryManager", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe("Retry with Exponential Backoff", () => {
		it("should succeed on first attempt", async () => {
			const mockOperation = jest.fn().mockResolvedValue("success");
			const context = { operation: "testOperation", businessID: "test-123" };

			const result = await TruliooRetryManager.retryWithBackoff(mockOperation, context);

			expect(result).toBe("success");
			expect(mockOperation).toHaveBeenCalledTimes(1);
		});

		it("should retry on failure and eventually succeed", async () => {
			const mockOperation = jest
				.fn()
				.mockRejectedValueOnce(new Error("First failure"))
				.mockRejectedValueOnce(new Error("Second failure"))
				.mockResolvedValueOnce("success");
			const context = { operation: "testOperation", businessID: "test-123" };

			const result = await TruliooRetryManager.retryWithBackoff(mockOperation, context);

			expect(result).toBe("success");
			expect(mockOperation).toHaveBeenCalledTimes(3);
		}, 10000); // Increase timeout for retry test

		it("should fail after max retries exceeded", async () => {
			const mockOperation = jest.fn().mockRejectedValue(new Error("Persistent failure"));
			const context = { operation: "testOperation", businessID: "test-123" };

			await expect(TruliooRetryManager.retryWithBackoff(mockOperation, context)).rejects.toThrow("Persistent failure");

			expect(mockOperation).toHaveBeenCalledTimes(3); // Initial + 2 retries
		}, 10000); // Increase timeout for retry test

		it("should implement exponential backoff correctly", async () => {
			const startTime = Date.now();
			const mockOperation = jest
				.fn()
				.mockRejectedValueOnce(new Error("First failure"))
				.mockRejectedValueOnce(new Error("Second failure"))
				.mockResolvedValueOnce("success");

			const context = { operation: "testOperation", businessID: "test-123" };

			await TruliooRetryManager.retryWithBackoff(mockOperation, context);
			const endTime = Date.now();

			// Should take at least 3 seconds (1000ms + 2000ms delays)
			// Allow some tolerance for test execution time
			expect(endTime - startTime).toBeGreaterThan(2800);
			expect(endTime - startTime).toBeLessThan(5000); // Should not take too long
			expect(mockOperation).toHaveBeenCalledTimes(3);
		}, 10000);
	});

	describe("Error Handling", () => {
		it("should retry on transient errors", async () => {
			const transientError = new Error("ECONNREFUSED");
			const mockOperation = jest.fn().mockRejectedValueOnce(transientError).mockResolvedValueOnce("success");
			const context = { operation: "testOperation", businessID: "test-123" };

			const result = await TruliooRetryManager.retryWithBackoff(mockOperation, context);

			expect(result).toBe("success");
			expect(mockOperation).toHaveBeenCalledTimes(2);
		}, 10000); // Increase timeout for retry test

		it("should not retry on authentication errors", async () => {
			const authError = new Error("401 Unauthorized");
			const mockOperation = jest.fn().mockRejectedValue(authError);
			const context = { operation: "testOperation", businessID: "test-123" };

			await expect(TruliooRetryManager.retryWithBackoff(mockOperation, context)).rejects.toThrow("401 Unauthorized");

			expect(mockOperation).toHaveBeenCalledTimes(1); // No retries for auth errors
		});

		it("should not retry on authorization errors", async () => {
			const authError = new Error("403 Forbidden");
			const mockOperation = jest.fn().mockRejectedValue(authError);
			const context = { operation: "testOperation", businessID: "test-123" };

			await expect(TruliooRetryManager.retryWithBackoff(mockOperation, context)).rejects.toThrow("403 Forbidden");

			expect(mockOperation).toHaveBeenCalledTimes(1); // No retries for auth errors
		});

		it("should handle different error types", async () => {
			const errors = [
				new Error("ETIMEDOUT"),
				new Error("ENOTFOUND"),
				new Error("ECONNRESET"),
				new Error("500 Internal Server Error")
			];

			for (const error of errors) {
				const mockOperation = jest.fn().mockRejectedValueOnce(error).mockResolvedValueOnce("success");
				const context = { operation: "testOperation", businessID: "test-123" };

				const result = await TruliooRetryManager.retryWithBackoff(mockOperation, context);

				expect(result).toBe("success");
				expect(mockOperation).toHaveBeenCalledTimes(2);
			}
		}, 20000); // Increase timeout for multiple error tests
	});

	describe("Retry Configuration", () => {
		it("should use default configuration", async () => {
			const mockOperation = jest.fn().mockResolvedValue("success");
			const context = { operation: "testOperation", businessID: "test-123" };

			const result = await TruliooRetryManager.retryWithBackoff(mockOperation, context);

			expect(result).toBe("success");
			expect(mockOperation).toHaveBeenCalledTimes(1);
		});

		it("should respect max attempts", async () => {
			const mockOperation = jest.fn().mockRejectedValue(new Error("Failure"));
			const context = { operation: "testOperation", businessID: "test-123" };

			await expect(TruliooRetryManager.retryWithBackoff(mockOperation, context)).rejects.toThrow("Failure");

			expect(mockOperation).toHaveBeenCalledTimes(3); // Initial + 2 retries
		}, 10000); // Increase timeout for retry test
	});

	describe("Error Detection", () => {
		it("should identify retryable errors", () => {
			const retryableErrors = [
				new Error("fetch failed"),
				new Error("network error"),
				new Error("timeout"),
				new Error("aborted"),
				new Error("ECONNRESET"),
				new Error("ENOTFOUND")
			];

			retryableErrors.forEach(error => {
				expect(TruliooRetryManager.isRetryableError(error)).toBe(true);
			});
		});

		it("should identify non-retryable errors", () => {
			const nonRetryableErrors = [
				new Error("400 Bad Request"),
				new Error("401 Unauthorized"),
				new Error("403 Forbidden"),
				new Error("404 Not Found"),
				new Error("Validation failed")
			];

			nonRetryableErrors.forEach(error => {
				expect(TruliooRetryManager.isRetryableError(error)).toBe(false);
			});
		});
	});

	describe("Performance and Edge Cases", () => {
		it("should handle rapid successive failures", async () => {
			const mockOperation = jest.fn().mockRejectedValue(new Error("Failure"));
			const context = { operation: "testOperation", businessID: "test-123" };

			const startTime = Date.now();

			await expect(TruliooRetryManager.retryWithBackoff(mockOperation, context)).rejects.toThrow("Failure");

			const endTime = Date.now();
			expect(endTime - startTime).toBeGreaterThan(1000); // Should take time due to delays
			expect(mockOperation).toHaveBeenCalledTimes(3);
		}, 10000); // Increase timeout for retry test

		it("should handle concurrent retry operations", async () => {
			const mockOperation1 = jest.fn().mockRejectedValueOnce(new Error("Failure 1")).mockResolvedValueOnce("success 1");

			const mockOperation2 = jest.fn().mockRejectedValueOnce(new Error("Failure 2")).mockResolvedValueOnce("success 2");

			const context1 = { operation: "testOperation1", businessID: "test-123" };
			const context2 = { operation: "testOperation2", businessID: "test-123" };

			const retryPromise1 = TruliooRetryManager.retryWithBackoff(mockOperation1, context1);
			const retryPromise2 = TruliooRetryManager.retryWithBackoff(mockOperation2, context2);

			const [result1, result2] = await Promise.all([retryPromise1, retryPromise2]);

			expect(result1).toBe("success 1");
			expect(result2).toBe("success 2");
			expect(mockOperation1).toHaveBeenCalledTimes(2);
			expect(mockOperation2).toHaveBeenCalledTimes(2);
		}, 10000); // Increase timeout for concurrent tests
	});

	describe("Logging", () => {
		it("should log retry attempts", async () => {
			const { logger } = require("#helpers/logger");
			const mockOperation = jest
				.fn()
				.mockRejectedValueOnce(new Error("First failure"))
				.mockResolvedValueOnce("success");
			const context = { operation: "testOperation", businessID: "test-123" };

			await TruliooRetryManager.retryWithBackoff(mockOperation, context);

			expect(logger.warn).toHaveBeenCalledWith(
				expect.objectContaining({
					error: "First failure",
					businessID: "test-123"
				}),
				expect.stringContaining("Trulioo testOperation attempt 1 failed, retrying in")
			);
		}, 10000); // Increase timeout for retry test

		it("should log final failure", async () => {
			const { logger } = require("#helpers/logger");
			const mockOperation = jest.fn().mockRejectedValue(new Error("Persistent failure"));
			const context = { operation: "testOperation", businessID: "test-123" };

			await expect(TruliooRetryManager.retryWithBackoff(mockOperation, context)).rejects.toThrow("Persistent failure");

			expect(logger.error).toHaveBeenCalledWith(
				expect.objectContaining({
					error: expect.any(Error),
					businessID: "test-123",
					attempts: 3
				}),
				expect.stringContaining("Trulioo testOperation failed after 3 attempts")
			);
		}, 10000); // Increase timeout for retry test
	});

	describe("Context Handling", () => {
		it("should include context in logs", async () => {
			const { logger } = require("#helpers/logger");
			const mockOperation = jest
				.fn()
				.mockRejectedValueOnce(new Error("First failure"))
				.mockResolvedValueOnce("success");
			const context = {
				operation: "testOperation",
				businessID: "test-123",
				details: { flowId: "test-flow" }
			};

			await TruliooRetryManager.retryWithBackoff(mockOperation, context);

			expect(logger.warn).toHaveBeenCalledWith(
				expect.objectContaining({
					businessID: "test-123"
				}),
				expect.any(String)
			);
		}, 10000); // Increase timeout for retry test

		it("should handle missing context gracefully", async () => {
			const mockOperation = jest.fn().mockResolvedValue("success");
			const context = { operation: "testOperation" };

			const result = await TruliooRetryManager.retryWithBackoff(mockOperation, context);

			expect(result).toBe("success");
			expect(mockOperation).toHaveBeenCalledTimes(1);
		});
	});
});
