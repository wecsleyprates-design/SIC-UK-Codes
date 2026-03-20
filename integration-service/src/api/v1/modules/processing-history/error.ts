import type { ErrorCode } from "#constants";
import type { StatusCodes } from "http-status-codes";

class ProcessingHistoryApiError extends Error {
	status: StatusCodes;
	errorCode: ErrorCode; 

	constructor(message: string, httpStatus: StatusCodes, errorCode: ErrorCode) {
		super(message);
		this.name = "ProcessingHistoryApiError";

		this.status = httpStatus;
		this.errorCode = errorCode;
	}
}

export { ProcessingHistoryApiError };
