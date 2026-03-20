export interface SecretData {
	customer_id: string;
	storage_data: string;
	createdAt?: string;
	status?: string;
	version?: string;
	updatedAt?: string;
}

export interface SecretOperationResult extends SecretData {
	arn?: string;
	version?: string;
	accessedAt: string;
	operation: "CREATE" | "READ" | "UPDATE" | "DELETE";
	message?: string;
}

export type AWSExceptionName =
	| "ResourceNotFoundException"
	| "ResourceExistsException"
	| "InvalidParameterException"
	| "AccessDeniedException"
	| "DecryptionFailure"
	| "EncryptionFailure"
	| "InternalServiceError"
	| "InvalidRequestException";

export interface ErrorMapping {
	message: string;
	status: StatusCodes;
	errorCode: ErrorCode;
}
