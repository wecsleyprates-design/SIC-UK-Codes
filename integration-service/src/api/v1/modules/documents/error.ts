import { ErrorCode } from "#constants/index";
import { StatusCodes } from "http-status-codes";

class DocumentApiError extends Error {
	status: StatusCodes;
	errorCode: ErrorCode;

	constructor(message: string, httpStatus: StatusCodes, errorCode: ErrorCode) {
		super(message);
		this.name = "DocumentApiError";

		this.status = httpStatus;
		this.errorCode = errorCode;
	}
}

export { DocumentApiError };
