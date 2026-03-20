import { ERROR_CODES } from "#constants/index";
import { StatusCodes } from "http-status-codes";

/**
 * Custom error class for custom fields operations
 */
export class CustomFieldsError extends Error {
	status: number;
	errorCode: string;
	details?: Record<string, unknown>;

	constructor(
		message: string,
		details?: Record<string, unknown>,
		httpStatus: number = StatusCodes.BAD_REQUEST,
		errorCode: string = ERROR_CODES.INVALID
	) {
		super(message);
		this.name = "CustomFieldsError";
		this.status = httpStatus;
		this.errorCode = errorCode;
		this.details = details;
	}
}

/**
 * Error thrown when custom field validation fails
 */
export class CustomFieldValidationError extends CustomFieldsError {
	constructor(message: string, details?: Record<string, unknown>) {
		super(message, details, StatusCodes.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR);
		this.name = "CustomFieldValidationError";
	}
}

/**
 * Error thrown when custom field is not found
 */
export class CustomFieldNotFoundError extends CustomFieldsError {
	constructor(fieldId: string) {
		super(`Custom field with ID ${fieldId} not found`, { fieldId }, StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
		this.name = "CustomFieldNotFoundError";
	}
}

/**
 * Error thrown when permission is denied for custom field operations
 */
export class CustomFieldPermissionError extends CustomFieldsError {
	constructor(message: string = "You do not have permission to edit custom fields") {
		super(message, {}, StatusCodes.FORBIDDEN, ERROR_CODES.UNAUTHORIZED);
		this.name = "CustomFieldPermissionError";
	}
}
