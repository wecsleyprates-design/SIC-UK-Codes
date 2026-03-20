import { ErrorCode } from "#constants";
import { StatusCodes } from "http-status-codes";

export class CallbackHandlerError extends Error {
	status: StatusCodes;
	errorCode?: ErrorCode;
	data: any;

	constructor(message: string, data?: any, httpStatus?: StatusCodes, errorCode?: ErrorCode) {
		super(message);
		this.name = "CallbackHandlerError";

		this.data = data;
		this.status = httpStatus ?? StatusCodes.BAD_REQUEST;
		this.errorCode = errorCode;
	}
}
