import type { ErrorCode } from "@joinworth/types/dist/constants/errorCodes";
import type { StatusCodes } from "http-status-codes";

export class PaymentProcessorError extends Error {
	status: StatusCodes;
	errorCode: ErrorCode;

	constructor(message: string, httpStatus: StatusCodes, errorCode: ErrorCode) {
		super(message);
		this.name = "PaymentProcessorError";

		this.status = httpStatus;
		this.errorCode = errorCode;
	}
}
