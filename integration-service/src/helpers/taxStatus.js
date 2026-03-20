import axios from "axios";
import { StatusCodes } from "http-status-codes";
import { ERROR_CODES, httpMethods } from "#constants/index";
import { envConfig } from "#configs/index";
import { logger } from "#helpers/index";
import { s3Utils } from "#utils/index";

class TaxApiError extends Error {
	constructor(message, statusCode, httpStatusCode) {
		super(message);
		this.name = "TaxApiError";
		this.statusCode = statusCode;
		this.httpStatusCode = httpStatusCode;
	}
}

class TaxStatus {
	constructor() {
		this.tokenResponse = null;
	}

	// creating an oauth token
	async _generateAccessToken() {
		try {
			const tokenRequestData = {
				grant_type: "client_credentials",
				client_id: envConfig.TAX_STATUS_CLIENT_ID,
				client_secret: envConfig.TAX_STATUS_CLIENT_SECRET,
				scope: envConfig.TAX_STATUS_SCOPE
			};
			const config = {
				url: envConfig.TAX_STATUS_ACCESS_URL,
				method: httpMethods.POST,
				maxBodyLength: Infinity,
				headers: {
					"Content-Type": "application/x-www-form-urlencoded"
				},
				data: tokenRequestData
			};

			const oauthResponse = await axios.request(config);

			this.tokenResponse = {
				...oauthResponse.data,
				expires_at: Date.now() + oauthResponse.data.expires_in * 1000
			};

			return this.tokenResponse;
		} catch (error) {
			throw new TaxApiError(
				`Something went wrong while generating token, ${error.message}`,
				StatusCodes.INTERNAL_SERVER_ERROR,
				ERROR_CODES.UNKNOWN_ERROR
			);
		}
	}

	// checking whether the token is valid or not
	async _getAccessToken() {
		if (this.tokenResponse && this.tokenResponse.expires_at > Date.now()) {
			return this.tokenResponse.access_token;
		}
		await this._generateAccessToken();

		return this.tokenResponse.access_token;
	}

	async _apiCall(data, endpoint) {
		try {
			const accessToken = await this._getAccessToken();
			logger.info(`TaxStatus accessToken: ${accessToken}`);
			logger.info(`TaxStatus data: ${JSON.stringify(data)}`);

			const config = {
				method: httpMethods.POST,
				maxBodyLength: Infinity,
				url: `${envConfig.TAX_STATUS_BASE_URL}/${endpoint}`,
				headers: {
					euid: envConfig.TAX_STATUS_EUID,
					"Content-Type": "application/json",
					Authorization: `Bearer ${accessToken}`
				},
				data
			};
			// making request to TAX status api
			const response = await axios.request(config);
			logger.info(`TaxStatus response: ${JSON.stringify(response.data)}`);
			logger.info(`TaxStatus status: ${response.status}`);
			return response.data;
		} catch (error) {
			logger.error(
				{
					error: error,
					status: error.response?.status,
					responseData: error.response?.data
				},
				"TaxStatus API error"
			);
			throw new TaxApiError(
				`Something went wrong while getting tax-api, ${error.message}`,
				StatusCodes.INTERNAL_SERVER_ERROR,
				ERROR_CODES.UNKNOWN_ERROR
			);
		}
	}

	/**
	 * This is TAX status helper function creates consent for an applicant
	 * @param {object} data
	 * @returns response-data
	 */
	async send(data, url) {
		try {
			data.companyId = envConfig.TAX_STATUS_COMPANY_ID;

			const response = await this._apiCall(data, url);
			return response;
		} catch (error) {
			logger.error(`error in tax-status API: ${error.message}`);
			throw error;
		}
	}

	/**
	 * Sends data to a specified URL and retrieves tax status code.
	 * @param {Object} data - The data to be sent.
	 * @param {string} url - The URL to send the data to.
	 * @returns {Promise<Object>} - The code data retrieved from the API.
	 * @throws {TaxApiError} - If no data or NAICS code is found.
	 */
	async fetchTranscriptDetails(data, url, callFor = "industry") {
		try {
			data.companyId = envConfig.TAX_STATUS_COMPANY_ID;

			const response = await this._apiCall(data, url);
			if (callFor === "industry") {
				return await s3Utils.getMappedData(response);
			}
			return response;
		} catch (error) {
			logger.error(`error in fetchTranscriptDetails: ${error.message}`);
			return { code: 0, industry: "" };
		}
	}
}

export const taxApi = new TaxStatus();
