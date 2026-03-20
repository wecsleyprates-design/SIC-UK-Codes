import type { ErrorCode } from "#constants";
import type { StatusCodes } from "http-status-codes";

class CustomerIntegrationSettingsApiError extends Error {
	status: StatusCodes;
	errorCode: ErrorCode;
	constructor(message, httpStatus: StatusCodes, errorCode: ErrorCode) {
		super(message);
		this.name = "CustomerIntegrationSettingsApiError";
		this.status = httpStatus;
		this.errorCode = errorCode;
	}
}
export { CustomerIntegrationSettingsApiError };
