import type { ErrorCode } from "@joinworth/types/dist/constants/errorCodes";
import { StatusCodes } from "http-status-codes";

export class ManualIntegrationError extends Error {
	status: StatusCodes;
	errorCode?: ErrorCode;
	data: any;

	constructor(message: string, data?: any, httpStatus?: StatusCodes, errorCode?: ErrorCode) {
		super(message);
		this.name = "ManualIntegrationError";

		this.data = data;
		this.status = httpStatus ?? StatusCodes.BAD_REQUEST;
		this.errorCode = errorCode;
	}
}
