import { Request, Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";
import { getFlagValue } from "#helpers/LaunchDarkly";
import { IFlagConfig, TResponseFlagValue, TResponseLocals } from "#types/common";
import { ERROR_CODES } from "#constants";
import { type LDContext } from "@launchdarkly/node-server-sdk";

export const validateFeatureFlag = (flag: string, config?: IFlagConfig) => {
	 
	return async (req: Request, res: Response & TResponseLocals & TResponseFlagValue, next: NextFunction) => {
		try {
			const defaultValue = config && config?.defaultValue ? config?.defaultValue : false;

			let context: LDContext | null = null;
			if (res.locals?.user) {
				context = {
					key: res.locals.user.user_id,
					name: `${res.locals.user.given_name} ${res.locals.user.family_name}`,
					email: res.locals.user.email,
					role: res.locals.user.role.code
				};
			}

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
				res.featureFlagValue = flagValue;
			}

			return next();
		} catch (error) {
			throw error;
		}
	};
};
