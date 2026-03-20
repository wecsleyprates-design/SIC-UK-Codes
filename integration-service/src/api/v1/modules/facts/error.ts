import type { ErrorCode } from "#constants";
import type { StatusCodes } from "http-status-codes";

class FactsApiError extends Error {
	status: StatusCodes;
	errorCode: ErrorCode;
	constructor(message: string, httpStatus: StatusCodes, errorCode: ErrorCode) {
		super(message);
		this.name = "FactsApiError";

		this.status = httpStatus;
		this.errorCode = errorCode;
	}
}
export { FactsApiError };