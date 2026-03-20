import { StatusCodes } from "http-status-codes";
import { redis } from "./redis";
import { ERROR_CODES } from "#constants";

class PurgedBusinessMiddlewareError extends Error {
	status: number;
	errorCode: string;
	constructor(message: string, httpStatus: number, errorCode: string) {
		super(message);
		this.name = "PurgedBusinessMiddlewareError";
		this.status = httpStatus;
		this.errorCode = errorCode;
	}
}

export const validatePurgedBusinessHelper = async (key: string, error = true) => {
	if (key == null) {
		if (error) {
			throw new PurgedBusinessMiddlewareError("Business Does not Exist", StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
		}

		return true;
	}

	const redisKey = `{purged_business}:${key}`;
	const isBusinessPurged = await redis.exists(redisKey);

	if (isBusinessPurged && error) {
		throw new PurgedBusinessMiddlewareError("Business Does not Exist", StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
	}

	return isBusinessPurged;
};
