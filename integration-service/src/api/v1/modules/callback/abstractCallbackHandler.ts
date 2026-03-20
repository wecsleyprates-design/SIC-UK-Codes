import { ERROR_CODES, IntegrationPlatformId } from "#constants";
import { db } from "#helpers/knex";
import { logger } from "#helpers/logger";
import { IRequestResponse } from "#types";
import { UUID } from "crypto";
import { Request } from "express";
import { StatusCodes } from "http-status-codes";
import { CallbackHandlerError } from "./error";

/* 
    This handles **incoming** webhook (or other sort of callback mechanism) requests
Use of this class expectation: 
    You'll define a route that is mapped to the specific implementation for your platform(s)
	You'll need to define an async process() method that looks at this.body or this.request 
*/

interface ICallbackHandler {
	execute(): void;
	validateSignature(): boolean;
	process();
	error({ response, error }: { response?: any; error?: any });
	saveRequest(request: Request);
}
type AbstractCallHandlerConstructor = {
	request: Request;
	platform: any;
	platform_id?: IntegrationPlatformId;
	connection_id: UUID;
	business_id: UUID;
};
export class AbstractCallbackHandler implements ICallbackHandler {
	//Reference to the platform handler class if defined
	protected platform?: any;
	protected request: Request;
	protected connection_id: UUID;
	protected business_id: UUID;
	protected platform_id?: IntegrationPlatformId;
	protected body: Request["body"];

	public constructor({ request, platform, platform_id, connection_id, business_id }) {
		this.request = request;
		this.body = request.body;
		this.platform = platform;
		this.connection_id = connection_id;
		this.business_id = business_id;
		this.platform_id = platform_id;
	}

	/**
	 * Validate that request has been properly signed
	 * @returns true when valid
	 */
	validateSignature(): boolean {
		throw new Error("Method not implemented.");
	}
	/**
	 * Processes the webhook -- calls error() if it cannot finish
	 */
	process() {
		throw new Error("process Method not implemented.");
	}
	/* Should call await execute() in implementing methods */
	async execute() {
		if (this.validateSignature()) {
			try {
				this.process();
			} catch (ex) {
				this.error(ex);
			}
		} else {
			throw new CallbackHandlerError("Signature validation failed", this.request, StatusCodes.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED);
		}
		return await this.saveRequest();
	}
	error(error?) {
		if (error) {
			logger.error("Error detected in callback handler");
			logger.error(error);
		}
		throw new Error(error || "an unhandled error has occured");
	}
	async saveRequest(): Promise<IRequestResponse> {
		const out = await db<IRequestResponse>("integration_data.request_response")
			.insert({
				connection_id: this.connection_id,
				business_id: this.business_id,
				platform_id: this.platform_id || null,
				request_type: this.body.type,
				request_code: this.body.code,
				response: this.body as any
			})
			.returning("*");
		if (out && Array.isArray(out)) {
			return out[0];
		}
		throw new CallbackHandlerError("Could not save response");
	}
}
