import type { Request, Response, NextFunction } from "express";
import { verifyVerdataSignature } from "#lib/verdata/signatureUtils";
import { logger } from "#helpers/index";
import { ERROR_CODES, INTEGRATION_ID, TASK_STATUS } from "#constants/index";
import { Verdata as VerdataClass } from "#lib/verdata/verdata";
import type { UUID } from "crypto";
import { StatusCodes } from "http-status-codes";
import type { ErrorCode } from "#constants/error-codes.constant";

/**
 * Custom error class for Verdata webhook verification failures.
 * Follows the same pattern as other middleware errors (e.g., AccessMiddlewareError, PlaidMiddlewareError).
 */
export class VerdataWebhookError extends Error {
	status: StatusCodes;
	errorCode: ErrorCode;

	constructor(message: string, httpStatus: StatusCodes, errorCode: ErrorCode) {
		super(message);
		this.name = "VerdataWebhookError";
		this.status = httpStatus;
		this.errorCode = errorCode;
	}
}

interface TaskValidationResult {
	valid: boolean;
	error?: "MISSING_TASK_ID" | "INVALID_TASK_ID" | "TASK_NOT_FOUND" | "INVALID_PLATFORM" | "TASK_ALREADY_COMPLETED";
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validate that the task_id in the webhook request is valid and exists.
 *
 * @param taskId - The task ID from the query string
 * @returns TaskValidationResult indicating if the task is valid
 */
export async function validateVerdataTask(taskId: string | undefined): Promise<TaskValidationResult> {
	if (!taskId || taskId === "undefined") {
		return { valid: false, error: "MISSING_TASK_ID" };
	}

	if (!UUID_REGEX.test(taskId)) {
		return { valid: false, error: "INVALID_TASK_ID" };
	}

	try {
		const task = await VerdataClass.getEnrichedTask(taskId as UUID);

		if (!task?.id) {
			return { valid: false, error: "TASK_NOT_FOUND" };
		}

		if (task.platform_id !== INTEGRATION_ID.VERDATA) {
			logger.warn({ taskId, platform_id: task.platform_id }, "Task is not a Verdata task");
			return { valid: false, error: "INVALID_PLATFORM" };
		}

		if (task.task_status === TASK_STATUS.SUCCESS) {
			logger.info({ taskId }, "Task already completed, but allowing webhook processing");
		}

		return { valid: true };
	} catch (error) {
		logger.error({ taskId, error }, "Error validating Verdata task");
		return { valid: false, error: "TASK_NOT_FOUND" };
	}
}

/**
 * Middleware to verify Verdata webhook requests.
 * Performs signature verification and task validation.
 * Throws VerdataWebhookError for any validation failures (caught by error middleware).
 *
 * This middleware expects validateSchema(schema.verdataWebhook) to run first,
 * which ensures business_id, task_id (UUIDs), ts, and sig are all present and valid.
 */
export const verifyVerdataWebhookMiddleware = async (req: Request, res: Response, next: NextFunction) => {
	try {
		const { business_id, task_id, ts, sig } = req.query as {
			business_id: string;
			task_id: string;
			ts: string;
			sig: string;
		};

		const signatureResult = verifyVerdataSignature(business_id, task_id, ts, sig);

		if (!signatureResult.valid) {
			logger.warn(
				{
					error: signatureResult.error,
					business_id,
					task_id,
					ip: req.ip,
					"x-forwarded-for": req.headers["x-forwarded-for"]
				},
				"Verdata webhook signature verification failed"
			);

			const isMissingSignature = signatureResult.error === "MISSING_SIGNATURE";
			throw new VerdataWebhookError(
				`Webhook signature verification failed: ${signatureResult.error}`,
				isMissingSignature ? StatusCodes.UNAUTHORIZED : StatusCodes.FORBIDDEN,
				isMissingSignature ? ERROR_CODES.UNAUTHENTICATED : ERROR_CODES.UNAUTHORIZED
			);
		}

		const taskResult = await validateVerdataTask(task_id);

		if (!taskResult.valid) {
			logger.warn(
				{
					error: taskResult.error,
					task_id,
					ip: req.ip
				},
				"Verdata webhook task validation failed"
			);

			throw new VerdataWebhookError(
				`Task validation failed: ${taskResult.error}`,
				StatusCodes.BAD_REQUEST,
				ERROR_CODES.INVALID
			);
		}

		logger.info(
			{
				event: "verdata_webhook_received",
				business_id,
				task_id,
				ip: req.ip,
				signature_valid: true
			},
			"Verdata webhook verified successfully"
		);

		next();
	} catch (error) {
		next(error);
	}
};
