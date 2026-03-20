import { logger } from "#helpers/logger";
import axios, { AxiosError } from "axios";

/**
 * Retry manager for Trulioo API calls with exponential backoff
 */
export class TruliooRetryManager {
	private static readonly RETRY_CONFIG = {
		maxAttempts: 3, // Number of retry attempts
		initialDelay: 1000, // Initial retry delay in ms
		maxDelay: 10000 // Maximum delay between retries
	};

	/**
	 * Retry logic with exponential backoff
	 * @param operation - The operation to retry
	 * @param context - Context information
	 * @returns Promise with retry logic
	 */
	static async retryWithBackoff<T>(
		operation: () => Promise<T>,
		context: { operation: string; businessID?: string; details?: unknown }
	): Promise<T> {
		const config = TruliooRetryManager.RETRY_CONFIG;
		let lastError: Error | null = null;

		for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
			try {
				return await operation();
			} catch (error: unknown) {
				lastError = error instanceof Error ? error : new Error("Unknown error");

				// Don't retry on certain errors (like authentication errors)
				if (error instanceof AxiosError) {
					const status = error.response?.status;
					if (status === 401 || status === 403) {
						throw lastError;
					}
				} else if (
					lastError.message.includes("401") ||
					lastError.message.includes("403") ||
					lastError.message.includes("authentication") ||
					lastError.message.includes("authorization")
				) {
					throw lastError;
				}

				if (attempt === config.maxAttempts) {
					logger.error(
						{
							error: lastError,
							businessID: context.businessID,
							attempts: attempt
						},
						`Trulioo ${context.operation} failed after ${config.maxAttempts} attempts`
					);
					throw lastError;
				}

				const delay = Math.min(
					config.initialDelay * Math.pow(2, attempt - 1), // Exponential backoff
					config.maxDelay
				);

				logger.warn(
					{
						error: lastError.message,
						businessID: context.businessID
					},
					`Trulioo ${context.operation} attempt ${attempt} failed, retrying in ${delay}ms`
				);

				await new Promise(resolve => setTimeout(resolve, delay));
			}
		}

		throw lastError || new Error("Retry failed");
	}

	/**
	 * Check if an error is retryable
	 * @param error - The error to check
	 * @returns true if the error is retryable
	 */
	static isRetryableError(error: Error): boolean {
		const retryablePatterns = [
			"fetch",
			"network",
			"timeout",
			"aborted",
			"ECONNRESET",
			"ENOTFOUND",
			"ETIMEDOUT",
			"ECONNREFUSED",
			"ENETUNREACH"
		];

		return retryablePatterns.some(pattern => error.message.toLowerCase().includes(pattern.toLowerCase()));
	}
}
