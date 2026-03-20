import { StatusCodes } from "http-status-codes";
import { verifyToken } from "#utils/index";
import { ERROR_CODES, ROLES, ROLE_ID } from "#constants/index";
import { envConfig } from "#configs/index";

class AuthenticationMiddlewareError extends Error {
	constructor(message, httpStatus, errorCode) {
		super(message);
		this.name = "AuthenticationMiddlewareError";
		this.status = httpStatus;
		this.errorCode = errorCode;
	}
}

export const validateUser = async (req, res, next) => {
	try {
		const authHeader = req.headers.authorization;
		if (!authHeader) {
			throw new AuthenticationMiddlewareError("Authorization header not present", StatusCodes.UNAUTHORIZED, ERROR_CODES.UNAUTHENTICATED);
		}

		if (!authHeader.startsWith("Bearer")) {
			throw new AuthenticationMiddlewareError("Invalid Authorization header type", StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
		}

		const token = authHeader.split(" ")[1];

		const tokenData = await verifyToken(token);

		if (tokenData.iss.includes(envConfig.WORTH_ADMIN_USER_POOL_ID)) {
			tokenData.role = {
				id: ROLE_ID.ADMIN,
				code: ROLES.ADMIN
			};
		} else if (tokenData.iss.includes(envConfig.CUSTOMER_USER_POOL_ID)) {
			tokenData.role = {
				id: ROLE_ID.CUSTOMER,
				code: ROLES.CUSTOMER
			};
			tokenData.customer_id = tokenData["custom:customer_id"];
		} else {
			tokenData.role = {
				id: ROLE_ID.APPLICANT,
				code: ROLES.APPLICANT
			};
		}

		tokenData.user_id = tokenData["custom:id"];
		tokenData.sub_user_id = tokenData["cognito:username"];
		tokenData.access_token = req.headers.authorization.split(" ")[1];
		res.locals.user = tokenData;
		return next();
	} catch (error) {
		return next(error);
	}
};
