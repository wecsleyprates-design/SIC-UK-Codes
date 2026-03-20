import { redis } from "#helpers";
import { StatusCodes } from "http-status-codes";
import { ERROR_CODES } from "#constants/index";

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

export const validatePurgedBusiness = async (req, res, next) => {
	try {
		if (req?.params?.businessID) {
			const redisKey = `{purged_business}:${req.params.businessID}`;
			const isBusinessPurged = await redis.exists(redisKey);

			if (isBusinessPurged) {
				throw new PurgedBusinessMiddlewareError(
					"Business Does not Exist",
					StatusCodes.BAD_REQUEST,
					ERROR_CODES.INVALID
				);
			}
		}

		if (req?.body?.business_id) {
			const redisKey = `{purged_business}:${req.body.business_id}`;
			const isBusinessPurged = await redis.exists(redisKey);

			if (isBusinessPurged) {
				throw new PurgedBusinessMiddlewareError(
					"Business Does not Exist",
					StatusCodes.BAD_REQUEST,
					ERROR_CODES.INVALID
				);
			}
		}

		return next();
	} catch (error) {
		return next(error);
	}
};
