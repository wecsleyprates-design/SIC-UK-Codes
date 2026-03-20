import { envConfig } from "#configs";
import { getConnectionByTaskId, platformFactory } from "#helpers/platformHelper";
import { strategyPlatformFactory } from "#helpers/strategyPlatformFactory";
import { PlaidIdv } from "#lib/plaid/plaidIdv";
import { Rutter, WebhookHandler as RutterWebhookHandler } from "#lib/rutter";
import { IRequestResponse, Response } from "#types/index";
import { catchAsync } from "#utils/catchAsync";
import { Request } from "express";
import { IdentityVerificationGetResponse, IdentityVerificationStatusUpdatedWebhook } from "plaid";
import { logger } from "#helpers";
import { StatusCodes } from "http-status-codes";

export const controller = {
	handleRutter: catchAsync(async (req: Request, res: Response) => {
		const out: { [keyof: string /*connectionId*/]: IRequestResponse } = {};

		const connections = await Rutter.getConnectionsForAccessToken(req.body.access_token);
		for (const connection of connections) {
			if (connection && connection.id) {
				const platform = await platformFactory({ dbConnection: connection });
				const webhookHandler = new RutterWebhookHandler({
					platform,
					request: req,
					platform_id: connection.platform_id,
					connection_id: connection.id,
					business_id: connection.business_id
				});
				out[connection.id] = await webhookHandler.execute();
			}
		}

		return res.jsend.success(out);
	}),
	handlePlaidIdv: catchAsync(async (req: Request, res: Response) => {
		const out: { [keyof: string /*connectionId*/]: IdentityVerificationGetResponse } = {};
		const body = req.body as IdentityVerificationStatusUpdatedWebhook;
		const tasks = await PlaidIdv.getTasksForIdentityVerificationId(body.identity_verification_id);

		/**
		 * The PlaidIdv webhook calls the endpoint for all our environments (prod, staging, dev, local/forwarder).
		 * If the task is not found, it's most likely because it's not for the current environment.
		 * Return early with a 200 to communicate that the webhook was received.
		 * If too many requests are rejected (non-200 responses), Plaid will stop sending webhooks to the endpoint.
		 * https://plaid.com/docs/api/webhooks/#webhook-retries
		 */
		if (!tasks || tasks.length === 0) {
			logger.info(
				{
					identity_verification_id: body.identity_verification_id,
					webhook_environment: body.environment,
					configured_production_environment: envConfig.PLAID_ENV,
					configured_sandbox_environment: envConfig.PLAID_SANDBOX_ENV,
					webhook_type: body.webhook_type,
					webhook_code: body.webhook_code,
					reason: "No tasks found - task likely originated from different environment"
				},
				"Plaid IDV webhook received for unknown identity verification ID"
			);
			return res.status(StatusCodes.OK).json({ message: "Webhook received" });
		}

		for (const task of tasks) {
			const connection = await getConnectionByTaskId(task.id);
			if (connection && connection.id) {
				const platform = await strategyPlatformFactory<PlaidIdv>({ dbConnection: connection });
				const response = await platform.processIdentityVerificationWebhook(task, body.identity_verification_id);
				out[connection.id] = response;
			}
		}
		return res.jsend.success(out);
	})
};
