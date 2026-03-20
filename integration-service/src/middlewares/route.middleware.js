import { ERROR_CODES } from "#constants/index";
import { ReasonPhrases, StatusCodes } from "http-status-codes";

class MethodNotAllowedError extends Error {
	constructor(message, httpStatus, errorCode) {
		super(message);
		this.name = "MethodNotAllowedError";
		this.status = httpStatus;
		this.errorCode = errorCode;
	}
}

export const methodNotAllowed = () => {
	try {
		throw new MethodNotAllowedError(ReasonPhrases.METHOD_NOT_ALLOWED, StatusCodes.METHOD_NOT_ALLOWED, ERROR_CODES.NOT_ALLOWED);
	} catch (error) {
		throw error;
	}
};

class RouteNotFoundError extends Error {
	constructor(message, httpStatus, errorCode) {
		super(message);
		this.name = "RouteNotFoundError";
		this.status = httpStatus;
		this.errorCode = errorCode;
	}
}

export const routeNotFound = () => {
	try {
		throw new RouteNotFoundError(ReasonPhrases.NOT_FOUND, StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
	} catch (error) {
		throw error;
	}
};

export const paginate = (req, res, next) => {
	if (!req.paginate) {
		return next();
	}
	const [records, paginationOptions] = req.paginate;
	const { count, limit, page } = paginationOptions;
	if (records) {
		const size = Array.isArray(records) ? records.length : 1;
		const totalPages = Math.ceil(count / (limit || count)) || 0;
		const nextPage = page < totalPages && size > limit ? page + 1 : undefined;
		const previousPage = page > 1 ? page - 1 : undefined;
		const pagination = {
			totalItems: count,
			totalPages,
			nextPage,
			previousPage,
			page,
			limit
		};
		return res.jsend.success({ records, ...pagination }, "Records fetched successfully");
	}
	return res.jsend.error(null, "Records not found");
};
