/**
 * Base KYX Strategy Implementation
 * Provides common functionality for production and sandbox KYX integrations
 */

import { redis } from "#helpers/redis";
import axios from "axios";
import { StatusCodes } from "http-status-codes";
import type {
	StrategyConfig,
	KYXVerificationResponse,
	IKyxStrategy,
	KYXVerificationRequest,
	KYXVerificationOptions,
	KYXUserBody
} from "../types";
import { createStrategyLogger, type StrategyLogger } from "#helpers";
import { KYXUtil } from "../utils";
import { KyxError } from "../kyxError";
import { ERROR_CODES } from "#constants";

export type KyxMode = "PRODUCTION" | "SANDBOX" | "MOCK";

export abstract class KyxBaseStrategy implements IKyxStrategy {
	protected readonly strategyConfig: StrategyConfig;
	private logger: StrategyLogger;
	private static readonly ACCESS_TOKEN_KEY = "kyx:access_token";

	constructor(strategyConfig: StrategyConfig) {
		this.strategyConfig = strategyConfig;
		this.logger = createStrategyLogger("KYX", this.getMode());
	}

	abstract getMode(): KyxMode;

	isAvailable(): boolean {
		const { baseUrl, tenantName, clientId, clientSecret } = this.strategyConfig;
		return !!(baseUrl && tenantName && clientId && clientSecret);
	}

	async getAccessToken(): Promise<string> {
		try {
			const cacheKey = `${KyxBaseStrategy.ACCESS_TOKEN_KEY}:${this.getMode()}`;
			const token = (await redis.get(cacheKey)) as unknown as string;
			if (token) {
				this.logger.info("KYX: Using cached access token");
				return token;
			}

			const { baseUrl, tenantName, clientId, clientSecret } = this.strategyConfig;
			const path = `${baseUrl}/v2/token`;
			const headers = { "Content-Type": "application/json" };

			const response = await axios.post<{ token_type: string; access_token: string; expires_in: number }>(
				path,
				{
					tenantName,
					clientId,
					clientSecret
				},
				{
					headers
				}
			);

			if (response && response.data && response.data.access_token) {
				const expiresIn = response.data.expires_in - 5; // 5 second buffer
				redis.setex(cacheKey, response.data.access_token, expiresIn);

				this.logger.info("KYX: Access token obtained successfully");

				return response.data.access_token;
			}
			throw new Error("KYX: API did not return a valid access token");
		} catch (error) {
			this.logger.error(
				`KYX: Failed to get KYX access token ${JSON.stringify({ mode: this.getMode(), error: error instanceof Error ? error.message : "Unknown error" })}`
			);
			throw error;
		}
	}

	async verifyIdentity(body: KYXUserBody, options?: KYXVerificationOptions): Promise<KYXVerificationResponse | any> {
		try {
			// Get access token
			const accessToken = await this.getAccessToken();

			// Prepare verification request data
			const verificationRequest = await new KYXUtil().getRequestPayload(body, options);

			// Make the verification request to KYX /v2/verify endpoint
			const response = await this.callKyxAPI(verificationRequest, accessToken);

			return response;
		} catch (error) {
			// Handle axios errors specifically
			if (axios.isAxiosError(error)) {
				const statusCode = error.response?.status;
				const errorData = error.response?.data;

				this.logger.error(`KYX: verifyIdentity API error ${JSON.stringify({ mode: this.getMode(), statusCode, errorData })}`);
				return errorData;
			}

			// Handle other errors
			throw new KyxError(
				error instanceof Error ? error.message : "Unknown error occurred",
				undefined,
				StatusCodes.INTERNAL_SERVER_ERROR,
				ERROR_CODES.UNKNOWN_ERROR
			);
		}
	}

	/**
	 * Executes API call to KYX verification services
	 * @param requestData - Verification request payload
	 * @param accessToken - Access token for authentication
	 * @returns Promise resolving to KYX API response
	 */
	protected async callKyxAPI(
		requestData: KYXVerificationRequest,
		accessToken: string
	): Promise<KYXVerificationResponse | any> {
		this.logger.info("KYX: Calling KYX API");
		try {
			const { baseUrl } = this.strategyConfig;
			const verifyUrl = `${baseUrl}/v2/verify`;

			const headers = {
				"Content-Type": "application/json",
				Authorization: `Bearer ${accessToken}`,
				Accept: "application/json"
			};

			const response = await axios.post<KYXVerificationResponse>(verifyUrl, requestData, { headers });
			this.logger.info("KYX: Successfully called KYX API");
			return response.data;
		} catch (error) {
			// Handle axios errors specifically
			if (axios.isAxiosError(error)) {
				const statusCode = error.response?.status;
				const errorData = error.response?.data;

				this.logger.error("KYX: API error", { error, mode: this.getMode(), statusCode, errorData });
				return errorData;
			}

			// Handle other errors
			throw new KyxError(
				error instanceof Error ? error.message : "Unknown error occurred",
				undefined,
				StatusCodes.INTERNAL_SERVER_ERROR,
				ERROR_CODES.UNKNOWN_ERROR
			);
		}
	}
}