import { envConfig } from "#configs";
import { logger } from "#helpers/logger";
import axios, { type AxiosError } from "axios";
import { StatusCodes } from "http-status-codes";
import { GeocodingApiError } from "./error";
import { ERROR_CODES } from "#constants/error-codes.constant";

const GOOGLE_MAPS_API_BASE_URL = "https://maps.googleapis.com/maps/api/geocode/json";
const REQUEST_TIMEOUT = 10000; // 10 seconds

export interface GeocodingResponse {
	results: Array<{
		address_components: Array<{
			long_name: string;
			short_name: string;
			types: string[];
		}>;
		formatted_address: string;
		geometry: {
			location: {
				lat: number;
				lng: number;
			};
			location_type: string;
			viewport: {
				northeast: { lat: number; lng: number };
				southwest: { lat: number; lng: number };
			};
			bounds?: {
				northeast: { lat: number; lng: number };
				southwest: { lat: number; lng: number };
			};
		};
		place_id: string;
		types: string[];
	}>;
	status: string;
	error_message?: string;
}

/**
 * Geocoding service for proxying Google Maps Geocoding API requests.
 * 
 * This service exists to:
 * - Hide the Google Maps API key from the frontend (security requirement)
 * - Allow using IP-restricted API keys instead of referer-restricted keys
 * - Centralize geocoding logic and error handling
 * 
 * @remarks
 * The Google Maps Geocoding API does not accept API keys with referer restrictions.
 * This backend proxy allows using IP restrictions or no restrictions, which is more
 * secure for server-side API calls.
 * 
 * Rate limiting and quota management should be handled at the Google Cloud Console level.
 */
class GeocodingService {
	/**
	 * Geocodes an address using Google Maps Geocoding API
	 * 
	 * @param address - The address string to geocode
	 * @returns Promise resolving to the geocoding response
	 * @throws {GeocodingApiError} If geocoding fails due to API errors, network issues, or configuration problems
	 */
	async geocodeAddress(address: string): Promise<GeocodingResponse> {
		const apiKey = envConfig.GOOGLE_MAP_API_KEY;
		
		if (!apiKey) {
			logger.error("GOOGLE_MAP_API_KEY is not configured");
			throw new GeocodingApiError(
				"Geocoding service is not configured",
				StatusCodes.INTERNAL_SERVER_ERROR,
				ERROR_CODES.UNKNOWN_ERROR
			);
		}

		try {
			// Note: API key is passed in query params as per Google Maps API standard.
			const response = await axios.get<GeocodingResponse>(GOOGLE_MAPS_API_BASE_URL, {
				params: {
					address,
					key: apiKey
				},
				timeout: REQUEST_TIMEOUT
			});

			// Check if Google API returned an error status in the response body
			if (response.data.status !== "OK") {
				const errorMessage = response.data.error_message || `Geocoding failed with status: ${response.data.status}`;
				logger.warn({
					status: response.data.status,
					error_message: response.data.error_message,
					address: address.substring(0, 50)
				}, "Google Geocoding API returned error status");

				throw new GeocodingApiError(
					errorMessage,
					StatusCodes.BAD_GATEWAY,
					ERROR_CODES.UNKNOWN_ERROR
				);
			}

			return response.data;
		} catch (error) {
			// Re-throw if it's already a GeocodingApiError
			if (error instanceof GeocodingApiError) {
				throw error;
			}

			if (axios.isAxiosError(error)) {
				this.handleAxiosError(error, address);
			}

			// Unknown error
			logger.error({ error }, "Unexpected geocoding error");
			throw new GeocodingApiError(
				"Failed to geocode address due to an unexpected error",
				StatusCodes.INTERNAL_SERVER_ERROR,
				ERROR_CODES.UNKNOWN_ERROR
			);
		}
	}

	/**
	 * Handles axios-specific errors from the Google Geocoding API
	 */
	private handleAxiosError(error: AxiosError<GeocodingResponse>, address: string): never {
		logger.error({
			message: error.message,
			code: error.code,
			status: error.response?.status,
			address: address.substring(0, 50)
		}, "Geocoding API error");

		if (error.response) {
			// Google API returned an HTTP error response
			const statusCode =
				typeof error.response.status === "number"
					? error.response.status
					: StatusCodes.BAD_GATEWAY;

			const errorMessage =
				error.response.data?.error_message ||
				error.response.data?.status ||
				"Geocoding API returned an error";

			throw new GeocodingApiError(
				errorMessage,
				statusCode,
				ERROR_CODES.UNKNOWN_ERROR
			);
		}

		// Network or timeout error - throw as API error
		let userMessage = "Failed to geocode address due to an unexpected error";
		if (error.code === "ECONNABORTED") {
			userMessage = "Geocoding service timed out while processing the request";
		} else if (error.message && error.message.toLowerCase().includes("network")) {
			userMessage = "Failed to geocode address due to a network error";
		} else if (error.code === "ENOTFOUND" || error.code === "ECONNREFUSED") {
			userMessage = "Failed to connect to geocoding service";
		}

		throw new GeocodingApiError(
			userMessage,
			StatusCodes.BAD_GATEWAY,
			ERROR_CODES.UNKNOWN_ERROR
		);
	}
}

export const geocodingService = new GeocodingService();

