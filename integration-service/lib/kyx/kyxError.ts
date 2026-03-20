import { ErrorCode } from "#constants";
import { StatusCodes } from "http-status-codes";

export interface KyxErrorDetails {
	statusCode?: number;
	timestamp?: string;
	path?: string;
	message?: string;
	details?: any;
}

export class KyxError extends Error {
	status: StatusCodes;
	errorCode?: ErrorCode;
	data: any;
	errorDetails?: KyxErrorDetails;

	constructor(
		message: string,
		data?: any,
		httpStatus?: StatusCodes,
		errorCode?: ErrorCode,
		errorDetails?: KyxErrorDetails
	) {
		super(message);
		this.name = "KyxError";

		this.data = data;
		this.status = httpStatus ?? StatusCodes.INTERNAL_SERVER_ERROR;
		this.errorCode = errorCode;
		this.errorDetails = errorDetails;
	}

	/**
	 * Parses KYX API error response and extracts readable error messages
	 * @param errorResponse - The error response from KYX API
	 * @returns A formatted error message string
	 */
	static parseKyxErrorDetails(errorResponse: any): string {
		if (!errorResponse) return "Unknown error occurred";

		// If there's a top-level message, start with that
		const messages: string[] = [];

		if (errorResponse.message) {
			messages.push(errorResponse.message);
		}

		// Parse the details object
		if (errorResponse.details && typeof errorResponse.details === "object") {
			for (const [category, errors] of Object.entries(errorResponse.details)) {
				if (Array.isArray(errors)) {
					errors.forEach((error: any) => {
						if (error.message) {
							messages.push(`[${category}] ${error.message}`);
						} else if (error.property && error.errorType) {
							messages.push(`[${category}] ${error.property}: ${error.errorType}`);
						}
					});
				}
			}
		}

		return messages.length > 0 ? messages.join("; ") : "KYX API request failed";
	}
}