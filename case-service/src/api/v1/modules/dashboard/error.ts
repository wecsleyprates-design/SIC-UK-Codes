import { ERROR_CODES } from "#constants/index";
import { HttpStatusCode } from "axios";
class DashboardApiError extends Error {
	status: HttpStatusCode;
	errorCode?: ERROR_CODES;
	constructor(message, httpStatus, errorCode?: ERROR_CODES) {
		super(message);
		this.name = "DashboardApiError";
		this.status = httpStatus;
		this.errorCode = errorCode;
	}
}

export { DashboardApiError };
