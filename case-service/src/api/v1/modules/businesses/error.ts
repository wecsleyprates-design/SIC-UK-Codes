import type { ERROR_CODES } from "#constants";

export class BusinessApiError extends Error {
	public status?: number;
	public errorCode?: ERROR_CODES;
	public data?: Record<string, any>;
	constructor(
		message,
		httpStatus: number | undefined = undefined,
		errorCode: ERROR_CODES | undefined = undefined,
		data: Record<string, any> = {}
	) {
		super(message);
		this.name = "BusinessApiError";
		this.status = httpStatus;
		this.errorCode = errorCode;
		this.data = data;
	}
}

export class InternationalBusinessError extends Error {
	public status: number;
	public errorCode: ERROR_CODES;
	public data: Record<string, any>;
	constructor(message, httpStatus, errorCode, data = {}) {
		super(message);
		this.name = "InternationalBusinessError";
		this.status = httpStatus;
		this.errorCode = errorCode;
		this.data = data;
	}
}

export const isBusinessApiError = (error: unknown): error is BusinessApiError => {
	return Error.isError(error) && error.name === "BusinessApiError";
};

export const isInternationalBusinessError = (error: unknown): error is InternationalBusinessError => {
	return Error.isError(error) && error.name === "InternationalBusinessError";
};
