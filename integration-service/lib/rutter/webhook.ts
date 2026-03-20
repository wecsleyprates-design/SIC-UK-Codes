import { AbstractCallbackHandler } from "#api/v1/modules/callback/abstractCallbackHandler";
import { CallbackHandlerError } from "#api/v1/modules/callback/error";
import { envConfig } from "#configs/env.config";
import { CONNECTION_STATUS } from "#constants/integrations.constant";
import { logger } from "#helpers/logger";
import { Rutter } from "./rutter";
import { WebhookBody } from "./types";
import enc = require("crypto-js/enc-base64");
import hmacSHA256 = require("crypto-js/hmac-sha256");

interface IGenericResponse {
	data: any;
	message: string;
}

export class WebhookHandler extends AbstractCallbackHandler {
	declare platform: Rutter;
	declare body: WebhookBody;

	public constructor({ request, platform, platform_id, connection_id, business_id }) {
		super({ request, platform, platform_id, connection_id, business_id });
		this.body = request.body;
	}

	public async process() {
		if (!this.platform) {
			logger.error("Connection not found for hook");
			throw new CallbackHandlerError("Connection not found for hook", this.body.access_token);
		}
		if (this.body.type == "CONNECTION") {
			switch (this.body.code) {
				case "INITIAL_UPDATE":
					this.platform.initialUpdate(this.body);
					break;
				case "CONNECTION_NEEDS_UPDATE":
					// we need to handle CONNECTION_DISABLED
					this.platform.updateConnectionStatus(CONNECTION_STATUS.CREATED);
					break;
				default:
					// bug-fix: handle CONNECTION_UPDATED(Bloating fix)
					logger.warn(`CONNECTION hook detected without a handler: code=${this.body.code}`);
			}
		} else {
			this.platform.callbackHandler(this.body);
			logger.info("Hook processed");
		}
	}

	/**
	 * Validate that request has been properly signed
	 * @returns true when valid
	 */
	public validateSignature(): boolean {
		const { RUTTER_SECRET } = envConfig;

		const providedSignature = this.request.headers["x-rutter-signature"];
		if (!providedSignature) {
			logger.warn(this.request, "No signature header passed with request");
			return false;
		}

		const hash = hmacSHA256(JSON.stringify(this.request.body), RUTTER_SECRET);
		const hashInBase64 = enc.stringify(hash);
		const calculatedSignature = "sha256=" + hashInBase64;

		return calculatedSignature === providedSignature;
	}
}
