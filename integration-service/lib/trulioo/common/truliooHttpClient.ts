import axios, { AxiosRequestConfig, AxiosResponse, AxiosError } from "axios";
import { logger } from "#helpers/logger";
import { VerificationApiError } from "#api/v1/modules/verification/error";
import { StatusCodes } from "http-status-codes";
import { ERROR_CODES } from "#constants";

/**
 * HTTP client for Trulioo API calls with timeout and error handling
 */
export class TruliooHttpClient {
	private static readonly TIMEOUT_CONFIG = {
		requestTimeout: 30000 // 30 seconds timeout for API calls
	};

	/**
	 * Add timeout to axios requests
	 * @param url - Request URL
	 * @param options - Axios options
	 * @returns Promise with timeout
	 */
	static async fetchWithTimeout(url: string, options: AxiosRequestConfig = {}): Promise<AxiosResponse> {
		try {
			const response = await axios({
				url,
				timeout: TruliooHttpClient.TIMEOUT_CONFIG.requestTimeout,
				...options
			});
			return response;
		} catch (error: unknown) {
			if (error instanceof AxiosError && error.code === "ECONNABORTED") {
				throw new VerificationApiError(
					`Request timeout after ${TruliooHttpClient.TIMEOUT_CONFIG.requestTimeout}ms`,
					StatusCodes.REQUEST_TIMEOUT,
					ERROR_CODES.UNKNOWN_ERROR
				);
			}
			throw error;
		}
	}

	/**
	 * Make HTTP request with proper error handling
	 * @param url - Request URL
	 * @param options - Axios options
	 * @returns Promise with response
	 */
	static async request(url: string, options: AxiosRequestConfig = {}): Promise<AxiosResponse> {
		try {
			const response = await TruliooHttpClient.fetchWithTimeout(url, options);
			return response;
		} catch (error: unknown) {
			if (error instanceof AxiosError) {
				const status = error.response?.status || 500;
				const statusText = error.response?.statusText || "HTTP Error";
				const errorBody = error.response?.data || error.message || "Unknown error";
				const errorMessage = typeof errorBody === "object" ? JSON.stringify(errorBody) : String(errorBody);
				throw new VerificationApiError(
					`HTTP request failed: ${status} ${statusText} - ${errorMessage}`,
					status,
					ERROR_CODES.INVALID
				);
			}
			throw error;
		}
	}

	/**
	 * Make GET request
	 * @param url - Request URL
	 * @param headers - Optional headers
	 * @returns Promise with response
	 */
	static async get(url: string, headers: Record<string, string> = {}): Promise<AxiosResponse> {
		return TruliooHttpClient.request(url, {
			method: "GET",
			headers: {
				Accept: "application/json",
				...headers
			}
		});
	}

	/**
	 * Make POST request
	 * @param url - Request URL
	 * @param data - Request body
	 * @param headers - Optional headers
	 * @returns Promise with response
	 */
	static async post(url: string, data: unknown, headers: Record<string, string> = {}): Promise<AxiosResponse> {
		return TruliooHttpClient.request(url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				...headers
			},
			data: data
		});
	}

	/**
	 * Make POST request with form data
	 * @param url - Request URL
	 * @param formData - Form data
	 * @param headers - Optional headers
	 * @returns Promise with response
	 */
	static async postForm(
		url: string,
		formData: URLSearchParams,
		headers: Record<string, string> = {}
	): Promise<AxiosResponse> {
		return TruliooHttpClient.request(url, {
			method: "POST",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
				...headers
			},
			data: formData.toString()
		});
	}
}
