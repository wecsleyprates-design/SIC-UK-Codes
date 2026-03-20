import { ErrorCode } from "#constants/index";
import { StatusCodes } from "http-status-codes";

class TaxationApiError extends Error {
	status: StatusCodes;
	errorCode: ErrorCode;

	constructor(message: string, httpStatus: StatusCodes, errorCode: ErrorCode) {
		super(message);
		this.name = "TaxationApiError";

		this.status = httpStatus;
		this.errorCode = errorCode;
	}
}

export { TaxationApiError };
