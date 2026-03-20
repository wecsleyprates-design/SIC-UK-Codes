import type { ErrorCode } from "#constants";
import { StatusCodes } from "http-status-codes";

export class JobApiError extends Error {
	status: StatusCodes;
	errorCode?: ErrorCode;
	data: any;

	constructor(message: string, data?: any, httpStatus?: StatusCodes, errorCode?: ErrorCode) {
		super(message);
		this.name = this.constructor.name;

		this.data = data;
		this.status = httpStatus ?? StatusCodes.BAD_REQUEST;
		this.errorCode = errorCode;
	}
}
