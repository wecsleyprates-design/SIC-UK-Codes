import { ErrorCode } from "#constants";
import { StatusCodes } from "http-status-codes";

export class BureauApiError extends Error {
	status: StatusCodes;
	errorCode?: ErrorCode;
	data: any;

	constructor(message: string, data?: any, httpStatus?: StatusCodes, errorCode?: ErrorCode) {
		super(message);
		this.name = "BureauApiError";

		this.data = data;
		this.status = httpStatus ?? StatusCodes.BAD_REQUEST;
		this.errorCode = errorCode;
	}
}
