import { ERROR_CODES } from "#constants/index";
import { StatusCodes } from "http-status-codes";

class WorkflowDecisioningApiError extends Error {
	status: StatusCodes;
	errorCode?: ERROR_CODES;

	constructor(message: string, httpStatus: StatusCodes, errorCode?: ERROR_CODES) {
		super(message);
		this.name = "WorkflowDecisioningApiError";
		this.status = httpStatus;
		this.errorCode = errorCode;
	}
}

export { WorkflowDecisioningApiError };
