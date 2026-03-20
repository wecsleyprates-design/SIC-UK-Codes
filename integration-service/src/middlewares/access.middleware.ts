import { NextFunction, Request, Response } from "express";

import { StatusCodes } from "http-status-codes";
import { ERROR_CODES, FEATURE_FLAGS, ROLES } from "#constants/index";
import { getFlagValue, logger, redis, updateAuthRedisCache } from "#helpers";
import { getBusinessApplicants } from "#helpers/api";
import { UserInfo } from "#types";
import { isUUID } from "#utils";

class AccessMiddlewareError extends Error {
	status: number;
	errorCode: string;

	constructor(message: string, httpStatus: number, errorCode: string) {
		super(message);
		this.name = "AccessMiddlewareError";
		this.status = httpStatus;
		this.errorCode = errorCode;
	}
}

export const validateDataPermission = async (req: Request, res: Response, next: NextFunction) => {
	const userInfo: Pick<UserInfo, "role" | "customer_id" | "email" | "user_id"> = res.locals.user;

	const customerID = req.params.customerID || req.params.customer_id || req.params.customerId;
	const businessID = req.params.businessID || req.params.business_id || req.params.businessId;
	const authorization = req.headers?.authorization as string | undefined;
	const roleCode = userInfo.role?.code;

	try {
		/**
		 * First, check if this function is enabled via the associated feature flag.
		 */
		const isFlagActive = await getFlagValue(FEATURE_FLAGS.WIN_1098_VALIDATE_DATA_PERMISSION);
		/**
		 * If the feature flag associated with this function is not active, short-circuit and call next().
		 */
		if (!isFlagActive) return next();

		switch (roleCode) {
			case ROLES.ADMIN:
				return next();
			case ROLES.CUSTOMER:
				await validateCustomerAccess(userInfo, customerID, businessID);
				return next();
			case ROLES.APPLICANT:
				await validateApplicantAccess(userInfo, businessID, authorization);
				return next();
		}
		// Catch all -- throw an error for invalid role
		throw new AccessMiddlewareError("Invalid role for this request", StatusCodes.FORBIDDEN, ERROR_CODES.UNAUTHORIZED);
	} catch (error) {
		return next(error);
	}
};

async function validateCustomerAccess(
	userInfo: Pick<UserInfo, "customer_id" | "email">,
	customerID: string,
	businessID: string | undefined
): Promise<void> {
	const customerError = new AccessMiddlewareError(
		"You are not allowed to access the data.",
		StatusCodes.FORBIDDEN,
		ERROR_CODES.UNAUTHORIZED
	);
	/**
	 * If there's no customer_id in the token, we cannot check that this user has access to
	 * this customer's data. Return false.
	 */
	if (!userInfo.customer_id) {
		logger.info(`Customer ID not present in token: ${userInfo.email}`);
		throw customerError;
	}

	/**
	 * If businessID is present, we need to check that the business belongs to the customer.
	 * We store the list of business IDs for each customer in a Redis set.
	 * The key is in the format `customer:{customerID}:businesses`.
	 */
	if (businessID) {
		const redisKey = `{customer}:${userInfo.customer_id}:businesses`;
		let access = await redis.sismember(redisKey, businessID);

		if (access) return;

		// If access is false, refresh cache and check again.
		await updateAuthRedisCache(userInfo.customer_id);
		access = await redis.sismember(redisKey, businessID);

		if (access) return;

		throw customerError;
	}

	/**
	 * If there's no businessID, in the query params, that just means we're in the context of
	 * a route which is not specific to a singular business, such as `/customers/:customerID/businesses`.
	 *
	 * In that case, all we need to check is that the customerID in the token
	 * matches the customerID in the request params.
	 */
	if (!!customerID && userInfo.customer_id === customerID) return;

	throw customerError;
}

/* Throws if applicant is not associated with the business */
async function validateApplicantAccess(
	userInfo: Pick<UserInfo, "user_id">,
	businessID: string,
	authorization?: string
): Promise<void> {
	if (isUUID(businessID)) {
		const applicants = await getBusinessApplicants(businessID, authorization);
		for (const applicant of applicants) {
			if (applicant.id === userInfo.user_id) {
				return;
			}
		}
	}
	throw new AccessMiddlewareError(
		"You are not allowed to access details of this business.",
		StatusCodes.FORBIDDEN,
		ERROR_CODES.UNAUTHORIZED
	);
}
