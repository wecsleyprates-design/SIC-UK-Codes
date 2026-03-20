import { ErrorCode } from "#constants";
import { StatusCodes } from "http-status-codes";

export class AccountingApiError extends Error {
	status: StatusCodes;
	errorCode?: ErrorCode;
	data: any;

	constructor(message: string, data?: any, httpStatus?: StatusCodes, errorCode?: ErrorCode) {
		super(message);
		this.name = "AccountingApiError";

		this.data = data;
		this.status = httpStatus ?? StatusCodes.BAD_REQUEST;
		this.errorCode = errorCode;
	}
}
