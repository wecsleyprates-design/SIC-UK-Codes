import { TruliooTokenManager } from "../truliooTokenManager";

// Mock TruliooHttpClient first
jest.mock("../truliooHttpClient", () => ({
	TruliooHttpClient: {
		postForm: jest.fn()
	}
}));

// Mock logger
jest.mock("#helpers/logger", () => ({
	logger: {
		error: jest.fn(),
		warn: jest.fn(),
		info: jest.fn(),
		debug: jest.fn()
	}
}));

// Mock Redis
jest.mock("#helpers/redis", () => ({
	redis: {
		get: jest.fn(),
		setex: jest.fn(),
		delete: jest.fn()
	}
}));

// Mock envConfig
jest.mock("#configs", () => ({
	envConfig: {
		TRULIOO_CLIENT_ID: "test-client-id",
		TRULIOO_CLIENT_SECRET: "test-client-secret",
		TRULIOO_AUTH_API: "https://api.test.com/oauth/token"
	}
}));

import { TruliooHttpClient } from "../truliooHttpClient";
import { redis } from "#helpers/redis";

describe("TruliooTokenManager", () => {
	jest.setTimeout(10000); // Increase timeout to 10 seconds

	beforeEach(async () => {
		jest.clearAllMocks();
		// Clear Redis mocks
		(redis.get as jest.Mock).mockResolvedValue(null);
		(redis.setex as jest.Mock).mockResolvedValue(true);
		(redis.delete as jest.Mock).mockResolvedValue(true);
		// Clear any cached tokens
		await TruliooTokenManager.clearToken();
	});

	describe("Token Management", () => {
		it("should request new token successfully", async () => {
			const mockTokenResponse = {
				access_token: "test-access-token",
				token_type: "Bearer",
				expires_in: 3600
			};

			(TruliooHttpClient.postForm as jest.Mock).mockResolvedValue({
				data: mockTokenResponse
			});

			const result = await TruliooTokenManager.requestNewToken();

			expect(result).toEqual(mockTokenResponse);
			expect(TruliooHttpClient.postForm).toHaveBeenCalledWith(
				expect.any(String), // URL from envConfig
				expect.any(URLSearchParams)
			);
		});

		it("should handle token request failure", async () => {
			(TruliooHttpClient.postForm as jest.Mock).mockRejectedValue(new Error("HTTP request failed: 401 Unauthorized"));

			await expect(TruliooTokenManager.requestNewToken()).rejects.toThrow("HTTP request failed: 401 Unauthorized");
		});

		it("should get cached token when valid", async () => {
			const mockTokenResponse = {
				access_token: "test-access-token",
				token_type: "Bearer",
				expires_in: 3600
			};

			// Mock Redis to return cached token and valid expiry
			const futureTime = Date.now() + 3600000; // 1 hour from now
			(redis.get as jest.Mock).mockImplementation((key: string) => {
				if (key === "trulioo:oauth:token") {
					return Promise.resolve(mockTokenResponse);
				} else if (key === "trulioo:oauth:expiry") {
					return Promise.resolve(futureTime);
				}
				return Promise.resolve(null);
			});

			// Get token should return cached token
			const token = await TruliooTokenManager.getAccessToken();

			expect(token).toBe("test-access-token");
			expect(TruliooHttpClient.postForm).not.toHaveBeenCalled(); // Should not make new request
		});

		it("should request new token when cached token is expired", async () => {
			const mockTokenResponse = {
				access_token: "new-access-token",
				token_type: "Bearer",
				expires_in: 3600
			};

			(TruliooHttpClient.postForm as jest.Mock).mockResolvedValue({
				data: mockTokenResponse
			});

			// Manually set an expired token
			const expiredTime = Date.now() - 1000; // 1 second ago
			(redis.get as jest.Mock).mockResolvedValue(expiredTime);

			const token = await TruliooTokenManager.getAccessToken();

			expect(token).toBe("new-access-token");
			expect(TruliooHttpClient.postForm).toHaveBeenCalled();
		});
	});

	describe("Token Status", () => {
		it("should indicate when token needs refresh", async () => {
			// Set expired token
			const expiredTime = Date.now() - 1000;
			(redis.get as jest.Mock).mockResolvedValue(expiredTime);

			expect(await TruliooTokenManager.needsRefresh()).toBe(true);
		});

		it("should indicate when token is still valid", async () => {
			// Set valid token
			const futureTime = Date.now() + 3600000; // 1 hour from now
			(redis.get as jest.Mock).mockResolvedValue(futureTime);

			expect(await TruliooTokenManager.needsRefresh()).toBe(false);
		});

		it("should provide token status information", async () => {
			const status = await TruliooTokenManager.getTokenStatus();

			expect(status).toHaveProperty("hasToken");
			expect(status).toHaveProperty("needsRefresh");
			expect(status).toHaveProperty("expiresAt");
		});
	});

	describe("Token Cleanup", () => {
		it("should clear cached token", async () => {
			// Set a token first
			(redis.get as jest.Mock).mockResolvedValue({
				access_token: "test-token",
				token_type: "Bearer",
				expires_in: 3600
			});

			await TruliooTokenManager.clearToken();

			// After clearing, Redis should return null
			(redis.get as jest.Mock).mockResolvedValue(null);

			expect(redis.delete).toHaveBeenCalledTimes(4); // Should delete both token and expiry keys (called in beforeEach too)
			expect(await TruliooTokenManager.needsRefresh()).toBe(true);
			const status = await TruliooTokenManager.getTokenStatus();
			expect(status.hasToken).toBe(false);
		});
	});

	describe("Error Handling", () => {
		it("should handle network errors during token request", async () => {
			(TruliooHttpClient.postForm as jest.Mock).mockRejectedValue(new Error("Network error"));

			await expect(TruliooTokenManager.requestNewToken()).rejects.toThrow("Network error");
		});

		it("should handle malformed token response", async () => {
			(TruliooHttpClient.postForm as jest.Mock).mockResolvedValue({
				data: { invalid: "response" }
			});

			// The implementation now validates response format, so it should throw an error
			await expect(TruliooTokenManager.requestNewToken()).rejects.toThrow(
				"Invalid token response: missing or empty access_token"
			);
		});

		it("should handle missing access token in response", async () => {
			(TruliooHttpClient.postForm as jest.Mock).mockResolvedValue({
				data: {
					token_type: "Bearer",
					expires_in: 3600
					// Missing access_token
				}
			});

			// The implementation now validates response format, so it should throw an error
			await expect(TruliooTokenManager.requestNewToken()).rejects.toThrow(
				"Invalid token response: missing or empty access_token"
			);
		});
	});

	describe("Token Refresh Logic", () => {
		it("should automatically refresh token when getting expired token", async () => {
			const mockTokenResponse = {
				access_token: "refreshed-token",
				token_type: "Bearer",
				expires_in: 3600
			};

			(TruliooHttpClient.postForm as jest.Mock).mockResolvedValue({
				data: mockTokenResponse
			});

			// Set expired token
			const expiredTime = Date.now() - 1000;
			(redis.get as jest.Mock).mockResolvedValue(expiredTime);

			const token = await TruliooTokenManager.getAccessToken();

			expect(token).toBe("refreshed-token");
			expect(TruliooHttpClient.postForm).toHaveBeenCalled();
		});

		it("should handle refresh failure gracefully", async () => {
			// Set expired token
			const expiredTime = Date.now() - 1000;
			(redis.get as jest.Mock).mockResolvedValue(expiredTime);

			(TruliooHttpClient.postForm as jest.Mock).mockRejectedValue(new Error("Refresh failed"));

			await expect(TruliooTokenManager.getAccessToken()).rejects.toThrow("Refresh failed");
		});
	});

	describe("Concurrent Token Requests", () => {
		it("should handle concurrent token requests", async () => {
			const mockTokenResponse = {
				access_token: "concurrent-token",
				token_type: "Bearer",
				expires_in: 3600
			};

			(TruliooHttpClient.postForm as jest.Mock).mockResolvedValue({
				data: mockTokenResponse
			});

			// Make concurrent requests
			const [token1, token2, token3] = await Promise.all([
				TruliooTokenManager.getAccessToken(),
				TruliooTokenManager.getAccessToken(),
				TruliooTokenManager.getAccessToken()
			]);

			expect(token1).toBe("concurrent-token");
			expect(token2).toBe("concurrent-token");
			expect(token3).toBe("concurrent-token");

			// The implementation doesn't have concurrent request deduplication, so it makes multiple requests
			expect(TruliooHttpClient.postForm).toHaveBeenCalledTimes(3);
		});
	});

	describe("Token Validation", () => {
		it("should validate required token fields", async () => {
			(TruliooHttpClient.postForm as jest.Mock).mockResolvedValue({
				data: {
					token_type: "Bearer",
					expires_in: 3600
					// Missing access_token
				}
			});

			await expect(TruliooTokenManager.getAccessToken()).rejects.toThrow("Invalid token response");
		});

		it("should validate token_type field", async () => {
			(TruliooHttpClient.postForm as jest.Mock).mockResolvedValue({
				data: {
					access_token: "test-token",
					expires_in: 3600
					// Missing token_type
				}
			});

			await expect(TruliooTokenManager.getAccessToken()).rejects.toThrow("Invalid token response");
		});

		it("should validate expires_in field", async () => {
			(TruliooHttpClient.postForm as jest.Mock).mockResolvedValue({
				data: {
					access_token: "test-token",
					token_type: "Bearer"
					// Missing expires_in
				}
			});

			await expect(TruliooTokenManager.getAccessToken()).rejects.toThrow("Invalid token response");
		});

		it("should validate empty access_token", async () => {
			(TruliooHttpClient.postForm as jest.Mock).mockResolvedValue({
				data: {
					access_token: "",
					token_type: "Bearer",
					expires_in: 3600
				}
			});

			await expect(TruliooTokenManager.getAccessToken()).rejects.toThrow("Invalid token response");
		});

		it("should validate invalid expires_in value", async () => {
			(TruliooHttpClient.postForm as jest.Mock).mockResolvedValue({
				data: {
					access_token: "test-token",
					token_type: "Bearer",
					expires_in: 0 // Invalid: should be positive
				}
			});

			await expect(TruliooTokenManager.getAccessToken()).rejects.toThrow("Invalid token response");
		});
	});
});
