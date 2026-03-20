import type { ErrorCode } from "#constants";
import type { StatusCodes } from "http-status-codes";

class GiactApiError extends Error {
	status: StatusCodes;
	errorCode: ErrorCode;

	constructor(message: string, httpStatus: StatusCodes, errorCode: ErrorCode) {
		super(message);
		this.name = "GiactApiError";
		this.status = httpStatus;
		this.errorCode = errorCode;
	}
}

export { GiactApiError };
