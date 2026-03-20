import type { ErrorCode } from "#constants";
import type { StatusCodes } from "http-status-codes";

class BankingApiError extends Error {
	status: StatusCodes;
	errorCode: ErrorCode;
	constructor(message, httpStatus: StatusCodes, errorCode: ErrorCode) {
		super(message);
		this.name = "BankingApiError";

		this.status = httpStatus;
		this.errorCode = errorCode;
	}
}
export { BankingApiError };
