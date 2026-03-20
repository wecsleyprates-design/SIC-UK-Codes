import { ERROR_CODES } from "#constants/index";
import { StatusCodes } from "http-status-codes";

class RiskMonitoringApiError extends Error {
	status: StatusCodes;
	errorCode: ERROR_CODES;

	constructor(message: string, httpCode: StatusCodes, errorCode?: ERROR_CODES) {
		super(message);
		this.name = "RiskMonitoringApiError";
		this.status = httpCode;
		this.errorCode = errorCode ?? ERROR_CODES.UNKNOWN_ERROR;
	}
}

export { RiskMonitoringApiError };
