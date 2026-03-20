import { envConfig } from "#configs/index";
import { ENVIRONMENTS } from "#constants/index";
import { logger } from "#helpers/index";
import { isKnexError, isPgDatabaseError } from "#utils/index";
import { ERROR_CODES } from "#constants/index";
import type { NextFunction, Request, Response } from "express-serve-static-core";

export const errorMiddleware = (error: any, req: Request, res: Response, _next: NextFunction) => {
	const isDatabaseError = isKnexError(error) || isPgDatabaseError(error);
	const dbErrorMessage = isKnexError(error) ? error.nativeError?.message || error.message : error.message;
	const safeMessage = isDatabaseError ? "Unexpected error" : error.message;

	logger.error({
		error,
		details: error.details,
		errorType: error?.constructor?.name ?? "Unknown",
		req,
		isDatabaseError,
		dbErrorMessage: isDatabaseError ? dbErrorMessage : undefined,
		message: "Error captured and serialized inside errorMiddleware"
	});

	error.details = error.details && Array.isArray(error.details) ? error.details : [error.details];
	if (error.status < 500) {
		res.jsend.fail(
			safeMessage,
			{
				errorName: error.name,
				...(envConfig.ENV === ENVIRONMENTS.DEVELOPMENT && isDatabaseError && { dbErrorMessage }),
				...(envConfig.ENV === ENVIRONMENTS.DEVELOPMENT && { details: error.details }),
				...(error?.data ? { data: error.data } : {})
			},
			error.errorCode,
			error.status
		);
		return;
	}
	res.jsend.error(safeMessage, error.status, ERROR_CODES.UNKNOWN_ERROR, {
		errorName: error.name,
		code: error.code,
		...(envConfig.ENV === ENVIRONMENTS.DEVELOPMENT && isDatabaseError && { dbErrorMessage }),
		...(envConfig.ENV === ENVIRONMENTS.DEVELOPMENT && { details: error.details }),
		data: error?.data ? { data: error.data } : {}
	});
};
