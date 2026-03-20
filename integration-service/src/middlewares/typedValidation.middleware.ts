import { Request, Response, NextFunction } from "express";
import { AnyZodObject, ZodEffects, ZodError } from "zod";
import { isNonEmptyArray } from "@austinburns/type-guards";
import { logger } from "#helpers/index";

export const validateTypedSchema = (schema: AnyZodObject) => async (req: Request, res: Response, next: NextFunction) => {
	try {
		await schema.parseAsync({
			body: req.body,
			query: req.query,
			params: req.params,
			file: req.file,
			files: req.files
		});
		return next();
	} catch (error) {
		const typedError = error as ZodError;
		if (isNonEmptyArray(typedError?.issues)) {
			typedError.name = "InvalidSchemaError";
			// Enhanced logging for Trulioo webhook validation failures
			if (req.path?.includes("international-businesses/webhook")) {
				logger.error({
					error: typedError,
					path: req.path,
					body: req.body,
					issues: typedError.issues
				}, "Trulioo webhook: Schema validation failed");
			} else {
				logger.error(typedError);
			}
			return res.status(400).json(typedError);
		}

		return res.status(400).json(error);
	}
};
