/**
 * Base GIACT Strategy Implementation
 * Provides common functionality for production and sandbox GIACT integrations
 */

import { envConfig } from "#configs/env.config";
import { GiactApiError } from "#helpers/errorUtils";
import axios, { AxiosError } from "axios";
import { StatusCodes } from "http-status-codes";
import { ERROR_CODES } from "#constants/index";
import type { ServiceRequest, GIACTResponse, IGiactStrategy } from "#lib/giact/types";
import { createStrategyLogger, type StrategyLogger } from "#helpers";
import { GIACT_API_PATHS, GIACT_SERVICE_FLAGS } from "../giact.constants";
import type { CustomerIntegrationSettingsSettingsData } from "#api/v1/modules/customer-integration-settings/types";

export type GiactMode = "PRODUCTION" | "SANDBOX" | "MOCK";

export abstract class GiactBaseStrategy implements IGiactStrategy {
	protected readonly apiEndpoint: string;
	protected readonly username: string;
	protected readonly password: string;
	protected readonly customerSettings: CustomerIntegrationSettingsSettingsData | null;
	private logger: StrategyLogger;

	constructor(
		apiEndpoint: string,
		username: string,
		password: string,
		customerSettings?: CustomerIntegrationSettingsSettingsData | null
	) {
		this.apiEndpoint = apiEndpoint;
		this.username = username;
		this.password = password;
		this.customerSettings = customerSettings || null;
		this.logger = createStrategyLogger("GIACT", this.getMode());
	}

	abstract getMode(): GiactMode;

	isAvailable(): boolean {
		return !!(this.apiEndpoint && this.username && this.password);
	}

	async verifyAccount(request: ServiceRequest): Promise<GIACTResponse> {
		this.logger.debug(
			`Processing GIACT verify request ${JSON.stringify({ requestId: request.UniqueId, accountNumber: request.BankAccountEntity?.AccountNumber?.slice(-4), routingNumber: request.BankAccountEntity?.RoutingNumber, serviceType: "verify" })}`
		);
		const verifyRequest = {
			...request,
			ServiceFlags: [GIACT_SERVICE_FLAGS.VERIFY]
		};
		const response = await this.callGiactAPI(verifyRequest);
		this.logger.debug(
			`GIACT verify request completed ${JSON.stringify({ requestId: request.UniqueId, verificationResult: response?.VerificationResult, responseCode: response?.AccountVerificationResult?.ResponseCode })}`
		);
		return response;
	}

	async authenticateAccount(request: ServiceRequest): Promise<GIACTResponse> {
		this.logger.debug(
			`Processing GIACT authenticate request ${JSON.stringify({ requestId: request.UniqueId, accountNumber: request.BankAccountEntity?.AccountNumber?.slice(-4), routingNumber: request.BankAccountEntity?.RoutingNumber, serviceType: "authenticate" })}`
		);
		const authRequest = {
			...request,
			ServiceFlags: [GIACT_SERVICE_FLAGS.VERIFY, GIACT_SERVICE_FLAGS.AUTHENTICATE]
		};
		const response = await this.callGiactAPI(authRequest);
		this.logger.debug(
			`GIACT authenticate request completed ${JSON.stringify({ requestId: request.UniqueId, verificationResult: response?.VerificationResult, responseCode: response?.AccountVerificationResult?.ResponseCode })}`
		);
		return response;
	}

	/**
	 * Executes API call to GIACT verification services
	 * @param requestData - Service request payload
	 * @returns Promise resolving to GIACT API response
	 */
	protected async callGiactAPI(requestData: ServiceRequest): Promise<GIACTResponse> {
		try {
			const authHeader = "Basic " + Buffer.from(`${this.username}:${this.password}`).toString("base64");

			const response = await axios.post(`${this.apiEndpoint}${GIACT_API_PATHS.VERIFICATION_SERVICES}`, requestData, {
				maxBodyLength: Infinity,
				headers: {
					"Content-Type": "application/json",
					Authorization: authHeader
				}
			});

			this.logger.debug(
				`GIACT API response received ${JSON.stringify({ requestId: requestData.UniqueId, statusCode: response.status, verificationResult: response.data?.VerificationResult })}`
			);

			return response.data;
		} catch (error: any) {
			this.logger.error(
				`GIACT API call failed ${JSON.stringify({ requestId: requestData.UniqueId, error: error.message, endpoint: this.apiEndpoint, statusCode: error instanceof AxiosError ? error.response?.status : undefined })}`
			);

			const status =
				error instanceof AxiosError
					? error.response?.status || StatusCodes.INTERNAL_SERVER_ERROR
					: StatusCodes.INTERNAL_SERVER_ERROR;
			const errorMessage = error instanceof AxiosError ? error.response?.data?.message || error.message : error.message;
			const message = `GIACT ${this.getMode()} API call failed: ${status} - ${errorMessage}`;
			throw new GiactApiError(message, status, ERROR_CODES.UNKNOWN_ERROR);
		}
	}
}
