import { StatusCodes } from "http-status-codes";
import { ERROR_CODES, ErrorCode } from "#constants/index";

class ApplicantsApiError extends Error {
	status: StatusCodes;
	errorCode?: ErrorCode;

	constructor(message: string, httpStatus: StatusCodes, errorCode: ErrorCode) {
		super(message);
		this.name = "ApplicantsApiError";

		this.status = httpStatus || StatusCodes.BAD_REQUEST;
		this.errorCode = errorCode || ERROR_CODES.INVALID;
	}
}
export { ApplicantsApiError };
