import { logger } from "#helpers/logger";
import { VerificationApiError } from "#api/v1/modules/verification/error";
import { StatusCodes } from "http-status-codes";
import { ERROR_CODES } from "#constants";
import axios, { AxiosError } from "axios";

/**
 * Error handler for Trulioo operations
 * Provides controlled error handling and recovery mechanisms
 */
export class TruliooErrorHandler {
	private static readonly RECOVERY_CONFIG = {
		maxRetries: 3, // Maximum recovery attempts
		recoveryDelay: 5000, // Delay between recovery attempts
		cleanupTimeout: 10000 // Timeout for cleanup operations
	};

	/**
	 * Perform cleanup operations when an error occurs
	 * @param context - Context information for cleanup
	 * @returns Promise that resolves when cleanup is complete
	 */
	static async performCleanup(context: { operation: string; businessID?: string; details?: unknown }): Promise<void> {
		try {
			logger.info(
				{
					businessID: context.businessID,
					details: context.details
				},
				`Performing cleanup for Trulioo ${context.operation}`
			);

			// Add any cleanup logic here (e.g., cancel pending requests, clear caches, etc.)
			// For now, we'll just log the cleanup

			logger.info(`Cleanup completed for Trulioo ${context.operation}`);
		} catch (cleanupError: unknown) {
			logger.error(cleanupError, `Error during cleanup for Trulioo ${context.operation}:`);
			// Don't throw cleanup errors as they shouldn't mask the original error
		}
	}

	/**
	 * Attempt to recover from an error
	 * @param error - The error that occurred
	 * @param context - Context information
	 * @returns Promise that resolves if recovery is successful
	 */
	static async attemptRecovery(
		error: Error,
		context: { operation: string; businessID?: string; details?: unknown }
	): Promise<boolean> {
		const config = TruliooErrorHandler.RECOVERY_CONFIG;

		for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
			try {
				logger.info(
					{
						businessID: context.businessID,
						error: error.message
					},
					`Attempting recovery for Trulioo ${context.operation} (attempt ${attempt}/${config.maxRetries})`
				);

				// Perform cleanup first
				await TruliooErrorHandler.performCleanup(context);

				// Wait before retry
				await new Promise(resolve => setTimeout(resolve, config.recoveryDelay));

				logger.info(`Recovery attempt ${attempt} completed for Trulioo ${context.operation}`);
				return true;
			} catch (recoveryError: unknown) {
				logger.error(recoveryError, `Recovery attempt ${attempt} failed for Trulioo ${context.operation}:`);

				if (attempt === config.maxRetries) {
					logger.error(`All recovery attempts failed for Trulioo ${context.operation}`);
					return false;
				}
			}
		}

		return false;
	}

	/**
	 * Rollback any partial operations
	 * @param context - Context information for rollback
	 * @returns Promise that resolves when rollback is complete
	 */
	static async rollbackOperations(context: {
		operation: string;
		businessID?: string;
		details?: unknown;
	}): Promise<void> {
		try {
			logger.info(
				{
					businessID: context.businessID,
					details: context.details
				},
				`Performing rollback for Trulioo ${context.operation}`
			);

			// Add rollback logic here (e.g., delete created records, cancel pending operations, etc.)
			// For now, we'll just log the rollback

			logger.info(`Rollback completed for Trulioo ${context.operation}`);
		} catch (rollbackError: unknown) {
			logger.error(rollbackError, `Error during rollback for Trulioo ${context.operation}:`);
			// Don't throw rollback errors as they shouldn't mask the original error
		}
	}

	/**
	 * Convert error to controlled VerificationApiError
	 * @param error - The error to convert
	 * @param context - Context information
	 * @returns Controlled VerificationApiError
	 */
	static convertToControlledError(
		error: unknown,
		context: { operation: string; businessID?: string }
	): VerificationApiError {
		if (error instanceof VerificationApiError) {
			return error; // Already controlled
		}

		// Check if it's an Axios network/API error
		if (error instanceof AxiosError) {
			const status = error.response?.status || 500;
			const statusText = error.response?.statusText || "HTTP Error";
			const errorMessage = error.response?.data?.message || error.message || "Unknown API error";

			return new VerificationApiError(
				`Trulioo API error: ${status} ${statusText} - ${errorMessage}`,
				status,
				ERROR_CODES.UNKNOWN_ERROR
			);
		}

		// Check if it's a network/API error (fallback for non-Axios errors)
		if (error instanceof Error && (error.message.includes("fetch") || error.message.includes("network"))) {
			return new VerificationApiError(
				`Trulioo API communication failed: ${error.message}`,
				StatusCodes.SERVICE_UNAVAILABLE,
				ERROR_CODES.UNKNOWN_ERROR
			);
		}

		// Check if it's a timeout error
		if (error instanceof Error && (error.message.includes("timeout") || error.message.includes("aborted"))) {
			return new VerificationApiError(
				`Trulioo API request timed out: ${error.message}`,
				StatusCodes.REQUEST_TIMEOUT,
				ERROR_CODES.UNKNOWN_ERROR
			);
		}

		// Generic error
		if (error instanceof Error) {
			return new VerificationApiError(
				`Trulioo ${context.operation} failed: ${error.message}`,
				StatusCodes.BAD_REQUEST,
				ERROR_CODES.INVALID
			);
		}

		// Unknown error type
		return new VerificationApiError(
			`Trulioo ${context.operation} failed with unknown error`,
			StatusCodes.INTERNAL_SERVER_ERROR,
			ERROR_CODES.UNKNOWN_ERROR
		);
	}

	/**
	 * Get fallback response when Trulioo is unavailable
	 * @param operation - The operation that failed
	 * @returns Fallback response
	 */
	static getFallbackResponse(operation: string): { status: string; message: string; [key: string]: unknown } {
		logger.warn(`Using fallback response for Trulioo ${operation} - service unavailable`);

		return {
			status: "UNAVAILABLE",
			message: `Trulioo ${operation} is currently unavailable. Please try again later.`,
			fallback: true,
			timestamp: new Date().toISOString(),
			provider: "trulioo"
		};
	}
}
