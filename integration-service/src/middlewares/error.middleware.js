import { isNonEmptyArray } from "@austinburns/type-guards";
import { logger } from "#helpers/index";
import { envConfig } from "#configs/index";
import { ENVIRONMENTS, ERROR_CODES } from "#constants/index";

export const errorMiddleware = (error, req, res) => {
	error.details = isNonEmptyArray(error.details) ? error.details : [error?.details ?? error.message];
	logger.error({ error }, error.message);

	if (error.status < 500) {
		res.jsend.fail(
			error.message,
			{
				errorName: error.name,
				details: envConfig.ENV === ENVIRONMENTS.DEVELOPMENT ? error.details : undefined
			},
			error.errorCode,
			error.status
		);
		return;
	}
	res.jsend.error(error.message, error.status, ERROR_CODES.UNKNOWN_ERROR, {
		errorName: error.name,
		code: error.code,
		details: envConfig.ENV === ENVIRONMENTS.DEVELOPMENT ? error.details : undefined
	});
};
