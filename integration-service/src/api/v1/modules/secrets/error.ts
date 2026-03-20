import { ERROR_CODES, ErrorCode } from "#constants/error-codes.constant";
import { OPERATION } from "#constants/secrets.constant";
import type { AWSExceptionName, ErrorMapping } from "#types/secrets";
import { StatusCodes } from "http-status-codes";

export const ERROR_MAP: Record<AWSExceptionName, ErrorMapping> = {
	ResourceNotFoundException: {
		message: "Secret not found",
		status: StatusCodes.NOT_FOUND,
		errorCode: ERROR_CODES.NOT_FOUND
	},
	ResourceExistsException: {
		message: "Secret already exists",
		status: StatusCodes.CONFLICT,
		errorCode: ERROR_CODES.DUPLICATE
	},
	InvalidParameterException: {
		message: "Invalid parameter",
		status: StatusCodes.BAD_REQUEST,
		errorCode: ERROR_CODES.NOT_FOUND
	},
	AccessDeniedException: {
		message: "Access denied to secret",
		status: StatusCodes.FORBIDDEN,
		errorCode: ERROR_CODES.UNAUTHORIZED
	},
	DecryptionFailure: {
		message: "Failed to decrypt secret",
		status: StatusCodes.INTERNAL_SERVER_ERROR,
		errorCode: ERROR_CODES.UNKNOWN_ERROR
	},
	EncryptionFailure: {
		message: "Failed to encrypt secret",
		status: StatusCodes.INTERNAL_SERVER_ERROR,
		errorCode: ERROR_CODES.UNKNOWN_ERROR
	},
	InternalServiceError: {
		message: "AWS internal service error",
		status: StatusCodes.INTERNAL_SERVER_ERROR,
		errorCode: ERROR_CODES.UNKNOWN_ERROR
	},
	InvalidRequestException: {
		message: "Invalid request for current resource state",
		status: StatusCodes.BAD_REQUEST,
		errorCode: ERROR_CODES.INVALID
	}
};

export class SecretsManagerError extends Error {
	operation: keyof typeof OPERATION;
	status: StatusCodes;
	errorCode?: ErrorCode;

	constructor(message: string, operation: keyof typeof OPERATION, httpStatus?: StatusCodes, errorCode?: ErrorCode) {
		super(message);
		this.name = "SecretsManagerError";

		this.operation = operation;
		this.status = httpStatus ?? StatusCodes.BAD_REQUEST;
		this.errorCode = errorCode;
	}

	static from(error: any, operation: keyof typeof OPERATION): SecretsManagerError {
		if (error.name && ERROR_MAP[error.name as AWSExceptionName]) {
			const { message, status, errorCode } = ERROR_MAP[error.name as AWSExceptionName];
			return new SecretsManagerError(message, operation, status, errorCode);
		}

		return new SecretsManagerError("Unknown error occurred", operation, StatusCodes.INTERNAL_SERVER_ERROR, ERROR_CODES.UNKNOWN_ERROR);
	}
}
