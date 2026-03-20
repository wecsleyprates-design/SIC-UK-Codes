import { StatusCodes } from "http-status-codes";
import { ERROR_CODES, ROLE_ID } from "#constants/index";
import { customer } from "../api/v1/modules/customer/customer";

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

//checks whether the data the business customer is attempting to access actually belongs to that customer
export const validateDataPermission = async (req, res, next) => {
	const userInfo = res.locals.user;
	try {
		if (userInfo.role.id === ROLE_ID.CUSTOMER) {
			const access = await customer._validateDataPermission(req.params, userInfo);
			if (!access) {
				throw new AccessMiddlewareError("You are not allowed to access the data.", StatusCodes.FORBIDDEN, ERROR_CODES.UNAUTHORIZED);
			}
		}
		return next();
	} catch (error) {
		return next(error);
	}
};
