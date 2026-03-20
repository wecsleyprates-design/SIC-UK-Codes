/**
 * How To use:
 * 1. Extend BaseError
 * 2. Build out your Record<ErrorCode, BaseErrorRecord> object and export it
 *   example:
 *   export const MyErrorCodes = {
	DS_C00000: {
		message: "Invalid Connection Reference",
		httpStatus: HttpStatusCode.BadRequest,
		key: "invalid_connection_reference_serp"
	}} as const satisfies BaseErrorCodes;
 * 3. Assign the static CODES property to your Record<ErrorCode, BaseErrorRecord> object:
	export class MyError extends BaseError {
		static override readonly CODES = MyErrorCodes;
		...rest of your constructor
	}

 */
import { logger as defaultLogger } from "#helpers";

import { HttpStatusCode } from "axios";
import type { Logger } from "pino";

type BaseErrorRecord = { message: string; httpStatus: HttpStatusCode; isRetryable?: boolean; key?: string };

export type BaseErrorCodes = Record<string /* ErrorCode*/, BaseErrorRecord>;
export type BaseErrorContext = Record<string, unknown> & {
	error?: Error;
	logger?: Logger;
};

export abstract class BaseError extends Error {
	public static readonly CODES: BaseErrorCodes;
	public staticRef: typeof BaseError;

	status: HttpStatusCode;
	errorMessage: string;
	errorCode: keyof typeof BaseError.CODES;
	errorKey: string;
	isRetryable: boolean;
	logger: Logger;
	details: string[] | undefined;
	parentError: BaseError | undefined;

	constructor(errorCode: string | BaseErrorRecord, message?: string, context?: BaseErrorContext) {
		super(message);
		this.name = (new.target as any)?.name ?? this.constructor.name;
		this.staticRef = new.target as unknown as typeof BaseError;

		// Did we get the record or the key?
		if (this.#isBaseErrorRecord(errorCode)) {
			const entry = Object.entries(this.staticRef.CODES).find(([key, value]) => value === errorCode);
			if (entry) {
				errorCode = entry[0] as keyof typeof BaseError.CODES;
			}
		}

		const {
			key: errorKey,
			message: errorMessage,
			httpStatus,
			isRetryable
		} = this.staticRef.CODES[errorCode as keyof typeof BaseError.CODES] ?? {
			key: "unknown_error",
			message: "Unknown Error",
			status: HttpStatusCode.InternalServerError,
			isRetryable: false,
			errorKey: undefined
		};

		this.status = httpStatus;
		this.errorCode = errorCode as keyof typeof BaseError.CODES;
		// Defaults to the message associated with the enumerated BaseErrorCode but will be overriden if a message is provided to the constructor
		this.message = errorMessage ?? message;
		this.errorMessage = errorMessage;
		this.errorKey = errorKey ?? (errorCode as string);
		this.logger = context?.logger ?? defaultLogger;
		this.isRetryable = isRetryable ?? false;
		// Build details
		this.details = [];
		this.details.push(this.message);
		if (errorKey) {
			this.details.push(this.errorKey);
		}
		if (isRetryable) {
			this.details.push("retryable");
		}
		if (context?.error) {
			this.details.push(`parentError: ${context.error.message}`);
			if (context.error instanceof BaseError) {
				this.details.push(`parentError Key: ${context.error.errorKey}`);
				this.parentError = context.error;
			}
		}
		this.logger.error(
			{
				error_code: errorCode,
				error_key: errorKey,
				http_status: httpStatus,
				error_message: errorMessage,
				message,
				is_retryable: isRetryable,
				name: this.name,
				stack: this.stack,
				details: context?.details,
				parent_error: this.parentError
			},
			message ?? errorMessage
		);
	}

	static fromError(
		error: unknown,
		errorCode: string | BaseErrorRecord,
		message?: string,
		context?: BaseErrorContext
	): BaseError {
		return new (this as any)(errorCode, message, { ...(context ?? {}), error });
	}

	/** What gets serialized via Express */
	public toJSON() {
		return {
			name: this.name,
			message: this.message,
			errorCode: this.errorCode,
			errorKey: this.errorKey,
			httpStatus: this.status,
			errorMessage: this.errorMessage,
			isRetryable: this.isRetryable,
			stack: this.stack,
			cause: this.cause,
			details: this.details,
			parentError: this.parentError
		};
	}

	#isBaseErrorRecord(errorCode: unknown): errorCode is BaseErrorRecord {
		return !!errorCode && typeof errorCode === "object" && "message" in errorCode;
	}
}
