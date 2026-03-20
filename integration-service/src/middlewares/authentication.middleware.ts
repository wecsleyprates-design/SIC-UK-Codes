import { envConfig } from "#configs/index";
import { ERROR_CODES, ErrorCode, ROLES, ROLE_ID } from "#constants/index";
import { verifyCognitoToken, verifyToken } from "#utils/index";
import { StatusCodes } from "http-status-codes";

class AuthenticationMiddlewareError extends Error {
	status: StatusCodes;
	errorCode: ErrorCode;
	constructor(message, httpStatus: StatusCodes, errorCode: ErrorCode) {
		super(message);
		this.name = "AuthenticationMiddlewareError";
		this.status = httpStatus;
		this.errorCode = errorCode;
	}
}

export const validateUser = async (req, res, next) => {
	try {
		if (!envConfig.WORTH_ADMIN_USER_POOL_ID || !envConfig.CUSTOMER_USER_POOL_ID) {
			throw new AuthenticationMiddlewareError("Environment not properly configured", StatusCodes.INTERNAL_SERVER_ERROR, ERROR_CODES.INVALID);
		}
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
			tokenData.subrole_id = tokenData["custom:subrole_id"];
		} else {
			tokenData.role = {
				id: ROLE_ID.APPLICANT,
				code: ROLES.APPLICANT
			};
			tokenData.is_guest_owner = tokenData["custom:is_guest_owner"] ? tokenData["custom:is_guest_owner"] === "true" : false;
			tokenData.issued_for = typeof tokenData["custom:issued_for"] === "string" ? JSON.parse(tokenData["custom:issued_for"]) : null;
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

export const validateCognitoUser = async (req, res, next) => {
	try {
		const authHeader = req.headers.authorization;
		if (!authHeader) {
			throw new AuthenticationMiddlewareError("Authorization header not present", StatusCodes.UNAUTHORIZED, ERROR_CODES.UNAUTHENTICATED);
		}

		if (!authHeader.startsWith("Bearer")) {
			throw new AuthenticationMiddlewareError("Invalid Authorization header type", StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
		}

		const token = authHeader.split(" ")[1];
		const tokenData = await verifyCognitoToken(token);
		tokenData.user_id = tokenData["custom:id"];
		tokenData.sub_user_id = tokenData["cognito:username"];
		res.locals.user = tokenData;
		return next();
	} catch (error) {
		return next(error);
	}
};
