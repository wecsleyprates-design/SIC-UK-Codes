import { envConfig } from "#configs";
import { ERROR_CODES, ErrorCode } from "#constants/index";
import { logger } from "#helpers/logger";
import { Plaid } from "#lib/index";
import { decodeToken, verifyPlaidToken } from "#utils/token";
import { StatusCodes } from "http-status-codes";

class PlaidMiddlewareError extends Error {
	status: StatusCodes;
	errorCode: ErrorCode;
	constructor(message: string, httpStatus: StatusCodes, errorCode: ErrorCode) {
		super(message);
		this.name = "PlaidMiddlewareError";
		this.status = httpStatus;
		this.errorCode = errorCode;
	}
}

// Cache for webhook validation keys.
const KEY_CACHE = new Map();

export const validateWebhookRequest = async (req, res, next) => {
	try {
		const token = req.headers["plaid-verification"];
		const plaidEnvironment = req.body.environment;

		/**
		 * Validate webhook environment matches one of our configured Plaid environments.
		 * Since the sandbox environment can be used in production, we need to check both PLAID_ENV and PLAID_SANDBOX_ENV.
		 * If the environment is invalid, return early with a 200 to communicate that the webhook was received.
		 * If too many requests are rejected (non-200 responses), Plaid will stop sending webhooks to the endpoint.
		 * https://plaid.com/docs/api/webhooks/#webhook-retries
		 */
		const configuredEnvironments = [envConfig.PLAID_ENV, envConfig.PLAID_SANDBOX_ENV].filter(Boolean);
		if (plaidEnvironment && !configuredEnvironments.includes(plaidEnvironment)) {
			logger.info(
				{
					identity_verification_id: req.body.identity_verification_id,
					webhook_environment: plaidEnvironment,
					configured_production_environment: envConfig.PLAID_ENV,
					configured_sandbox_environment: envConfig.PLAID_SANDBOX_ENV,
					webhook_type: req.body.webhook_type,
					webhook_code: req.body.webhook_code,
					reason: "Invalid environment"
				},
				`Plaid webhook received for invalid environment`
			);
			return res.status(StatusCodes.OK).json({ message: "Webhook received" });
		}

		if (!token) {
			throw new PlaidMiddlewareError(
				"Plaid Verification header not present",
				StatusCodes.UNAUTHORIZED,
				ERROR_CODES.UNAUTHENTICATED
			);
		}

		const decodedToken = decodeToken(token, { complete: true });
		const currentKeyID = decodedToken.header?.kid;
		if (!currentKeyID) {
			throw new PlaidMiddlewareError(
				"Plaid Verification header not present",
				StatusCodes.UNAUTHORIZED,
				ERROR_CODES.UNAUTHENTICATED
			);
		}
		const cacheKey = `${plaidEnvironment}:${currentKeyID}`;
		if (!KEY_CACHE.has(cacheKey) || KEY_CACHE.get(cacheKey).expired_at <= Date.now()) {
			const plaid = new Plaid(plaidEnvironment);
			const response = await plaid.getWebhookVerificationKey(currentKeyID).catch(err => {
				logger.error({ err }, `Error getting webhook verification key for ${plaidEnvironment} environment`);
				throw new PlaidMiddlewareError(
					`Error getting webhook verification key : ${err.message}`,
					StatusCodes.INTERNAL_SERVER_ERROR,
					ERROR_CODES.UNKNOWN_ERROR
				);
			});
			logger.info(
				{
					identity_verification_id: req.body.identity_verification_id,
					plaid_request_id: response.request_id,
					webhook_type: req.body.webhook_type,
					webhook_code: req.body.webhook_code,
					webhook_environment: plaidEnvironment
				},
				"Successfully fetched Plaid webhook verification key"
			);
			const { key } = response;
			KEY_CACHE.set(cacheKey, key);
		}

		const key = KEY_CACHE.get(cacheKey);
		verifyPlaidToken(token, key);

		return next();
	} catch (error) {
		return next(error);
	}
};
