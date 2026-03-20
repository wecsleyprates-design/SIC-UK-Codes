import { envConfig } from "#configs/index";
import { ERROR_CODES, GiactVerificationStatus, IdvStatus, INTEGRATION_ID } from "#constants/index";
import { logger } from "#helpers/index";
import { pick } from "#utils/index";
import axios, { AxiosError, type AxiosRequestConfig } from "axios";
import type { UUID } from "crypto";
import { StatusCodes } from "http-status-codes";
import LRUCache from "lru-cache";
import { ROLE_ID } from "#constants/roles.constant";
import { AccountingStatementData, ProcessingHistoryData } from "src/api/v1/modules/businesses/types";
export interface NpiTaskResponse {
	id?: string;
	connection_id?: string;
	integration_task_id?: number;
	business_score_trigger_id?: string | null;
	task_status?: "SUCCESS" | "FAILED" | "PENDING"; // Assuming possible statuses
	reference_id?: string;
	metadata?: { npiId?: string };
	created_at?: string; // Consider using `Date` if you'll parse it
	updated_at?: string;
	business_id?: string;
	platform_id?: number;
	task_code?: string;
	task_label?: string;
	platform_category_code?: string;
	platform_code?: string;
	trigger_type?: string | null;
	trigger_version?: string | null;
}

class InternalApiError extends Error {
	public status: StatusCodes;
	public errorCode: ERROR_CODES;
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

export const getApplicantByID = async (applicantID, authorization?: string) => {
	const headers: Record<string, string> = { "Content-Type": "application/json" };
	// Add authorization header only if it's defined
	if (authorization) {
		headers["authorization"] = authorization;
	}

	try {
		const config: AxiosRequestConfig = {
			method: "get",
			maxBodyLength: Infinity,
			url: `${envConfig.AUTH_BASE_URL}/api/v1/internal/applicants/${applicantID}`,
			headers,
			data: {}
		};

		const response = await axios(config);
		const { data } = response.data;

		return data;
	} catch (error) {
		if (error instanceof AxiosError && error?.response?.data?.message === "Applicant not found") {
			logger.error({ message: "Applicant not found", body: parseError(error) });

			throw new InternalApiError("Applicant not found", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
		}

		logger.error({ message: "Failed to get applicant data", body: parseError(error) });

		throw new InternalApiError(
			"Something went wrong. Please try again",
			StatusCodes.INTERNAL_SERVER_ERROR,
			ERROR_CODES.UNKNOWN_ERROR
		);
	}
};

export const getApplicants = async (body, authorization?: string) => {
	const headers: Record<string, string> = { "Content-Type": "application/json" };
	// Add authorization header only if it's defined
	if (authorization) {
		headers["authorization"] = authorization;
	}
	try {
		const config: AxiosRequestConfig = {
			method: "get",
			maxBodyLength: Infinity,
			url: `${envConfig.AUTH_BASE_URL}/api/v1/internal/applicants`,
			headers,
			data: body
		};

		const response = await axios(config);
		const { data } = response.data;

		return data.records;
	} catch (error) {
		logger.error({ message: "Failed to get applicants data", body: parseError(error) });

		throw new InternalApiError(
			"getApplicants: Something went wrong. Please try again",
			StatusCodes.INTERNAL_SERVER_ERROR,
			ERROR_CODES.UNKNOWN_ERROR
		);
	}
};

type Applicant = {
	id: UUID;
	first_name: string;
	last_name: string;
	email: string;
	mobile: string;
	subrole_id: UUID;
	code: "standalone_applicant" | "owner" | "applicant" | "user";
	status: "ACTIVE" | "INACTIVE";
};

export const getBusinessApplicants = async (
	businessID: UUID | string,
	authorization?: string
): Promise<Applicant[]> => {
	const headers: Record<string, string> = { "Content-Type": "application/json" };
	// Add authorization header only if it's defined
	if (authorization) {
		headers["authorization"] = authorization;
	}
	try {
		const config: AxiosRequestConfig = {
			method: "get",
			maxBodyLength: Infinity,
			url: `${envConfig.AUTH_BASE_URL}/api/v1/internal/businesses/${businessID}/applicants`,
			headers
		};

		const response = await axios(config);
		const { data } = response.data;

		return data;
	} catch (error) {
		logger.error({ message: "Failed to get applicants data", body: parseError(error) });

		throw new InternalApiError(
			"Something went wrong. Please try again",
			StatusCodes.INTERNAL_SERVER_ERROR,
			ERROR_CODES.UNKNOWN_ERROR
		);
	}
};

export const upsertBusinessOwnerApplicant = async (userID, businessID) => {
	try {
		const config = {
			method: "put",
			maxBodyLength: Infinity,
			url: `${envConfig.AUTH_BASE_URL}/api/v1/internal/businesses/${businessID}/owner/${userID}`,
			headers: { "Content-Type": "application/json" }
		};

		const response = await axios(config);
		const { data } = response.data;

		return data;
	} catch (error) {
		logger.error({ message: "Failed to update business owner", body: parseError(error) });

		throw new InternalApiError(
			"Something went wrong. Please try again",
			StatusCodes.INTERNAL_SERVER_ERROR,
			ERROR_CODES.UNKNOWN_ERROR
		);
	}
};

export const getCustomers = async (body, authorization) => {
	try {
		const config = {
			method: "get",
			maxBodyLength: Infinity,
			url: `${envConfig.AUTH_BASE_URL}/api/v1/customers`,
			headers: { "Content-Type": "application/json", authorization },
			data: body
		};

		const response = await axios(config);
		const { data } = response.data;

		return data;
	} catch (error) {
		logger.error({ message: "Failed to get customers data", body: parseError(error) });

		throw new InternalApiError(
			"Something went wrong. Please try again",
			StatusCodes.INTERNAL_SERVER_ERROR,
			ERROR_CODES.UNKNOWN_ERROR
		);
	}
};

export const getCustomerUsers = async (body, params, authorization) => {
	try {
		const config = {
			method: "get",
			maxBodyLength: Infinity,
			url: `${envConfig.AUTH_BASE_URL}/api/v1/customers/${params.customerID}/users`,
			headers: { "Content-Type": "application/json", authorization },
			data: body
		};

		const response = await axios(config);
		const { data } = response.data;

		return data;
	} catch (error) {
		logger.error({ message: "getCustomerUsers: Failed to get customer users data", body: parseError(error) });

		throw new InternalApiError(
			"Something went wrong. Please try again",
			StatusCodes.INTERNAL_SERVER_ERROR,
			ERROR_CODES.UNKNOWN_ERROR
		);
	}
};

export const emailExists = async (body, authorization = "") => {
	try {
		const config = {
			method: "post",
			maxBodyLength: Infinity,
			url: `${envConfig.AUTH_BASE_URL}/api/v1/auth/email-exists`,
			headers: { "Content-Type": "application/json", authorization },
			data: body
		};
		const response = await axios(config);
		const { data } = response.data;

		return data;
	} catch (error) {
		logger.error({ message: "Something went wrong while checking emailExists", body: parseError(error) });

		throw new InternalApiError(
			"Something went wrong. Please try again",
			StatusCodes.INTERNAL_SERVER_ERROR,
			ERROR_CODES.UNKNOWN_ERROR
		);
	}
};

export const getCustomersInternal = async body => {
	try {
		const config = {
			method: "get",
			maxBodyLength: Infinity,
			url: `${envConfig.AUTH_BASE_URL}/api/v1/internal/customers`,
			headers: { "Content-Type": "application/json" },
			data: body
		};

		const response = await axios(config);
		const { data } = response.data;

		return data;
	} catch (error) {
		logger.error({ message: "Failed to get customes data", body: parseError(error) });

		throw new InternalApiError(
			"getCustomersInternal : Something went wrong while fetching customers data. Please try again",
			StatusCodes.INTERNAL_SERVER_ERROR,
			ERROR_CODES.UNKNOWN_ERROR
		);
	}
};

export const getBusinessIntegrationConnections = async (businessID, body, caseID?) => {
	try {
		const url = caseID
			? `${envConfig.INTEGRATION_BASE_URL}/api/v1/internal/businesses/${businessID}/integrations/${caseID}`
			: `${envConfig.INTEGRATION_BASE_URL}/api/v1/internal/businesses/${businessID}/integrations`;
		const config = {
			method: "get",
			maxBodyLength: Infinity,
			url: url,
			headers: { "Content-Type": "application/json" },
			data: body
		};

		const response = await axios(config);
		const { data } = response.data;

		return data;
	} catch (error) {
		logger.error({ message: "Something went wrong while fetching connections", body: parseError(error) });

		throw new InternalApiError(
			"getBusinessIntegrationConnections : Something went wrong. Please try again",
			StatusCodes.INTERNAL_SERVER_ERROR,
			ERROR_CODES.UNKNOWN_ERROR
		);
	}
};

export const dispatchSynchronousStateUpdate = async (
	businessId: string | UUID,
	body: Record<string, any>
): Promise<any> => {
	try {
		const config = {
			method: "post",
			maxBodyLength: Infinity,
			url: `${envConfig.INTEGRATION_BASE_URL}/api/v1/internal/businesses/${businessId}/synchronous-state-update`,
			headers: { "Content-Type": "application/json" },
			data: body
		};

		const response = await axios(config);
		const { data } = response.data ?? response;

		return data;
	} catch (error) {
		logger.error({
			message: `Failed to dispatch synchronous state update for ${businessId}`,
			body: parseError(error)
		});

		throw new InternalApiError(
			"dispatchSynchronousStateUpdate: Something went wrong. Please try again",
			StatusCodes.INTERNAL_SERVER_ERROR,
			ERROR_CODES.UNKNOWN_ERROR
		);
	}
};

export const submitBusinessEntityForSerpSearch = async (businessID, body) => {
	try {
		const config = {
			method: "post",
			maxBodyLength: Infinity,
			url: `${envConfig.INTEGRATION_BASE_URL}/api/v1/internal/businesses/${businessID}/search-business-details`,
			headers: { "Content-Type": "application/json" },
			data: body
		};

		const response = await axios(config);
		const { data } = response.data;

		return data;
	} catch (error) {
		logger.error({
			message: "Something went wrong while submitting business entity for serp",
			body: parseError(error)
		});

		if (error instanceof AxiosError) {
			throw new InternalApiError(
				`submitBusinessEntityForSerpSearch : Something went wrong. Please try again. ${error.response?.data?.message}`,
				StatusCodes.INTERNAL_SERVER_ERROR,
				ERROR_CODES.UNKNOWN_ERROR
			);
		}
		throw new InternalApiError(
			`submitBusinessEntityForSerpSearch : Something went wrong. Please try again.`,
			StatusCodes.INTERNAL_SERVER_ERROR,
			ERROR_CODES.UNKNOWN_ERROR
		);
	}
};

export const submitBusinessEntityForNPIMatch = async (businessID, npi, authorization) => {
	try {
		const headers = { "Content-Type": "application/json" };

		if (authorization) {
			headers["authorization"] = authorization;
		}
		const config = {
			method: "post",
			maxBodyLength: Infinity,
			url: `${envConfig.INTEGRATION_BASE_URL}/api/v1/verification/businesses/${businessID}/match-npi/${npi}`,
			headers
		};

		const response = await axios(config);
		const { data } = response.data;
		return data as NpiTaskResponse;
	} catch (error) {
		logger.error({
			message: "Something went wrong while submitting business entity for NPI match",
			body: parseError(error)
		});

		if (error instanceof AxiosError) {
			throw new InternalApiError(
				`submitBusinessEntityForNPIMatch : Something went wrong. Please try again. ${error.response?.data?.message}`,
				StatusCodes.INTERNAL_SERVER_ERROR,
				ERROR_CODES.UNKNOWN_ERROR
			);
		}
		throw new InternalApiError(
			`submitBusinessEntityForNPIMatch : Something went wrong. Please try again.`,
			StatusCodes.INTERNAL_SERVER_ERROR,
			ERROR_CODES.UNKNOWN_ERROR
		);
	}
};

export const submitBusinessEntityForReview = async (businessID, body, authorization?: string) => {
	const headers: Record<string, string> = { "Content-Type": "application/json" };
	// Add authorization header only if it's defined
	if (authorization) {
		headers["authorization"] = authorization;
	}
	try {
		const config = {
			method: "post",
			maxBodyLength: Infinity,
			url: `${envConfig.INTEGRATION_BASE_URL}/api/v1/internal/verification/businesses/${businessID}/verify-business-entity`,
			headers,
			data: body
		};

		const response = await axios(config);
		const { data } = response.data;

		return data;
	} catch (error) {
		logger.error({
			message: "Something went wrong while submitting business entity verification",
			body: parseError(error)
		});
		if (error instanceof AxiosError) {
			throw new InternalApiError(
				`submitBusinessEntityForReview : Something went wrong. Please try again. ${error.response?.data?.message}`,
				StatusCodes.INTERNAL_SERVER_ERROR,
				ERROR_CODES.UNKNOWN_ERROR
			);
		}
		throw new InternalApiError(
			`submitBusinessEntityForReview : Something went wrong. Please try again.`,
			StatusCodes.INTERNAL_SERVER_ERROR,
			ERROR_CODES.UNKNOWN_ERROR
		);
	}
};

export const updateBusinessEntityForReview = async (businessID, body, authorization?: string) => {
	const headers: Record<string, string> = { "Content-Type": "application/json" };
	// Add authorization header only if it's defined
	if (authorization) {
		headers["authorization"] = authorization;
	}
	try {
		const config = {
			method: "post",
			maxBodyLength: Infinity,
			url: `${envConfig.INTEGRATION_BASE_URL}/api/v1/internal/verification/businesses/${businessID}/update-business-entity`,
			headers,
			data: body
		};

		const response = await axios(config);
		const { data } = response.data;

		return data;
	} catch (error) {
		logger.error({
			message: "Something went wrong while updating business entity verification",
			body: parseError(error)
		});
		if (error instanceof AxiosError) {
			throw new InternalApiError(
				`updateBusinessEntityForReview : Something went wrong. Please try again. ${error.response?.data?.message}`,
				StatusCodes.INTERNAL_SERVER_ERROR,
				ERROR_CODES.UNKNOWN_ERROR
			);
		}
		throw new InternalApiError(
			`updateBusinessEntityForReview : Something went wrong. Please try again.`,
			StatusCodes.INTERNAL_SERVER_ERROR,
			ERROR_CODES.UNKNOWN_ERROR
		);
	}
};

export const submitOrUpdateBusinessEntityForReview = async (businessID, body, authorization?: string) => {
	const headers: Record<string, string> = { "Content-Type": "application/json" };
	// Add authorization header only if it's defined
	if (authorization) {
		headers["authorization"] = authorization;
	}
	try {
		const config = {
			method: "post",
			maxBodyLength: Infinity,
			url: `${envConfig.INTEGRATION_BASE_URL}/api/v1/internal/verification/businesses/${businessID}/verify-business-entity/orders`,
			headers,
			data: body
		};

		const response = await axios(config);
		const { data } = response.data;

		return data;
	} catch (error) {
		logger.error({
			message: `Something went wrong while submitting or updating business entity verification: ${businessID}`,
			body: parseError(error)
		});
		if (error instanceof AxiosError) {
			throw new InternalApiError(
				`submitOrUpdateBusinessEntityForReview : Something went wrong. Please try again. ${error.response?.data?.message}`,
				StatusCodes.INTERNAL_SERVER_ERROR,
				ERROR_CODES.UNKNOWN_ERROR
			);
		}
		throw new InternalApiError(
			`submitOrUpdateBusinessEntityForReview : Something went wrong. Please try again.`,
			StatusCodes.INTERNAL_SERVER_ERROR,
			ERROR_CODES.UNKNOWN_ERROR
		);
	}
};

type BusinessEntityVerification = {
	business_id: UUID;
	id: UUID;
	business_integration_task_id: UUID;
	external_id: any;
	name: string | null;
	status: "in_review" | "rejected" | "approved" | string;
	tin: string | null;
	formation_state: string | null;
	formation_date: Date | null;
	year: number | null;
	number_of_employees: number | null;
};
type BusinessEntityVerificationTask = {
	id: UUID;
	business_entity_verification_id: UUID;
	category: "sos" | "address" | "tin" | "watchlist" | "name" | string;
	key: string;
	status: "pending" | "success" | "failure" | string;
	message: string | null;
	created_at: Date;
	updated_at: Date;
};
type BusinessEntityVerificationRegistration = {
	id: UUID;
	business_entity_verification_id: UUID;
	external_id: any;
	status: "active" | "inactive" | string;
	name: string;
	sub_status: string;
	jurisdiction: string;
	entity_type: string;
	file_number: string;
	full_addresses: string[];
	registration_date: Date;
	registration_state: string;
	created_at: Date;
	updated_at: Date;
};

export type BusinessEntityVerificationDetails = {
	businessEntityVerification: BusinessEntityVerification;
	reviewTasks: BusinessEntityVerificationTask[];
	registrations: BusinessEntityVerificationRegistration[];
	addressSources: any[];
	people: any[];
	names: any[];
};

export const getBusinessEntityVerificationDetails = async (
	businessID,
	authorization?: string
): Promise<BusinessEntityVerificationDetails> => {
	const headers: Record<string, string> = { "Content-Type": "application/json" };
	// Add authorization header only if it's defined
	if (authorization) {
		headers["authorization"] = authorization;
	}
	try {
		let baseURL = `${envConfig.INTEGRATION_BASE_URL}/api/v1`;
		if (!authorization) {
			baseURL += "/internal";
		}
		const config = {
			method: "get",
			maxBodyLength: Infinity,
			url: `${baseURL}/verification/businesses/${businessID}/business-entity`,
			headers
		};

		const response = await axios(config);
		const { data } = response.data;

		return data;
	} catch (error) {
		logger.error({
			message: "Something went wrong while getting businessEntityVerificationDetails",
			body: parseError(error)
		});
		if (error instanceof AxiosError) {
			throw new InternalApiError(
				`getBusinessEntityVerificationDetails : Something went wrong. Please try again. ${error.response?.data?.message}`,
				StatusCodes.INTERNAL_SERVER_ERROR,
				ERROR_CODES.UNKNOWN_ERROR
			);
		}
		throw new InternalApiError(
			`getBusinessEntityVerificationDetails : Something went wrong. Please try again.`,
			StatusCodes.INTERNAL_SERVER_ERROR,
			ERROR_CODES.UNKNOWN_ERROR
		);
	}
};

export const fetchNPIDetails = async (businessId, caseId, { authorization }) => {
	const headers: Record<string, string> = { "Content-Type": "application/json", authorization: authorization };

	try {
		let baseURL = `${envConfig.INTEGRATION_BASE_URL}/api/v1`;
		const config = {
			method: "get",
			maxBodyLength: Infinity,
			url: `${baseURL}/verification/businesses/${businessId}/healthcare/${caseId}`,
			headers
		};

		const response = await axios(config);
		const { data } = response.data;
		if (!data) {
			logger.warn(`Failed to fetch NPI details for businessId: ${businessId}`);
		} else {
			logger.debug(`Fetched NPI details for businessId: ${businessId}`, data);
		}
		return data;
	} catch (error) {
		logger.error({ message: "Something went wrong while getting NPI details", body: parseError(error) });
		if (error instanceof AxiosError) {
			throw new InternalApiError(
				`getNPIDetails : Something went wrong. Please try again. ${error.response?.data?.message}`,
				StatusCodes.INTERNAL_SERVER_ERROR,
				ERROR_CODES.UNKNOWN_ERROR
			);
		}
		throw new InternalApiError(
			`getNPIDetails : Something went wrong. Please try again.`,
			StatusCodes.INTERNAL_SERVER_ERROR,
			ERROR_CODES.UNKNOWN_ERROR
		);
	}
};

export const updateApplicantByID = async (body, applicantID, customerID, authorization) => {
	try {
		const config = {
			method: "post",
			maxBodyLength: Infinity,
			url: `${envConfig.AUTH_BASE_URL}/api/v1/customers/${customerID}/applicants/${applicantID}`,
			headers: { "Content-Type": "application/json", authorization },
			data: body
		};

		await axios(config);
	} catch (error) {
		if (error instanceof AxiosError) {
			if (error.response?.data?.message === "User has already onboarded the platform") {
				logger.error({ message: "User has already onboarded the platform", body: parseError(error) });
				throw new InternalApiError(
					"User has already onboarded the platform",
					StatusCodes.BAD_REQUEST,
					ERROR_CODES.INVALID
				);
			}

			if (error.response?.data?.message === "Applicant not found") {
				logger.error({ message: "Applicant not found", body: parseError(error) });
				throw new InternalApiError("Applicant not found", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
			}
		}
		logger.error({ message: "Failed to update applicant data", body: parseError(error) });

		throw new InternalApiError(
			"Something went wrong. Please try again",
			StatusCodes.INTERNAL_SERVER_ERROR,
			ERROR_CODES.UNKNOWN_ERROR
		);
	}
};

export const checkMobileExists = async (mobile, authorization) => {
	try {
		const config = {
			method: "post",
			maxBodyLength: Infinity,
			url: `${envConfig.AUTH_BASE_URL}/api/v1/mobile-exists`,
			headers: { "Content-Type": "application/json", authorization },
			data: { mobile }
		};

		const response = await axios(config);
		const { data } = response.data;

		return data;
	} catch (error) {
		logger.error({ message: "Failed to check if user mobile exists", body: parseError(error) });

		throw new InternalApiError(
			"Something went wrong. Please try again",
			StatusCodes.INTERNAL_SERVER_ERROR,
			ERROR_CODES.UNKNOWN_ERROR
		);
	}
};

export const getCustomersRiskAlertConfigs = async customerID => {
	try {
		const config = {
			method: "get",
			maxBodyLength: Infinity,
			url: `${envConfig.INTEGRATION_BASE_URL}/api/v1/internal/risk-alerts/customers/${customerID}/configs`,
			headers: { "Content-Type": "application/json" }
		};

		const response = await axios(config);
		const { data } = response.data;

		return data;
	} catch (error) {
		logger.error({ message: `Failed to get risk alert configs for customer: ${customerID}`, body: parseError(error) });

		throw new InternalApiError(
			"getCustomersRiskAlertConfigs: Something went wrong. Please try again",
			StatusCodes.INTERNAL_SERVER_ERROR,
			ERROR_CODES.UNKNOWN_ERROR
		);
	}
};

/**
 * TODO: This needs to be replaced as it is not at all scalable
 */
export const getCustomerWithPermissions = async body => {
	try {
		const config = {
			method: "get",
			maxBodyLength: Infinity,
			url: `${envConfig.AUTH_BASE_URL}/api/v1/internal/customers/permissions`,
			headers: { "Content-Type": "application/json" },
			data: body
		};

		const response = await axios(config);
		const { data } = response.data;

		return data ? data : response.data;
	} catch (error) {
		logger.error({ message: `Failed to get customers with permissions: ${body.permissions}`, body: parseError(error) });

		throw new InternalApiError(
			"getCustomerWithPermissions: Something went wrong. Please try again",
			StatusCodes.INTERNAL_SERVER_ERROR,
			ERROR_CODES.UNKNOWN_ERROR
		);
	}
};

export const fetchRiskAlerts = async query => {
	try {
		const config = {
			method: "get",
			maxBodyLength: Infinity,
			url: `${envConfig.INTEGRATION_BASE_URL}/api/v1/internal/risk-alerts`,
			headers: { "Content-Type": "application/json" },
			data: query
		};

		const response = await axios(config);

		const { data } = response.data;
		return data;
	} catch (error) {
		logger.error({ message: `Failed to fetch risk alerts`, body: parseError(error) });
		throw new InternalApiError(
			"fetchRiskAlerts: Something went wrong. Please try again",
			StatusCodes.INTERNAL_SERVER_ERROR,
			ERROR_CODES.UNKNOWN_ERROR
		);
	}
};

// TODO: remove after executing on PROD
export const fetchRiskAlertScoreIDs = async () => {
	try {
		const config = {
			method: "get",
			maxBodyLength: Infinity,
			url: `${envConfig.INTEGRATION_BASE_URL}/api/v1/internal/risk-alerts/score-triggers`,
			headers: { "Content-Type": "application/json" }
		};

		const response = await axios(config);

		const { data } = response.data;
		return data;
	} catch (error) {
		logger.error({ message: `Failed to fetch risk alerts`, body: parseError(error) });
		throw new InternalApiError(
			"fetchRiskAlertScoreIDs: Something went wrong. Please try again",
			StatusCodes.INTERNAL_SERVER_ERROR,
			ERROR_CODES.UNKNOWN_ERROR
		);
	}
};

export interface DepositAccountInfo {
	accounts: Array<{
		account_id: string;
		balances: { available: string; current: string; limit: string };
		mask: string;
		name: string;
		official_name: string;
		subtype: string;
		type: string;
		institution_name: string;
		verification_status: string;
	}>;
	numbers: {
		ach: Array<{ account: string; account_number: string; account_id: string; routing: string; wire_routing: string }>;
		bacs: unknown[];
		eft: unknown[];
		international: unknown[];
	};
}
export const fetchDepositAccountInfo = async (businessID: string | UUID): Promise<DepositAccountInfo> => {
	try {
		const config = {
			method: "get",
			maxBodyLength: Infinity,
			url: `${envConfig.INTEGRATION_BASE_URL}/api/v1/internal/business/${businessID}/deposit-account`,
			headers: { "Content-Type": "application/json" }
		};

		const response = await axios(config);

		const { data } = response.data;
		return data;
	} catch (_error) {
		throw new InternalApiError(
			"fetchDepositAccountInfo: Something went wrong. Please try again",
			StatusCodes.INTERNAL_SERVER_ERROR,
			ERROR_CODES.UNKNOWN_ERROR
		);
	}
};

export const inviteApplicant = async body => {
	try {
		const config = {
			method: "post",
			maxBodyLength: Infinity,
			url: `${envConfig.AUTH_BASE_URL}/api/v1/internal/users/invite`,
			headers: { "Content-Type": "application/json" },
			data: body
		};

		const response = await axios(config);
		const { data } = response.data;

		return data;
	} catch (error) {
		logger.error({ message: "Something went wrong while creating an invite applicant", body: parseError(error) });
		if (error instanceof AxiosError) {
			throw new InternalApiError(
				`inviteApplicant : Something went wrong. Please try again. ${error.response?.data?.message}`,
				StatusCodes.INTERNAL_SERVER_ERROR,
				ERROR_CODES.UNKNOWN_ERROR
			);
		}
		throw new InternalApiError(
			`inviteApplicant : Something went wrong. Please try again.`,
			StatusCodes.INTERNAL_SERVER_ERROR,
			ERROR_CODES.UNKNOWN_ERROR
		);
	}
};

/**
 * Retrieves customer data based on the provided customer ID.
 *
 * This function makes an HTTP GET request to the customer API endpoint using the provided customer ID
 * and returns the customer data. In case of an error, it logs the error details and throws an InternalApiError.
 *
 * @async
 * @param {string} customerID - The unique identifier of the customer whose data is to be retrieved.
 * @returns {Promise<Object>} The customer data object.
 * @throws {InternalApiError} Throws an error if the request fails or if the customer is not found.
 */
export const getCustomerData = async customerID => {
	try {
		// Configure the axios request with method, URL, and headers
		const config = {
			method: "get", // HTTP method
			maxBodyLength: Infinity, // Allow for large response bodies
			url: `${envConfig.AUTH_BASE_URL}/api/v1/internal/customers/${customerID}`, // API endpoint with customer ID
			headers: {
				"Content-Type": "application/json" // Set content type to JSON
			}
		};

		// Send the HTTP request and await the response
		const response = await axios(config);
		const { data } = response.data; // Destructure the data from the response

		return data; // Return the customer data
	} catch (error) {
		// Parse the error to get meaningful information
		const parsedError = parseError(error);

		// Log the error details
		logger.error({ message: "Failed to get customer data", body: parsedError });

		// Get the error message and determine the error code
		const message = parsedError?.data?.message;
		const errorCode = parsedError?.data?.errorCode === "NOT_FOUND" ? "NOT_FOUND" : ERROR_CODES.UNKNOWN_ERROR;

		// Throw an InternalApiError with detailed information
		throw new InternalApiError(`getCustomerData: ${message}`, StatusCodes.INTERNAL_SERVER_ERROR, errorCode);
	}
};

/**
 * @description get the invitation link for the applicants
 * @param {*} body
 * @returns invitation_links: invitation links for the applicants
 */
export const inviteBusinessApplicants = async body => {
	try {
		const config = {
			method: "post",
			maxBodyLength: Infinity,
			url: `${envConfig.AUTH_BASE_URL}/api/v1/internal/applicants/invite`,
			headers: { "Content-Type": "application/json" },
			data: body
		};

		const response = await axios(config);
		const { data } = response.data;

		return data;
	} catch (error) {
		logger.error({ message: "Something went wrong while creating an invite applicant", body: parseError(error) });

		throw new InternalApiError(
			`inviteBusinessApplicants: Something went wrong. Please try again.`,
			StatusCodes.INTERNAL_SERVER_ERROR,
			ERROR_CODES.UNKNOWN_ERROR
		);
	}
};

export const getVerificationUploadsForBusiness = async businessID => {
	try {
		const config = {
			method: "get",
			maxBodyLength: Infinity,
			url: `${envConfig.INTEGRATION_BASE_URL}/api/v1/internal/businesses/${businessID}/verification-uploads`,
			headers: { "Content-Type": "application/json" },
			data: {}
		};

		const response = await axios(config);
		const { data } = response.data;

		return data;
	} catch (error) {
		logger.error({ message: "Something went wrong while getting verification uploads", body: parseError(error) });

		if (error instanceof AxiosError) {
			throw new InternalApiError(
				`getVerificationUploadsForBusiness : Something went wrong. Please try again. ${error.response?.data?.message}`,
				StatusCodes.INTERNAL_SERVER_ERROR,
				ERROR_CODES.UNKNOWN_ERROR
			);
		}
		throw new InternalApiError(
			`getVerificationUploadsForBusiness : Something went wrong. Please try again.`,
			StatusCodes.INTERNAL_SERVER_ERROR,
			ERROR_CODES.UNKNOWN_ERROR
		);
	}
};

// get report status for case by case_ids array of (case id and case status)
export const getReportStatusForCase = async (case_ids: { id: UUID; status: string }[]) => {
	try {
		const config = {
			method: "get",
			maxBodyLength: Infinity,
			url: `${envConfig.REPORT_BASE_URL}/api/v1/internal/reports-status`,
			headers: { "Content-Type": "application/json" },
			data: { case_ids: case_ids }
		};

		const response = await axios(config);
		const { data } = response.data;

		return data;
	} catch (error) {
		logger.error({ message: "Something went wrong while getting report status", body: parseError(error) });

		if (error instanceof AxiosError) {
			throw new InternalApiError(
				`getReportStatusForCase : Something went wrong. Please try again. ${error.response?.data?.message}`,
				StatusCodes.INTERNAL_SERVER_ERROR,
				ERROR_CODES.UNKNOWN_ERROR
			);
		}
		throw new InternalApiError(
			`getReportStatusForCase : Something went wrong. Please try again.`,
			StatusCodes.INTERNAL_SERVER_ERROR,
			ERROR_CODES.UNKNOWN_ERROR
		);
	}
};

export const getBusinessesRevenueAndAge = async (payload: { business_ids: Array<string> }) => {
	try {
		const config = {
			method: "get",
			maxBodyLength: Infinity,
			url: `${envConfig.INTEGRATION_BASE_URL}/api/v1/internal/businesses/metadata`,
			headers: { "Content-Type": "application/json" },
			data: payload
		};

		const response = await axios(config);
		const { data } = response.data;

		return data;
	} catch (error) {
		logger.error({ message: "Something went wrong while getting verification uploads", body: parseError(error) });

		if (error instanceof AxiosError) {
			throw new InternalApiError(
				`getBusinessesRevenueAndAge : Something went wrong. Please try again. ${error.response?.data?.message}`,
				StatusCodes.INTERNAL_SERVER_ERROR,
				ERROR_CODES.UNKNOWN_ERROR
			);
		}
		throw new InternalApiError(
			`getBusinessesRevenueAndAge : Something went wrong. Please try again.`,
			StatusCodes.INTERNAL_SERVER_ERROR,
			ERROR_CODES.UNKNOWN_ERROR
		);
	}
};

export const getBusinessApplicantByApplicantId = async (businessID, applicantID, authorization?: string) => {
	const headers: Record<string, string> = { "Content-Type": "application/json" };
	// Add authorization header only if it's defined
	if (authorization) {
		headers["authorization"] = authorization;
	}

	try {
		const config: AxiosRequestConfig = {
			method: "get",
			maxBodyLength: Infinity,
			url: `${envConfig.AUTH_BASE_URL}/api/v1/internal/businesses/${businessID}/applicants/${applicantID}`,
			headers,
			data: {}
		};

		const response = await axios(config);
		const { data } = response.data;

		return data;
	} catch (error) {
		if (error instanceof AxiosError && error?.response?.data?.message === "Applicant not found") {
			logger.error({ message: "getBusinessApplicantByApplicantId: Applicant not found", body: parseError(error) });

			throw new InternalApiError("Applicant not found", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
		}

		logger.error({
			message: "getBusinessApplicantByApplicantId: Failed to get applicant data",
			body: parseError(error)
		});

		throw new InternalApiError(
			"getBusinessApplicantByApplicantId: Something went wrong. Please try again",
			StatusCodes.INTERNAL_SERVER_ERROR,
			ERROR_CODES.UNKNOWN_ERROR
		);
	}
};

export const getEntityVerificationDetails = async (businessID, authorization?) => {
	const headers: Record<string, string> = { "Content-Type": "application/json" };
	// Add authorization header only if it's defined
	if (authorization) {
		headers["authorization"] = authorization;
	}
	try {
		const config = {
			method: "get",
			maxBodyLength: Infinity,
			url: `${envConfig.INTEGRATION_BASE_URL}/api/v1/internal/verification/businesses/${businessID}/business-entity`,
			headers
		};

		const response = await axios(config);
		const { data } = response.data;

		return data;
	} catch (error) {
		logger.error({
			message: "getEntityVerificationDetails: Failed to get entity verification details",
			body: parseError(error)
		});

		throw new InternalApiError(
			"getEntityVerificationDetails: Something went wrong. Please try again",
			StatusCodes.INTERNAL_SERVER_ERROR,
			ERROR_CODES.UNKNOWN_ERROR
		);
	}
};

export const getBusinessKybDetails = async (businessID, authorization?) => {
	const headers: Record<string, string> = { "Content-Type": "application/json" };
	// Add authorization header only if it's defined
	if (authorization) {
		headers["authorization"] = authorization;
	}
	try {
		const config = {
			method: "get",
			maxBodyLength: Infinity,
			url: `${envConfig.INTEGRATION_BASE_URL}/api/v1/internal/facts/business/${businessID}/kyb`,
			headers
		};

		const response = await axios(config);
		const { data } = response.data;

		return data;
	} catch (error) {
		logger.error({ message: "getFacts: Failed to get entity verification details", body: parseError(error) });

		throw new InternalApiError(
			"getFacts: Something went wrong. Please try again",
			StatusCodes.INTERNAL_SERVER_ERROR,
			ERROR_CODES.UNKNOWN_ERROR
		);
	}
};

export const getBusinessCoApplicants = async (businessID, authorization?: string) => {
	const headers: Record<string, string> = { "Content-Type": "application/json" };
	// Add authorization header only if it's defined
	if (authorization) {
		headers["authorization"] = authorization;
	}

	try {
		const config: AxiosRequestConfig = {
			method: "get",
			maxBodyLength: Infinity,
			url: `${envConfig.AUTH_BASE_URL}/api/v1/internal/businesses/${businessID}/co-applicants`,
			headers,
			data: {}
		};

		const response = await axios(config);
		const { data } = response.data;

		return data;
	} catch (error) {
		logger.error({ message: "getBusinessCoApplicants: Failed to get co-applicants data", body: parseError(error) });

		throw new InternalApiError(
			"getBusinessCoApplicants: Something went wrong. Please try again",
			StatusCodes.INTERNAL_SERVER_ERROR,
			ERROR_CODES.UNKNOWN_ERROR
		);
	}
};

export const getBusinessProcessingHistory = async (businessID: UUID, caseID?: UUID) => {
	try {
		const config = {
			method: "get",
			maxBodyLength: Infinity,
			url: `${envConfig.INTEGRATION_BASE_URL}/api/v1/internal/businesses/${businessID}/processing-history?${
				caseID ? `case_id=${caseID}` : ""
			}`,
			headers: { "Content-Type": "application/json" }
		};

		const response = await axios(config);
		const { data } = response.data;

		return data as ProcessingHistoryData[];
	} catch (error) {
		logger.error({
			message: "getBusinessProcessingHistory: Failed to get processing history",
			body: parseError(error)
		});

		throw new InternalApiError(
			"getBusinessProcessingHistory: Something went wrong. Please try again",
			StatusCodes.INTERNAL_SERVER_ERROR,
			ERROR_CODES.UNKNOWN_ERROR
		);
	}
};

export const getBusinessAccountingStatements = async (businessID: UUID, caseID?: UUID | string | undefined) => {
	try {
		const config = {
			method: "get",
			maxBodyLength: Infinity,
			url: `${envConfig.INTEGRATION_BASE_URL}/api/v1/internal/accounting/business/${businessID}/accounting-statements`,
			headers: { "Content-Type": "application/json" },
			data: { ...(caseID && { case_id: caseID }) }
		};

		const response = await axios(config);
		const { data } = response.data;

		return data as AccountingStatementData[];
	} catch (error) {
		logger.error({
			message: "getBusinessAccountingStatements: Failed to get accounting statements",
			body: parseError(error)
		});

		throw new InternalApiError(
			"getBusinessAccountingStatements: Something went wrong. Please try again",
			StatusCodes.INTERNAL_SERVER_ERROR,
			ERROR_CODES.UNKNOWN_ERROR
		);
	}
};

export const getBusinessBankStatements = async (businessID: UUID, caseID?: UUID | string | undefined) => {
	try {
		const config = {
			method: "get",
			maxBodyLength: Infinity,
			url: `${envConfig.INTEGRATION_BASE_URL}/api/v1/internal/banking/business/${businessID}/bank-statements`,
			headers: { "Content-Type": "application/json" },
			data: { ...(caseID && { case_id: caseID }) }
		};

		const response = await axios(config);
		const { data } = response.data;

		return data as AccountingStatementData[];
	} catch (error) {
		logger.error({ message: "getBusinessBankStatements: Failed to get bank statements", body: parseError(error) });

		throw new InternalApiError(
			"getBusinessBankStatements: Something went wrong. Please try again",
			StatusCodes.INTERNAL_SERVER_ERROR,
			ERROR_CODES.UNKNOWN_ERROR
		);
	}
};

export const getBusinessDocumentExtractions = async businessID => {
	try {
		const config = {
			method: "get",
			maxBodyLength: Infinity,
			url: `${envConfig.INTEGRATION_BASE_URL}/api/v1/internal/businesses/${businessID}/document-extractions`,
			headers: { "Content-Type": "application/json" }
		};

		const response = await axios(config);
		const { data } = response.data;

		return data;
	} catch (error) {
		logger.error({
			message: "getBusinessDocumentExtractions: Failed to get processing history",
			body: parseError(error)
		});

		throw new InternalApiError(
			"getBusinessDocumentExtractions: Something went wrong. Please try again",
			StatusCodes.INTERNAL_SERVER_ERROR,
			ERROR_CODES.UNKNOWN_ERROR
		);
	}
};

export const getCustomerIntegrationSettings = async (customerID: string) => {
	try {
		const config = {
			method: "get",
			maxBodyLength: Infinity,
			url: `${envConfig.INTEGRATION_BASE_URL}/api/v1/internal/customer-integration-settings/${customerID}`,
			headers: { "Content-Type": "application/json" }
		};

		const response = await axios(config);
		const { data } = response.data;

		return data;
	} catch (error) {
		logger.error({ message: "Failed to get customer integration", body: parseError(error) });

		throw new InternalApiError(
			"getCustomerIntegrationSettings: Something went wrong. Please try again",
			StatusCodes.INTERNAL_SERVER_ERROR,
			ERROR_CODES.UNKNOWN_ERROR
		);
	}
};

type BulkUserInfoResponse = {
	id: UUID;
	first_name: string;
	last_name: string;
	email: string;
	mobile: string | null;
	is_email_verified: boolean;
	is_first_login: boolean;
	created_at: string;
	updated_at: string | null;
	created_by: UUID;
	updated_by: UUID | null;
	is_tc_accepted: boolean;
	tc_accepted_at: Date | null;
	role_id: typeof ROLE_ID;
};
/**
 * Get user details for multiple users
 * 	May possibly be cached responses
 * @param userIDs user id or array of user ids
 * @param authorization
 * @returns
 */
/** A small LRU Cache to store recent user attempts on same pod to avoid hammering auth service for user details
 */
const userCache: LRUCache<UUID, BulkUserInfoResponse> = new LRUCache<UUID, BulkUserInfoResponse>({
	max: 500,
	maxAge: 1000 * 60 * 15 // 15 minutes
});
export const getBulkUserInfo = async (
	userIDs: UUID | UUID[] | Set<UUID>,
	authorization?: string
): Promise<Record<UUID, BulkUserInfoResponse>> => {
	const headers: Record<string, string> = { "Content-Type": "application/json" };
	// Add authorization header only if it's defined
	if (authorization) {
		headers["authorization"] = authorization;
	}
	// Force array input
	if (typeof userIDs == "string") {
		userIDs = [userIDs];
	} else if (userIDs instanceof Set) {
		userIDs = [...userIDs];
	} else if (Array.isArray(userIDs)) {
		userIDs = userIDs;
	} else {
		throw new InternalApiError("getBulkUserInfo: Invalid userIDs", StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
	}

	// Find the users in the userCache
	const cachedUsers: Record<UUID, BulkUserInfoResponse> = userIDs.reduce((acc, userId) => {
		const cached = userCache.get(userId);
		acc[userId] = cached ? cached : undefined;
		return acc;
	}, {});

	try {
		const userIDsToFetch = Object.entries(cachedUsers)
			.filter(([_, user]) => user === undefined)
			.map(([id]) => id);
		if (userIDsToFetch && userIDsToFetch.length) {
			const config = {
				method: "post",
				maxBodyLength: Infinity,
				url: `${envConfig.AUTH_BASE_URL}/api/v1${authorization ? "" : "/internal"}/bulk/users/`,
				headers,
				data: { userIDs: userIDsToFetch }
			};

			const response = await axios(config);
			const { data }: { data: BulkUserInfoResponse[] } = response.data;

			// Group the users by id
			data.forEach(user => {
				cachedUsers[user.id] = user;
				userCache.set(user.id, user);
			});
		}

		return cachedUsers;
	} catch (error) {
		logger.error({ message: "getBulkUserInfo: Failed to get user details", body: parseError(error) });

		throw new InternalApiError(
			"getBulkUserInfo: Something went wrong. Please try again",
			StatusCodes.INTERNAL_SERVER_ERROR,
			ERROR_CODES.UNKNOWN_ERROR
		);
	}
};

export const getCustomerAndBusinessUsers = async (params: { customerID: UUID; businessID: UUID }, authorization) => {
	try {
		const config = {
			method: "get",
			maxBodyLength: Infinity,
			url: `${envConfig.AUTH_BASE_URL}/api/v1/internal/customers/${params.customerID}/businesses/${params.businessID}/users`,
			headers: { "Content-Type": "application/json", authorization }
		};

		const response = await axios(config);
		const { data } = response.data;

		return data;
	} catch (error) {
		logger.error({
			message: "getCustomerAndBusinessUsers: Failed to get customer and business users data",
			body: parseError(error)
		});

		throw new InternalApiError(
			"Something went wrong. Please try again",
			StatusCodes.INTERNAL_SERVER_ERROR,
			ERROR_CODES.UNKNOWN_ERROR
		);
	}
};

export const createSessionToken = async (businessID: string, body: object) => {
	try {
		const config = {
			method: "post",
			maxBodyLength: Infinity,
			url: `${envConfig.ELECTRONIC_CONSENT_BASE_URL}/api/v1/internal/sessions/business/${businessID}`,
			headers: { "Content-Type": "application/json", authorization: `Bearer ${envConfig.ECONSENT_API_KEY}` },
			data: body
		};

		const response = await axios(config);
		const { data } = response.data;

		return data;
	} catch (error: any) {
		logger.error({ message: "Failed to create session token", body: parseError(error) });

		throw new InternalApiError(
			`createSessionToken: Something went wrong. Please try again: ${error.message} : ${error?.response?.data?.message}`,
			StatusCodes.INTERNAL_SERVER_ERROR,
			ERROR_CODES.UNKNOWN_ERROR
		);
	}
};

export type FetchCaseVerificationsResponse = {
	verification_of_owners: Array<{ owner_id: string | UUID; status: IdvStatus | string }>;
	banking: { is_giact_verified: boolean; giact_service_flags: string[]; bank_accounts_info: Array<BankAccountInfo> };
};

export type BankAccountInfo = {
	id: string | UUID;
	business_integration_task_id: string | UUID;
	bank_account: string;
	bank_name: string;
	official_name: string;
	institution_name: string;
	verification_status: "VERIFIED" | "UNVERIFIED" | null | string;
	balance_current: string;
	balance_available: string;
	balance_limit: string;
	currency: string;
	type: string;
	subtype: string;
	mask: string;
	created_at: string;
	routing_number: string;
	wire_routing_number: string;
	deposit_account: boolean;
	is_selected: boolean;
	verification_result: VerificationResult | null;
};

export type VerificationResult = {
	id: string | UUID;
	verification_status: GiactVerificationStatus | null;
	created_at: string;
	updated_at: string;
	account_verification_response: {
		name: string | null;
		code: string | null;
		description: string | null;
		verification_response: string | null;
	};
	account_authentication_response: {
		name: string | null;
		code: string | null;
		description: string | null;
		verification_response: string | null;
	};
};

export const fetchCaseVerifications = async (
	businessID: string | UUID,
	caseID: string | UUID,
	customerID: string | UUID
): Promise<FetchCaseVerificationsResponse> => {
	try {
		const config = {
			method: "get",
			maxBodyLength: Infinity,
			url: `${envConfig.INTEGRATION_BASE_URL}/api/v1/internal/business/${businessID}/case/${caseID}/customer/${customerID}/verifications`,
			headers: { "Content-Type": "application/json" }
		};

		const response = await axios(config);
		const { data } = response.data;
		return data;
	} catch (error) {
		logger.error(error, "fetchCaseVerifications: Something went wrong while fetching case verifications");
		throw new InternalApiError(
			"fetchCaseVerifications: Something went wrong. Please try again",
			StatusCodes.INTERNAL_SERVER_ERROR,
			ERROR_CODES.UNKNOWN_ERROR
		);
	}
};

export const createAndLinkGuestUserAndSubrole = async (body: {
	business_id: UUID;
	customer_id: UUID;
}): Promise<{ applicant_id: UUID; email: string; first_name: string; last_name: string }> => {
	try {
		const config = {
			method: "post",
			maxBodyLength: Infinity,
			url: `${envConfig.AUTH_BASE_URL}/api/v1/internal/guest-user-subrole`,
			headers: { "Content-Type": "application/json" },
			data: body
		};
		const response = await axios(config);
		const { data } = response.data;

		return data;
	} catch (error) {
		logger.error({
			message: "Something went wrong while creating createAndLinkGuestUserAndSubrole",
			body: parseError(error)
		});

		throw new InternalApiError(
			"createAndLinkGuestUserAndSubrole: Something went wrong. Please try again",
			StatusCodes.INTERNAL_SERVER_ERROR,
			ERROR_CODES.UNKNOWN_ERROR
		);
	}
};

// get report status for case by case_ids array of (case id and case status)
export const getReportStatusForBusiness = async (
	business_ids: { id: UUID; status: string }[],
	customer_id: string | null
) => {
	try {
		const config = {
			method: "post",
			maxBodyLength: Infinity,
			url: `${envConfig.REPORT_BASE_URL}/api/v1/internal/reports-status/businesses`,
			headers: { "Content-Type": "application/json" },
			data: { business_ids: business_ids, customer_id }
		};

		const response = await axios(config);
		const { data } = response.data;

		return data;
	} catch (error) {
		logger.error({ message: "Something went wrong while getting report status", body: parseError(error) });

		if (error instanceof AxiosError) {
			throw new InternalApiError(
				`getReportStatusForBusiness : Something went wrong. Please try again. ${error.response?.data?.message}`,
				StatusCodes.INTERNAL_SERVER_ERROR,
				ERROR_CODES.UNKNOWN_ERROR
			);
		}
		throw new InternalApiError(
			`getReportStatusForBusiness : Something went wrong. Please try again.`,
			StatusCodes.INTERNAL_SERVER_ERROR,
			ERROR_CODES.UNKNOWN_ERROR
		);
	}
};

export interface AdditionalAccountDetails {
	accounts: Array<{
		id: UUID;
		bank_account: string;
		routing_number: string;
		wire_routing_number: string | null;
		bank_name: string;
		official_name: string;
		institution_name: string;
		mask: string;
		type: string;
		subtype: string;
		verification_status: string;
	}>;
}

export const fetchAdditionalAccountDetails = async (
	businessID: string | UUID,
	caseID: string | UUID
): Promise<AdditionalAccountDetails> => {
	try {
		const config = {
			method: "get",
			maxBodyLength: Infinity,
			url: `${envConfig.INTEGRATION_BASE_URL}/api/v1/internal/banking/business/${businessID}/additional-accounts?case_id=${caseID}`,
			headers: { "Content-Type": "application/json" }
		};

		const response = await axios(config);

		const { data } = response.data;
		return data;
	} catch (_error) {
		throw new InternalApiError(
			"fetchAdditionalAccountDetails: Something went wrong. Please try again",
			StatusCodes.INTERNAL_SERVER_ERROR,
			ERROR_CODES.UNKNOWN_ERROR
		);
	}
};

export const getIntegrationStatusForCustomer = async customerID => {
	try {
		const config = {
			method: "get",
			maxBodyLength: Infinity,
			url: `${envConfig.INTEGRATION_BASE_URL}/api/v1/internal/integration-status/customers/${customerID}`,
			headers: { "Content-Type": "application/json" }
		};
		const response = await axios(config);
		const { data } = response.data;
		return data;
	} catch (error) {
		logger.error({ message: `Failed to get integration status for customer: ${customerID}`, body: parseError(error) });

		throw new InternalApiError(
			"getIntegrationStatusForCustomer: Something went wrong. Please try again",
			StatusCodes.INTERNAL_SERVER_ERROR,
			ERROR_CODES.UNKNOWN_ERROR
		);
	}
};

export const getCaseDetails = async caseID => {
	try {
		const config = {
			method: "get",
			maxBodyLength: Infinity,
			url: `${envConfig.WAREHOUSE_BASE_URL}/business/case_details/${caseID}`,
			headers: { "Content-Type": "application/json" }
		};
		const response = await axios(config);
		const { data } = response.data;
		return data;
	} catch (error) {
		logger.error({ message: `Failed to get case details for case: ${caseID}`, body: parseError(error) });

		throw new InternalApiError(
			"getCaseDetails: Something went wrong. Please try again",
			StatusCodes.INTERNAL_SERVER_ERROR,
			ERROR_CODES.UNKNOWN_ERROR
		);
	}
};

export const getBusinessFacts = async (
	businessID: string | UUID
): Promise<
	{
		collected_at: string;
		business_id: UUID;
		name: string;
		value: unknown;
		received_at: string;
		created_at: string;
		updated_at: string;
	}[]
> => {
	try {
		const config = {
			method: "get",
			maxBodyLength: Infinity,
			url: `${envConfig.WAREHOUSE_BASE_URL}/facts/${businessID}`,
			headers: { "Content-Type": "application/json" }
		};
		const response = await axios(config);
		return response?.data ?? [];
	} catch (error) {
		logger.error({ message: `Failed to get business facts for business: ${businessID}`, body: parseError(error) });
		throw new InternalApiError(
			"getBusinessFacts: Something went wrong. Please try again",
			StatusCodes.INTERNAL_SERVER_ERROR,
			ERROR_CODES.UNKNOWN_ERROR
		);
	}
};
export const getCaseDetailsExport = async customerID => {
	try {
		const config = {
			method: "get",
			maxBodyLength: Infinity,
			url: `${envConfig.WAREHOUSE_BASE_URL}/business/cases/customer/${customerID}`,
			headers: { "Content-Type": "application/json" }
		};

		const response = await axios(config);
		const { data } = response;

		return data;
	} catch (error) {
		logger.error({
			message: `getCaseDetailsExport: Failed to get case details for customer: ${customerID}`,
			body: parseError(error)
		});

		throw new InternalApiError(
			"getCaseDetailsExport: Something went wrong. Please try again",
			StatusCodes.INTERNAL_SERVER_ERROR,
			ERROR_CODES.UNKNOWN_ERROR
		);
	}
};

/**
 * Refreshes subrole permissions by calling the auth microservice
 * @param {string} subroleId - The subrole ID to refresh permissions for
 * @returns {Promise<string[]>} Array of permission strings
 * @throws {InternalApiError} Throws an error if the request fails
 */
export const refreshSubrolePermissions = async subroleId => {
	try {
		const config = {
			method: "post",
			maxBodyLength: Infinity,
			url: `${envConfig.AUTH_BASE_URL}/api/v1/internal/permissions/subroles/${subroleId}/refresh`,
			headers: { "Content-Type": "application/json" }
		};

		const response = await axios(config);
		const { data } = response.data;

		return data;
	} catch (error) {
		logger.error({
			message: `Failed to refresh subrole permissions for subrole: ${subroleId}`,
			body: parseError(error)
		});

		throw new InternalApiError(
			"refreshSubrolePermissions: Something went wrong while refreshing permissions. Please try again",
			StatusCodes.INTERNAL_SERVER_ERROR,
			ERROR_CODES.UNKNOWN_ERROR
		);
	}
};

/**
 * Invalidates the business facts cache by calling the integration microservice
 * @param {string | UUID} businessId - The business ID to invalidate cache for
 * @returns {Promise<any>} Response data from the invalidate-cache endpoint
 * @throws {InternalApiError} Throws an error if the request fails
 */
export const invalidateBusinessFactsCache = async businessId => {
	try {
		const config = {
			method: "delete",
			maxBodyLength: Infinity,
			url: `${envConfig.INTEGRATION_BASE_URL}/api/v1/internal/facts/business/${businessId}/cache`,
			headers: { "Content-Type": "application/json" }
		};

		const response = await axios(config);
		const { data } = response.data;

		return data;
	} catch (error) {
		logger.error({
			message: `Failed to invalidate facts cache for business: ${businessId}`,
			body: parseError(error)
		});

		throw new InternalApiError(
			"invalidateBusinessFactsCache: Something went wrong while invalidating cached data. Please try again",
			StatusCodes.INTERNAL_SERVER_ERROR,
			ERROR_CODES.UNKNOWN_ERROR
		);
	}
};

/**
 * Updates business facts override information
 * @param {string | UUID} businessId - The business ID to update override for
 * @param {any} updateBusinessFactsOverrideBody - The override data containing naics_code and/or mcc_code
 * @param {string | UUID} [userId] - Optional user ID performing the override
 * @returns {Promise<any>} Response data from the override endpoint
 * @throws {InternalApiError} Throws an error if the request fails
 */
export const updateBusinessFactsOverride = async (
	businessId: string | UUID,
	updateBusinessFactsOverrideBody: {
		naics_code?: { value: string | null; reason: string };
		mcc_code?: { value: string | null; reason: string };
	},
	userId?: string | UUID
) => {
	try {
		const config: AxiosRequestConfig = {
			method: "patch",
			maxBodyLength: Infinity,
			url: `${envConfig.INTEGRATION_BASE_URL}/api/v1/internal/facts/business/${businessId}/override`,
			headers: { "Content-Type": "application/json" },
			data: updateBusinessFactsOverrideBody
		};

		if (userId) {
			config.params = { userId };
		}

		const response = await axios(config);
		const { data } = response.data;

		return data;
	} catch (error) {
		logger.error({
			message: `Failed to override facts for business: ${businessId}`,
			body: parseError(error)
		});

		throw new InternalApiError(
			"updateBusinessFactsOverride: Something went wrong while overriding fact data. Please try again",
			StatusCodes.INTERNAL_SERVER_ERROR,
			ERROR_CODES.UNKNOWN_ERROR
		);
	}
};

export const getMerchantProfileData = async (
	customerId: UUID,
	businessID: UUID,
	platformId: number = INTEGRATION_ID.STRIPE,
	withAccountInfo: boolean = true
): Promise<Record<string, any> | null> => {
	// Currently the only PlatformID that is support is Stripe which is platformId 41. If another platform is provided it will reject the request for failing validation.
	const baseUrl = `${envConfig.INTEGRATION_BASE_URL}/api/v1/internal`;
	try {
		const config = {
			method: "get",
			maxBodyLength: Infinity,
			url: `${baseUrl}/payment-processors/${customerId}/merchant-profiles/${businessID}?platformId=${platformId}&withAccountInfo=${withAccountInfo}`,
			headers: { "Content-Type": "application/json" }
		};
		const response = await axios(config);

		// TODO: Add MerchantProfile type to @joinworth/types and use it here.
		const { data } = response.data;
		return data;
	} catch (error) {
		logger.error({
			message: `getMerchantProfileData: Failed to get merchant profile data for customer: ${customerId} and business: ${businessID}`,
			body: parseError(error)
		});

		throw new InternalApiError(
			"getMerchantProfileData: Something went wrong while fetching merchant profile data. Please try again",
			StatusCodes.INTERNAL_SERVER_ERROR,
			ERROR_CODES.UNKNOWN_ERROR
		);
	}
};
