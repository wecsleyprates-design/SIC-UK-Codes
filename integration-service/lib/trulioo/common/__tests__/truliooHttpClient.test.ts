import { TruliooHttpClient } from "../truliooHttpClient";
import axios, { AxiosError } from "axios";

// Mock axios
jest.mock("axios");
const mockedAxios = axios as jest.MockedFunction<typeof axios>;

// Helper function to create mock axios response
const createMockAxiosResponse = (overrides: any = {}) => ({
	data: { success: true },
	status: 200,
	statusText: "OK",
	headers: {},
	config: {},
	request: {},
	...overrides
});

// Mock logger
jest.mock("#helpers/logger", () => ({
	logger: {
		error: jest.fn(),
		warn: jest.fn(),
		info: jest.fn(),
		debug: jest.fn()
	}
}));

describe("TruliooHttpClient", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe("Timeout Handling", () => {
		it("should handle successful requests within timeout", async () => {
			const mockResponse = createMockAxiosResponse();
			mockedAxios.mockResolvedValue(mockResponse);

			const result = await TruliooHttpClient.fetchWithTimeout("https://api.test.com", {
				method: "GET"
			});

			expect(result).toBe(mockResponse);
			expect(mockedAxios).toHaveBeenCalledWith(
				expect.objectContaining({
					url: "https://api.test.com",
					method: "GET",
					timeout: 30000
				})
			);
		});

		it("should set up timeout mechanism", async () => {
			const mockResponse = createMockAxiosResponse();
			mockedAxios.mockResolvedValue(mockResponse);

			await TruliooHttpClient.fetchWithTimeout("https://api.test.com", {
				method: "GET"
			});

			// Verify that axios was called with timeout configuration
			expect(mockedAxios).toHaveBeenCalledWith(
				expect.objectContaining({
					timeout: 30000
				})
			);
		});

		it("should use default timeout configuration", async () => {
			const mockResponse = createMockAxiosResponse();
			mockedAxios.mockResolvedValue(mockResponse);

			await TruliooHttpClient.fetchWithTimeout("https://api.test.com", {
				method: "GET"
			});

			expect(mockedAxios).toHaveBeenCalledWith(
				expect.objectContaining({
					timeout: 30000
				})
			);
		});
	});

	describe("Request Configuration", () => {
		it("should pass through request options", async () => {
			const mockResponse = createMockAxiosResponse();
			mockedAxios.mockResolvedValue(mockResponse);

			const options = {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				data: { test: "data" }
			};

			await TruliooHttpClient.fetchWithTimeout("https://api.test.com", options);

			expect(mockedAxios).toHaveBeenCalledWith(
				expect.objectContaining({
					url: "https://api.test.com",
					method: "POST",
					headers: { "Content-Type": "application/json" },
					data: { test: "data" },
					timeout: 30000
				})
			);
		});

		it("should handle different HTTP methods", async () => {
			const mockResponse = createMockAxiosResponse();
			mockedAxios.mockResolvedValue(mockResponse);

			const methods = ["GET", "POST", "PUT", "DELETE", "PATCH"];

			for (const method of methods) {
				await TruliooHttpClient.fetchWithTimeout("https://api.test.com", {
					method: method as any
				});

				expect(mockedAxios).toHaveBeenCalledWith(
					expect.objectContaining({
						url: "https://api.test.com",
						method: method,
						timeout: 30000
					})
				);
			}
		});
	});

	describe("Response Handling", () => {
		it("should handle successful responses", async () => {
			const mockResponse = createMockAxiosResponse({
				data: { success: true, data: "test" }
			});
			mockedAxios.mockResolvedValue(mockResponse);

			const result = await TruliooHttpClient.fetchWithTimeout("https://api.test.com", {
				method: "GET"
			});

			expect(result).toBe(mockResponse);
			expect(result.status).toBe(200);
			expect(result.data).toEqual({ success: true, data: "test" });
		});

		it("should handle error responses", async () => {
			const axiosError = new AxiosError("Request failed with status code 400");
			axiosError.response = {
				status: 400,
				statusText: "Bad Request",
				data: { error: "Invalid request" }
			} as any;
			mockedAxios.mockRejectedValue(axiosError);

			await expect(
				TruliooHttpClient.request("https://api.test.com", {
					method: "GET"
				})
			).rejects.toThrow('HTTP request failed: 400 Bad Request - {"error":"Invalid request"}');
		});

		it("should handle network errors", async () => {
			const networkError = new Error("ECONNREFUSED");
			mockedAxios.mockRejectedValue(networkError);

			await expect(
				TruliooHttpClient.fetchWithTimeout("https://api.test.com", {
					method: "GET"
				})
			).rejects.toThrow("ECONNREFUSED");
		});
	});

	describe("Timeout Integration", () => {
		it("should handle timeout errors", async () => {
			const timeoutError = new AxiosError("timeout of 30000ms exceeded");
			timeoutError.code = "ECONNABORTED";
			mockedAxios.mockRejectedValue(timeoutError);

			await expect(
				TruliooHttpClient.fetchWithTimeout("https://api.test.com", {
					method: "GET"
				})
			).rejects.toThrow("Request timeout after 30000ms");
		});

		it("should pass through custom timeout", async () => {
			const mockResponse = createMockAxiosResponse();
			mockedAxios.mockResolvedValue(mockResponse);

			await TruliooHttpClient.fetchWithTimeout("https://api.test.com", {
				method: "GET",
				timeout: 5000
			});

			expect(mockedAxios).toHaveBeenCalledWith(
				expect.objectContaining({
					timeout: 5000
				})
			);
		});

		it("should timeout requests that exceed timeout duration", async () => {
			// Mock axios to simulate a timeout after a delay
			const timeoutError = new AxiosError("timeout of 30000ms exceeded");
			timeoutError.code = "ECONNABORTED";

			// Create a promise that rejects with timeout error after 1 second
			const slowTimeoutResponse = new Promise((_, reject) => setTimeout(() => reject(timeoutError), 1000));
			mockedAxios.mockReturnValue(slowTimeoutResponse);

			await expect(TruliooHttpClient.fetchWithTimeout("https://api.test.com", { method: "GET" })).rejects.toThrow(
				"Request timeout after 30000ms"
			);
		});
	});

	describe("Convenience Methods", () => {
		it("should handle GET requests", async () => {
			const mockResponse = createMockAxiosResponse();
			mockedAxios.mockResolvedValue(mockResponse);

			const result = await TruliooHttpClient.get("https://api.test.com", {
				Authorization: "Bearer token"
			});

			expect(result).toBe(mockResponse);
			expect(mockedAxios).toHaveBeenCalledWith(
				expect.objectContaining({
					url: "https://api.test.com",
					method: "GET",
					headers: expect.objectContaining({ Authorization: "Bearer token" })
				})
			);
		});

		it("should handle POST requests", async () => {
			const mockResponse = createMockAxiosResponse();
			mockedAxios.mockResolvedValue(mockResponse);

			const postData = { test: "data" };
			const result = await TruliooHttpClient.post("https://api.test.com", postData, {
				"Content-Type": "application/json"
			});

			expect(result).toBe(mockResponse);
			expect(mockedAxios).toHaveBeenCalledWith(
				expect.objectContaining({
					url: "https://api.test.com",
					method: "POST",
					headers: expect.objectContaining({ "Content-Type": "application/json" }),
					data: postData
				})
			);
		});

		it("should handle POST form requests", async () => {
			const mockResponse = createMockAxiosResponse();
			mockedAxios.mockResolvedValue(mockResponse);

			const formData = new URLSearchParams();
			formData.append("key", "value");

			const result = await TruliooHttpClient.postForm("https://api.test.com", formData, {
				"Content-Type": "application/x-www-form-urlencoded"
			});

			expect(result).toBe(mockResponse);
			expect(mockedAxios).toHaveBeenCalledWith(
				expect.objectContaining({
					url: "https://api.test.com",
					method: "POST",
					headers: expect.objectContaining({ "Content-Type": "application/x-www-form-urlencoded" }),
					data: "key=value"
				})
			);
		});
	});

	describe("Error Scenarios", () => {
		it("should handle axios rejection", async () => {
			const axiosError = new Error("Axios failed");
			mockedAxios.mockRejectedValue(axiosError);

			await expect(
				TruliooHttpClient.fetchWithTimeout("https://api.test.com", {
					method: "GET"
				})
			).rejects.toThrow("Axios failed");
		});

		it("should handle invalid URLs", async () => {
			const invalidUrl = "not-a-valid-url";
			const axiosError = new Error("Invalid URL");
			mockedAxios.mockRejectedValue(axiosError);

			await expect(
				TruliooHttpClient.fetchWithTimeout(invalidUrl, {
					method: "GET"
				})
			).rejects.toThrow("Invalid URL");
		});

		it("should handle malformed request options", async () => {
			const mockResponse = createMockAxiosResponse();
			mockedAxios.mockResolvedValue(mockResponse);

			// Should handle malformed options gracefully
			await TruliooHttpClient.fetchWithTimeout("https://api.test.com", {
				method: "GET",
				headers: null as any,
				data: undefined
			});

			expect(mockedAxios).toHaveBeenCalled();
		});
	});

	describe("Performance", () => {
		it("should handle concurrent requests", async () => {
			const mockResponse = createMockAxiosResponse();
			mockedAxios.mockResolvedValue(mockResponse);

			const requests = Array.from({ length: 10 }, (_, i) =>
				TruliooHttpClient.fetchWithTimeout(`https://api.test.com/endpoint${i}`, {
					method: "GET"
				})
			);

			const results = await Promise.all(requests);

			expect(results).toHaveLength(10);
			expect(mockedAxios).toHaveBeenCalledTimes(10);
		});

		it("should handle rapid successive requests", async () => {
			const mockResponse = createMockAxiosResponse();
			mockedAxios.mockResolvedValue(mockResponse);

			const startTime = Date.now();

			for (let i = 0; i < 5; i++) {
				await TruliooHttpClient.fetchWithTimeout("https://api.test.com", {
					method: "GET"
				});
			}

			const endTime = Date.now();
			expect(endTime - startTime).toBeLessThan(1000); // Should be fast
		});
	});

	describe("Edge Cases", () => {
		it("should handle empty response body", async () => {
			const mockResponse = createMockAxiosResponse({
				status: 204,
				data: null
			});
			mockedAxios.mockResolvedValue(mockResponse);

			const result = await TruliooHttpClient.fetchWithTimeout("https://api.test.com", {
				method: "DELETE"
			});

			expect(result).toBe(mockResponse);
			expect(result.status).toBe(204);
		});

		it("should handle large response bodies", async () => {
			const largeData = "x".repeat(1000000); // 1MB of data
			const mockResponse = createMockAxiosResponse({
				data: largeData
			});
			mockedAxios.mockResolvedValue(mockResponse);

			const result = await TruliooHttpClient.fetchWithTimeout("https://api.test.com", {
				method: "GET"
			});

			expect(result).toBe(mockResponse);
			expect(result.status).toBe(200);
		});

		it("should handle special characters in URLs", async () => {
			const mockResponse = createMockAxiosResponse();
			mockedAxios.mockResolvedValue(mockResponse);

			const specialUrl = "https://api.test.com/path?param=value&special=@#$%";

			await TruliooHttpClient.fetchWithTimeout(specialUrl, {
				method: "GET"
			});

			expect(mockedAxios).toHaveBeenCalledWith(
				expect.objectContaining({
					url: specialUrl
				})
			);
		});
	});

	describe("Request Method", () => {
		it("should handle generic request method", async () => {
			const mockResponse = createMockAxiosResponse();
			mockedAxios.mockResolvedValue(mockResponse);

			const result = await TruliooHttpClient.request("https://api.test.com", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				data: { update: "data" }
			});

			expect(result).toBe(mockResponse);
			expect(mockedAxios).toHaveBeenCalledWith(
				expect.objectContaining({
					url: "https://api.test.com",
					method: "PUT",
					headers: { "Content-Type": "application/json" },
					data: { update: "data" }
				})
			);
		});
	});
});
