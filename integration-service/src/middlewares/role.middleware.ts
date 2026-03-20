import { ERROR_CODES, ErrorCode, ROLES } from "#constants/index";
import { StatusCodes } from "http-status-codes";

class RoleMiddlewareError extends Error {
	status: StatusCodes;
	errorCode: ErrorCode;
	constructor(message, httpStatus: StatusCodes, errorCode: ErrorCode) {
		super(message);
		this.name = "RoleMiddlewareError";
		this.status = httpStatus;
		this.errorCode = errorCode;
	}
}

export const validateRole = (...roles: ROLES[]) => {
	// eslint-disable-next-line consistent-return
	return (req, res, next) => {
		try {
			const { role } = res.locals.user;
			if (roles && roles.length > 0 && !roles.includes(role.code)) {
				throw new RoleMiddlewareError("Role Not Allowed", StatusCodes.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED);
			}
			return next();
		} catch (error) {
			throw error;
		}
	};
};
