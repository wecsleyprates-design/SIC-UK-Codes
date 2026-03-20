import axios from "axios";
import { StatusCodes } from "http-status-codes";
import { logger } from "#helpers/index";
import { ERROR_CODES, httpMethods } from "#constants/index";
import { envConfig } from "#configs/index";
import { pick } from "#utils/index";

class IntegrationDataApiError extends Error {
	constructor(message, httpStatus, errorCode) {
		super(message);
		this.name = "IntegrationDataApiError";
		this.status = httpStatus;
		this.errorCode = errorCode;
	}
}

export { IntegrationDataApiError };

const parseError = error => {
	const parsedError = pick(error.response, ["status", "statusText", "config", "data", "headers"]);
	parsedError.AxiosCode = error.code;
	parsedError.isAxiosError = error.isAxiosError;

	return parsedError;
};

class IntegrationData {
	async call(method, url, data, headers) {
		try {
			const config = {
				method,
				url,
				headers
			};
			if (data) {
				config.data = data;
			}
			const response = await axios(config);
			return response.data;
		} catch (error) {
			if (error.status >= 500) {
				logger.error(parseError(error));
			}

			throw error;
		}
	}

	/**
	 * @param {Object} body
	 * @param {String} body.score_trigger_id Score Trigger ID
	 * @returns {Object} Bank Accounts; Balances, Transactions, and Accounts
	 */
	async getBankAccounts(body) {
		try {
			const integrationServiceURL = `${envConfig.INTEGRATION_SERVICE_BASE_URL}/api/v1/internal/integration-data/banking`;

			const response = await this.call(httpMethods.GET, integrationServiceURL, body);

			return response.data;
		} catch (error) {
			throw new IntegrationDataApiError("getBankAccounts: Something went wrong. Please try again", StatusCodes.INTERNAL_SERVER_ERROR, ERROR_CODES.UNKNOWN_ERROR);
		}
	}

	async getPublicRecords(body) {
		try {
			const integrationServiceURL = `${envConfig.INTEGRATION_SERVICE_BASE_URL}/api/v1/internal/integration-data/public-records`;

			const response = await this.call(httpMethods.GET, integrationServiceURL, body);

			return response.data;
		} catch (error) {
			throw new IntegrationDataApiError("getPublicRecords: Something went wrong. Please try again", StatusCodes.INTERNAL_SERVER_ERROR, ERROR_CODES.UNKNOWN_ERROR);
		}
	}
}

export const integrationData = new IntegrationData();
