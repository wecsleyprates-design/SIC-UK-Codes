import { envConfig } from "#configs/index";
import { ERROR_CODES } from "#constants/index";
import { logger } from "#helpers/index";
import { pick } from "#utils/index";
import axios from "axios";
import { StatusCodes } from "http-status-codes";

class InternalApiError extends Error {
	constructor(message, httpStatus, errorCode) {
		super(message);
		this.name = "InternalApiError";
		this.status = httpStatus;
		this.errorCode = errorCode;
	}
}

const parseError = error => {
	const parsedError = pick(error.response, ["status", "statusText", "config", "data", "headers"]);
	parsedError.AxiosCode = error.code;
	parsedError.isAxiosError = error.isAxiosError;

	return parsedError;
};

export const fetchScoreTriggerID = async body => {
	try {
		const config = {
			method: "get",
			maxBodyLength: Infinity,
			url: `${envConfig.CASE_SERVICE_BASE_URL}/api/v1/internal/risk-alerts/score-trigger-id`,
			headers: {
				"Content-Type": "application/json"
			},
			data: body
		};

		const response = await axios(config);

		const { data } = response.data;
		return data;
	} catch (error) {
		logger.error({ message: `Failed to fetch risk alerts`, body: parseError(error) });
		throw new InternalApiError("fetchScoreTriggerID: Something went wrong. Please try again", StatusCodes.INTERNAL_SERVER_ERROR, ERROR_CODES.UNKNOWN_ERROR);
	}
};

export const internalGetCaseByID = async caseID => {
	try {
		const config = {
			method: "get",
			maxBodyLength: Infinity,
			url: `${envConfig.CASE_SERVICE_BASE_URL}/api/v1/internal/cases/${caseID}`,
			headers: {
				"Content-Type": "application/json"
			}
		};

		const response = await axios(config);
		const { data } = response.data;

		return data;
	} catch (error) {
		logger.error({ message: "Failed to get case details", body: parseError(error) });

		throw new InternalApiError("internalGetCaseByID: Something went wrong. Please try again", StatusCodes.INTERNAL_SERVER_ERROR, ERROR_CODES.UNKNOWN_ERROR);
	}
};

export const internalGetRevenue = async businessId => {
	try {
		const config = {
			method: "get",
			maxBodyLength: Infinity,
			url: `${envConfig.INTEGRATION_SERVICE_BASE_URL}/api/v1/internal/accounting/report/${businessId}/accounting_incomestatement/?groupBy=business`,
			headers: {
				"Content-Type": "application/json"
			}
		};

		const response = await axios(config);
		const { data } = response.data;

		return data;
	} catch (error) {
		logger.error({ message: "Failed to get business revenue", body: parseError(error) });

		throw new InternalApiError("internalGetRevenue: Something went wrong. Please try again", StatusCodes.INTERNAL_SERVER_ERROR, ERROR_CODES.UNKNOWN_ERROR);
	}
};

export const internalGetBusinessEntity = async businessId => {
	try {
		const config = {
			method: "get",
			maxBodyLength: Infinity,
			url: `${envConfig.INTEGRATION_SERVICE_BASE_URL}/api/v1/internal/verification/businesses/${businessId}/business-entity`,
			headers: {
				"Content-Type": "application/json"
			}
		};

		const response = await axios(config);
		const { data } = response.data;

		return data;
	} catch (error) {
		logger.error({ message: "Failed to get business entity", body: parseError(error) });

		throw new InternalApiError("internalGetBusinessEntity: Something went wrong. Please try again", StatusCodes.INTERNAL_SERVER_ERROR, ERROR_CODES.UNKNOWN_ERROR);
	}
};

export const internalGetBusinessDetails = async businessId => {
	try {
		const config = {
			method: "get",
			maxBodyLength: Infinity,
			url: `${envConfig.CASE_SERVICE_BASE_URL}/api/v1/internal/businesses/${businessId}`,
			headers: {
				"Content-Type": "application/json"
			}
		};

		const response = await axios(config);
		const { data } = response.data;

		return data;
	} catch (error) {
		logger.error({ message: "Failed to get business details", body: parseError(error) });

		throw new InternalApiError("internalGetBusinessDetails: Something went wrong. Please try again", StatusCodes.INTERNAL_SERVER_ERROR, ERROR_CODES.UNKNOWN_ERROR);
	}
};
