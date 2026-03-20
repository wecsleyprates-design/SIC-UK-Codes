import { StatusCodes } from "http-status-codes";
import { ErrorCode } from "#constants/error-codes.constant";

class GeocodingApiError extends Error {
	status: StatusCodes;
	errorCode: ErrorCode;

	constructor(message: string, httpStatus: StatusCodes, errorCode: ErrorCode) {
		super(message);
		this.name = "GeocodingApiError";

		this.status = httpStatus;
		this.errorCode = errorCode;
	}
}

export { GeocodingApiError };