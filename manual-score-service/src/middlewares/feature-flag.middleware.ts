import { type Request, type Response, type NextFunction } from "express";
import { StatusCodes } from "http-status-codes";
import { getFlagValue } from "#helpers/LaunchDarkly";
import { type IFlagConfig, type TResponseFlagValue, type TResponseLocals } from "#types/index";
import { ERROR_CODES } from "#constants/index";

export const validateFeatureFlag = (flag: string, config?: IFlagConfig) => {
	// eslint-disable-next-line consistent-return
	return async (req: Request, res: Response & TResponseLocals & TResponseFlagValue, next: NextFunction) => {
		const defaultValue = config?.defaultValue ? config?.defaultValue : false;

		const context = {
			key: res.locals.user.user_id,
			name: `${res.locals.user.given_name} ${res.locals.user.family_name}`,
			email: res.locals.user.email,
			role: res.locals.user.role.code
		};

		const flagValue = await getFlagValue(flag, context, defaultValue);

		if (typeof flagValue === "boolean") {
			if (!flagValue) {
				return res.status(StatusCodes.METHOD_NOT_ALLOWED).send({
					status: "fail",
					message: "This feature has not been enabled.",
					erroCode: ERROR_CODES.NOT_ALLOWED,
					data: {}
				});
			}
		} else {
			// eslint-disable-next-line require-atomic-updates
			res.featureFlagValue = flagValue;
		}

		next();
	};
};
