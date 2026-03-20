import type { ErrorCode } from "#constants";
import type { StatusCodes } from "http-status-codes";

class ElectronicConsentApiError extends Error {
	status: StatusCodes;
	errorCode: ErrorCode;
	constructor(message: string, httpStatus: StatusCodes, errorCode: ErrorCode) {
		super(message);
		this.name = "ElectronicConsentApiError";

		this.status = httpStatus;
		this.errorCode = errorCode;
	}
}
export { ElectronicConsentApiError };
