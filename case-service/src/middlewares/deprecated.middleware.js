import { StatusCodes } from "http-status-codes";
import { ERROR_CODES } from "#constants/index";

class DeprecatedMiddlewareError extends Error {
	constructor(message, httpStatus, errorCode) {
		super(message);
		this.name = "DeprecatedMiddlewareError";
		this.status = httpStatus;
		this.errorCode = errorCode;
	}
}

// eslint-disable-next-line no-unused-vars
export const isDeprecated = (req, res, next) => {
	try {
		throw new DeprecatedMiddlewareError(
			"This API has been deprecated and will be removed in a future releases. Visit API docs for more information.",
			StatusCodes.GONE,
			ERROR_CODES.DEPRECATED
		);
	} catch (error) {
		throw error;
	}
};
