import { envConfig } from "#configs";
import { TruliooHttpClient } from "./truliooHttpClient";
import { OAuthTokenResponse } from "./types";
import { redis } from "#helpers/redis";
import { logger } from "#helpers/logger";

/**
 * Token manager for Trulioo OAuth authentication
 */
export class TruliooTokenManager {
	private static readonly REDIS_TOKEN_KEY = "trulioo:oauth:token";
	private static readonly REDIS_EXPIRY_KEY = "trulioo:oauth:expiry";

	/**
	 * Request a new OAuth token from Trulioo
	 * @returns OAuth token response
	 */
	static async requestNewToken(): Promise<OAuthTokenResponse> {
		const bodyParams = new URLSearchParams();
		bodyParams.append("grant_type", "client_credentials");
		// bodyParams.append("scope", "workflow.studio.api");
		bodyParams.append("client_id", envConfig.TRULIOO_CLIENT_ID!);
		bodyParams.append("client_secret", envConfig.TRULIOO_CLIENT_SECRET!);

		const response = await TruliooHttpClient.postForm(envConfig.TRULIOO_AUTH_API!, bodyParams);

		const tokenData = response.data as OAuthTokenResponse;

		// Validate required token fields
		if (!tokenData.access_token || typeof tokenData.access_token !== "string" || tokenData.access_token.trim() === "") {
			throw new Error("Invalid token response: missing or empty access_token");
		}

		if (!tokenData.token_type || typeof tokenData.token_type !== "string") {
			throw new Error("Invalid token response: missing or invalid token_type");
		}

		if (!tokenData.expires_in || typeof tokenData.expires_in !== "number" || tokenData.expires_in <= 0) {
			throw new Error("Invalid token response: missing or invalid expires_in");
		}

		// Calculate expiry time with 1 minute buffer
		const expiryTime = Date.now() + tokenData.expires_in * 1000 - 60000;

		// Store token and expiry in Redis for multi-pod coordination
		try {
			await redis.setex(TruliooTokenManager.REDIS_TOKEN_KEY, tokenData, tokenData.expires_in - 60);
			await redis.setex(TruliooTokenManager.REDIS_EXPIRY_KEY, expiryTime, tokenData.expires_in - 60);
		} catch (redisError) {
			logger.warn({ redisError }, "Failed to cache Trulioo token in Redis. Proceeding without cache.");
		}

		return tokenData;
	}

	/**
	 * Get access token, requesting new one if needed
	 * @returns Access token string
	 */
	static async getAccessToken(): Promise<string> {
		try {
			// Check if we have a valid cached token in Redis
			const [cachedToken, cachedExpiry] = await Promise.all([
				redis.get<OAuthTokenResponse>(TruliooTokenManager.REDIS_TOKEN_KEY),
				redis.get<number>(TruliooTokenManager.REDIS_EXPIRY_KEY)
			]);

			if (cachedToken && cachedExpiry && Date.now() < cachedExpiry) {
				return cachedToken.access_token;
			}

			// Request new token
			const tokenResp = await TruliooTokenManager.requestNewToken();
			return tokenResp.access_token;
		} catch (error) {
			// If Redis fails, fall back to requesting a new token
			const tokenResp = await TruliooTokenManager.requestNewToken();
			return tokenResp.access_token;
		}
	}

	/**
	 * Check if token needs refresh
	 * @returns true if token needs refresh
	 */
	static async needsRefresh(): Promise<boolean> {
		try {
			const cachedExpiry = await redis.get<number>(TruliooTokenManager.REDIS_EXPIRY_KEY);
			return !cachedExpiry || Date.now() >= cachedExpiry;
		} catch (error) {
			// If Redis fails, assume token needs refresh
			return true;
		}
	}

	/**
	 * Clear cached token (force refresh on next request)
	 */
	static async clearToken(): Promise<void> {
		try {
			await Promise.all([
				redis.delete(TruliooTokenManager.REDIS_TOKEN_KEY),
				redis.delete(TruliooTokenManager.REDIS_EXPIRY_KEY)
			]);
		} catch (error) {
			// If Redis fails, continue - token will be refreshed on next request
		}
	}

	/**
	 * Get token status for monitoring
	 */
	static async getTokenStatus() {
		try {
			const [cachedToken, cachedExpiry] = await Promise.all([
				redis.get<OAuthTokenResponse>(TruliooTokenManager.REDIS_TOKEN_KEY),
				redis.get<number>(TruliooTokenManager.REDIS_EXPIRY_KEY)
			]);

			return {
				hasToken: !!cachedToken,
				expiresAt: cachedExpiry ? new Date(cachedExpiry).toISOString() : null,
				needsRefresh: !cachedExpiry || Date.now() >= cachedExpiry
			};
		} catch (error) {
			return {
				hasToken: false,
				expiresAt: null,
				needsRefresh: true,
				error: "Redis connection failed"
			};
		}
	}
}
