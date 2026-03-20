import { ERROR_CODES } from "#constants/index";
import { HttpStatusCode } from "axios";
class CaseManagementApiError extends Error {
	status: HttpStatusCode;
	errorCode?: ERROR_CODES;
	constructor(message, httpStatus, errorCode?: ERROR_CODES) {
		super(message);
		this.name = "CaseManagementApiError";
		this.status = httpStatus;
		this.errorCode = errorCode;
	}
}

export { CaseManagementApiError };
