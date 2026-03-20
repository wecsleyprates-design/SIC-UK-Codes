import { envConfig } from "#configs/index";
import { ERROR_CODES, ErrorCode } from "#constants/index";
import { logger } from "#helpers/index";
import { EntityMatchingIntegrations } from "../messaging/kafka/consumers/handlers/types";
import { TDateISO } from "#types/index";
import { pick } from "#utils/pick";
import axios, { AxiosError, AxiosRequestConfig, isAxiosError, type Method } from "axios";
import type { UUID } from "crypto";
import { StatusCodes } from "http-status-codes";
import https from "https";
import { areAllKybProcessStatusesTerminal } from "./kyb";
import _ from "lodash";
import { NormalizedBusiness } from "#lib/business/normalizedBusiness";
import type { CustomerWithParent } from "@joinworth/types/dist/types/auth/Customer";
import z from "zod-v4";

export class InternalApiError extends Error {
	status: number;
	errorCode: string;

	constructor(message: string, httpStatus: number, errorCode: string) {
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

if (process.env.NODE_ENV === "development") {
	const httpsAgent = new https.Agent({
		rejectUnauthorized: false
	});
	axios.defaults.httpsAgent = httpsAgent;
}

export type BusinessOwner = {
	owner_type: string;
	first_name: string | null;
	last_name: string | null;
	address_line_1: string | null;
	address_line_2?: string | null;
	address_city: string | null;
	address_state: string | null;
	address_postal_code: string | null;
	address_country: string | null;
	mobile: string | null;
	ssn: string | null;
	date_of_birth: string | null;
	email?: string | null;
	ownership_percentage?: number | null;
	title?: {
		id: number;
		title: string;
	};
};

// #region business details types
export type BusinessDetails = {
	id: string;
	name: string;
	tin: string;
	mcc_id?: string | null;
	mcc_code?: string | null;
	mcc_title?: string | null;
	naics_id?: string | null;
	naics_code?: string | null;
	naics_title?: string | null;
	address_line_1: string;
	address_line_2: string | null;
	address_city: string;
	address_state: string;
	address_postal_code: string;
	address_country: string;
	created_at: TDateISO;
	created_by: string;
	updated_at: TDateISO;
	updated_by: string;
	mobile: string | null;
	official_website: string | null;
	public_website: string | null;
	social_account: string | null;
	status: string;
	subscription: {
		status: string | null;
		created_at: string | null;
		updated_at: string | null;
	};
	business_names: Array<{ name: string; is_primary: boolean }>;
	business_addresses: Array<{
		line_1: string;
		apartment: string | null;
		city: string;
		state: string;
		country: string;
		postal_code: string;
		mobile: string | null;
		is_primary: boolean;
	}>;
	owners: Array<BusinessOwner>;
};

type BusinessDetailsResponse =
	| {
			status: "success";
			message: string;
			data: BusinessDetails;
	  }
	| {
			status: "fail";
			message: string;
			errorCode: ErrorCode;
			data: {
				errorName: string;
			};
	  };
// #endregion

// #region process completion types
type ProcessCompletionData = {
	all_kyb_processes_complete: boolean | null;
	last_updated: TDateISO | null;
	tasks: Record<string, { status: string; timestamp: string }> | null;
};

type AppendProcessCompletionResult<T> = T & {
	process_completion_data: ProcessCompletionData;
};
// #endregion

// #region tax consent types
interface TaxConsentData {
	first_name: string;
	last_name: string;
	ssn: string;
	owner_mobile?: string;
	address_line_1: string;
	address_city: string;
	address_state: string;
	address_postal_code: string;
	owner_country?: string;
	tin: string;
	business_name: string;
	mobile?: string;
	title: string;
	business_country?: string;
}

interface TaxConsentResponse {
	// TODO: add pattern matching, similar to how BusinessDetailsResponse is defined and handled
	data: TaxConsentData;
}

interface ScoreFactors {
	id: number;
	code: string;
	label: string;
	category_id: number;
	is_deleted: boolean;
	parent_factor_id: number | null;
	weightage: number;
	factor_id: number;
	value: number;
	score_100: number;
	weighted_score_100: number;
	score_850: number;
	weighted_score_850: number;
	status: string;
	log: string;
}

interface ScoreDistribution {
	id: number;
	code: string;
	label: string;
	is_deleted: boolean;
	total_weightage: number;
	factors: Array<ScoreFactors>;
	score: string;
	score_100: string;
	score_850: string;
}

interface CaseDetailsData {
	id: string;
	created_at: string;
	case_id: string;
	status: string;
	weighted_score_100: string;
	weighted_score_850: string;
	risk_level: string;
	score_decision: string;
	base_score: number;
	score_distribution: Array<ScoreDistribution>;
	is_score_calculated: boolean;
}

export type CaseStatusDetails = {
	id: UUID;
	applicant_id: UUID;
	created_at: string;
	business_name: string;
	status_label: string;
	case_type: number;
	applicant: {
		first_name: string;
		last_name: string;
	};
	status: {
		id: number;
		code: string;
		label: string;
	};
};

interface CaseDetailsResponse {
	data: CaseDetailsData;
}

interface InvitationDetailsResponse {
	id: string;
	business_id: string;
	customer_id: string;
	status: string;
	action_taken_by: string;
	created_at: string;
	created_by: string;
	updated_at: string;
	updated_by: string;
	case_id: string;
	name: string;
	tin: string;
	address_line_1: string;
	address_line_2: string | null;
	address_city: string;
	address_state: string;
	address_postal_code: string;
	address_country: string;
	mobile: string;
	official_website: string | null;
	public_website: string | null;
	social_account: string | null;
	industry: number;
	mcc_id: string | null;
	naics_id: string | null;
}

interface CustomerSettingsResponse {
	status?: string;
	message?: string;
	data?: CustomerData;
}

interface CustomerData {
	customer_id?: string;
	domain?: string;
	settings: CustomerSettings;
	created_at?: string;
	updated_at?: string;
	email?: string | null;
}

interface CustomerSettings {
	domain?: string;
	customURL?: string;
	buttonColor?: string;
	buttonTextColor?: string;
	progressBarColor?: string;
	privacyPolicyLink?: string;
	termsAndConditions?: string;
	onboardingEmailBody?: string;
	thankYouMessageTitle?: string;
	primaryBackgroundColor?: string;
	thankYouMessageBodyText?: string;
	onboardingEmailButtonText?: string;
	companySupportEmailAddress?: string;
	welcomeBackgroundImage?: string;
	isBJLEnabled?: boolean;
}
export interface ScoreByBusinessResponse {
	status: string;
	message: string;
	data: {
		id?: string;
		business_id?: string;
		customer_id?: string;
		weighted_score_100?: string;
		weighted_score_850?: string;
		risk_level?: string;
		score_decision?: string;
		base_score?: string;
		score_distribution?: unknown[];
		is_score_calculated?: boolean;
		[key: string]: unknown;
	};
}
// #endregion
export const TIN_BEHAVIOR = {
	MASK: 0,
	ENCRYPT: 1,
	PLAIN: 2
} as const;
export type TIN_BEHAVIOR = (typeof TIN_BEHAVIOR)[keyof typeof TIN_BEHAVIOR];
export const getBusinessDetails = async (
	businessID: string,
	authorization?: string,
	tinBehavior: TIN_BEHAVIOR = TIN_BEHAVIOR.PLAIN
): Promise<BusinessDetailsResponse> => {
	try {
		const config: AxiosRequestConfig = {
			method: "get",
			url: `${envConfig.CASE_BASE_URL}/api/v1/internal/businesses/${businessID}?fetch_owner_details=true${tinBehavior ? "&tinBehavior=" + tinBehavior : ""}`,
			headers: {
				"Content-Type": "application/json",
				authorization
			}
		};

		const response = await axios.request<BusinessDetailsResponse>(config);

		return response.data;
	} catch (error) {
		if (axios.isAxiosError(error)) {
			logger.debug(error);
			throw new InternalApiError(
				"Something went wrong in fetching business details",
				StatusCodes.INTERNAL_SERVER_ERROR,
				ERROR_CODES.UNKNOWN_ERROR
			);
		}
		// Handle non-Axios errors
		throw error;
	}
};

export const getCaseDetails = async (caseId: string, authorization?: string): Promise<CaseDetailsResponse> => {
	try {
		const config: AxiosRequestConfig = {
			method: "get",
			url: `${envConfig.SCORE_BASE_URL}/api/v1/score/cases/${caseId}`,
			headers: {
				"Content-Type": "application/json",
				authorization
			}
		};

		const response = await axios.request<CaseDetailsResponse>(config);

		return response.data;
	} catch (error) {
		if (axios.isAxiosError(error)) {
			throw new InternalApiError(
				"getCaseDetails: Something went wrong in fetching case details",
				StatusCodes.INTERNAL_SERVER_ERROR,
				ERROR_CODES.UNKNOWN_ERROR
			);
		}
		// Handle non-Axios errors
		throw error;
	}
};

/**
 * Fetches the latest Worth score for a business from the score service.
 * Used by the worth_score fact for workflow auto-approve/auto-decline rules.
 */
export const getScoreByBusinessId = async (businessId: string): Promise<ScoreByBusinessResponse | null> => {
	try {
		const config: AxiosRequestConfig = {
			method: "get",
			url: `${envConfig.SCORE_BASE_URL}/api/v1/internal/score/business/${businessId}`,
			headers: {
				"Content-Type": "application/json"
			}
		};

		const response = await axios.request<ScoreByBusinessResponse>(config);
		return response.data ?? null;
	} catch (error) {
		if (axios.isAxiosError(error)) {
			logger.warn(
				{ err: error, businessId },
				"getScoreByBusinessId: Failed to fetch score (score may not be calculated yet)"
			);
			return null;
		}
		throw error;
	}
};

export const getBusinessDetailsForTaxConsent = async (businessID: string): Promise<TaxConsentResponse> => {
	try {
		const config: AxiosRequestConfig = {
			method: "get",
			url: `${envConfig.CASE_BASE_URL}/api/v1/internal/business/${businessID}`,
			headers: {
				"Content-Type": "application/json"
			}
		};

		const response = await axios.request<TaxConsentResponse>(config);

		return response.data;
	} catch (error) {
		if (axios.isAxiosError(error)) {
			throw new InternalApiError(
				"getBusinessDetailsForTaxConsent: Something went wrong in fetching business details",
				StatusCodes.INTERNAL_SERVER_ERROR,
				ERROR_CODES.UNKNOWN_ERROR
			);
		}
		// Handle non-Axios errors
		throw error;
	}
};

export const getOwners = async (businessID: UUID) => {
	try {
		const config = {
			method: "get",
			url: `${envConfig.CASE_BASE_URL}/api/v1/internal/businesses/${businessID}/owners`,
			headers: {
				"Content-Type": "application/json"
			}
		};

		const response = await axios.request(config);

		return response.data?.data;
	} catch (error) {
		throw new InternalApiError(
			"getOwners: Something went wrong in fetching business owners",
			StatusCodes.INTERNAL_SERVER_ERROR,
			ERROR_CODES.UNKNOWN_ERROR
		);
	}
};

export const getOwnersUnencrypted = async (businessID: UUID) => {
	try {
		const config = {
			method: "get",
			url: `${envConfig.CASE_BASE_URL}/api/v1/internal/businesses/${businessID}/owners/unencrypted`,
			headers: {
				"Content-Type": "application/json"
			}
		};

		const response = await axios.request(config);

		return response.data?.data;
	} catch (error) {
		throw new InternalApiError(
			"getOwnersUnencrypted: Something went wrong in fetching business owners",
			StatusCodes.INTERNAL_SERVER_ERROR,
			ERROR_CODES.UNKNOWN_ERROR
		);
	}
};

export const getBusinessApplicants = async (businessID: string, authorization?: string) => {
	try {
		const config = {
			method: "get",
			maxBodyLength: Infinity,
			url: `${envConfig.AUTH_BASE_URL}/api/v1/internal/businesses/${businessID}/applicants`,
			headers: {
				"Content-Type": "application/json",
				authorization
			},
			data: {}
		};

		const response = await axios(config);
		const { data } = response.data;

		return data;
	} catch (error) {
		logger.error({ message: "Failed to get applicants data", body: parseError(error) });

		throw new InternalApiError(
			"getBusinessApplicants: Something went wrong. Please try again",
			StatusCodes.INTERNAL_SERVER_ERROR,
			ERROR_CODES.UNKNOWN_ERROR
		);
	}
};

export const getCustomerData = async (customerId: string, authorization?: string) => {
	try {
		const config = {
			method: "get",
			maxBodyLength: Infinity,
			url: `${envConfig.AUTH_BASE_URL}/api/v1/internal/customers/${customerId}`,
			headers: {
				"Content-Type": "application/json",
				authorization
			},
			data: {}
		};

		const response = await axios(config);
		const { data } = response.data;

		return data;
	} catch (error) {
		logger.error({ message: "Failed to get customer data", body: parseError(error) });

		throw new InternalApiError(
			"getCustomerData: Something went wrong. Please try again",
			StatusCodes.INTERNAL_SERVER_ERROR,
			ERROR_CODES.UNKNOWN_ERROR
		);
	}
};

export const getCustomerBasicDetails = async (customerID: UUID): Promise<CustomerWithParent> => {
	try {
		const url = `${envConfig.AUTH_BASE_URL}/api/v1/internal/customers/${customerID}/basic`;
		const config = {
			headers: {
				"Content-Type": "application/json"
			}
		};

		const response = await axios.get(url, config);
		return response.data?.data;
	} catch (error: unknown) {
		logger.error({ customerID, error }, "Failed to get customer basic details");
		if (isAxiosError(error)) {
			throw new InternalApiError(
				"getCustomerBasicDetails: Something went wrong. Please try again",
				StatusCodes.INTERNAL_SERVER_ERROR,
				ERROR_CODES.UNKNOWN_ERROR
			);
		}
		throw error;
	}
};

export const getCustomerBusinesses = async (customerID: string, authorization: string) => {
	try {
		const config = {
			method: "get",
			maxBodyLength: Infinity,
			url: `${envConfig.CASE_BASE_URL}/api/v1/businesses/customers/${customerID}?pagination=false`,
			headers: {
				"Content-Type": "application/json",
				authorization
			}
		};

		const response = await axios(config);
		const { data } = response.data;

		return data.records;
	} catch (error) {
		logger.error({ message: "Failed to get customer businesses", body: parseError(error) });

		throw new InternalApiError(
			"getCustomerBusinesses: Something went wrong. Please try again",
			StatusCodes.INTERNAL_SERVER_ERROR,
			ERROR_CODES.UNKNOWN_ERROR
		);
	}
};

export const getOnboardingCustomerSettings = async (customerID: string) => {
	try {
		const config = {
			method: "get",
			maxBodyLength: Infinity,
			url: `${envConfig.CASE_BASE_URL}/api/v1/internal/customers/${customerID}/onboarding-setups`,
			headers: {
				"Content-Type": "application/json"
			}
		};

		const response = await axios(config);
		const { data } = response.data;

		return data;
	} catch (error) {
		logger.error({ message: "Failed to get customer setting for equifax", body: parseError(error) });

		throw new InternalApiError(
			"getOnboardingCustomerSettings: Something went wrong. Please try again",
			StatusCodes.INTERNAL_SERVER_ERROR,
			ERROR_CODES.UNKNOWN_ERROR
		);
	}
};

export const getCustomerBusinessConfigs = async (customerID: string, businessID: string) => {
	try {
		const config = {
			method: "get",
			maxBodyLength: Infinity,
			url: `${envConfig.CASE_BASE_URL}/api/v1/internal/customers/${customerID}/businesses/${businessID}/configs`,
			headers: {
				"Content-Type": "application/json"
			}
		};

		const response = await axios(config);
		const { data } = response.data;

		return data;
	} catch (error) {
		logger.error({ message: "Failed to get customer business configs", body: parseError(error) });

		throw new InternalApiError(
			"getCustomerBusinessConfigs: Something went wrong. Please try again",
			StatusCodes.INTERNAL_SERVER_ERROR,
			ERROR_CODES.UNKNOWN_ERROR
		);
	}
};

export const internalGetCaseByID = async (caseID: string) => {
	try {
		const config = {
			method: "get",
			maxBodyLength: Infinity,
			url: `${envConfig.CASE_BASE_URL}/api/v1/internal/cases/${caseID}`,
			headers: {
				"Content-Type": "application/json"
			}
		};

		const response = await axios(config);
		const { data } = response.data;

		return data;
	} catch (error) {
		logger.error({ message: "Failed to get case details", body: parseError(error) });

		throw new InternalApiError(
			"internalGetCaseByID: Something went wrong. Please try again",
			StatusCodes.INTERNAL_SERVER_ERROR,
			ERROR_CODES.UNKNOWN_ERROR
		);
	}
};

export const getBusinessCustomers = async (businessID: string, body?: any) => {
	try {
		const config = {
			method: "get",
			maxBodyLength: Infinity,
			url: `${envConfig.CASE_BASE_URL}/api/v1/internal/businesses/${businessID}/customers`,
			headers: {
				"Content-Type": "application/json"
			},
			...(body && { data: body })
		};

		const response = await axios(config);
		const { data } = response.data;

		return data;
	} catch (error) {
		logger.error({ message: `Failed to get customers of business: ${businessID}`, body: parseError(error) });

		throw new InternalApiError(
			"getBusinessCustomers: Something went wrong. Please try again",
			StatusCodes.INTERNAL_SERVER_ERROR,
			ERROR_CODES.UNKNOWN_ERROR
		);
	}
};

export const getCustomerCountries = async (customerID: string, setupId: number) => {
	try {
		const config = {
			method: "get",
			maxBodyLength: Infinity,
			url: `${envConfig.CASE_BASE_URL}/api/v1/internal/customers/${customerID}/onboarding-setups/${setupId}/countries`,
			headers: {
				"Content-Type": "application/json"
			}
		};

		const response = await axios(config);
		const { data } = response.data;

		return data;
	} catch (error) {
		logger.error({
			message: `Failed to get customer countries for customer: ${customerID}, setupId: ${setupId}`,
			body: parseError(error)
		});

		throw new InternalApiError(
			"getCustomerCountries: Something went wrong. Please try again",
			StatusCodes.INTERNAL_SERVER_ERROR,
			ERROR_CODES.UNKNOWN_ERROR
		);
	}
};

export const getCustomerIntegrationStatus = async (customerID: string) => {
	try {
		const config = {
			method: "get",
			maxBodyLength: Infinity,
			url: `${envConfig.INTEGRATION_BASE_URL}/api/v1/internal/customers/${customerID}/integration-status`,
			headers: {
				"Content-Type": "application/json"
			}
		};

		const response = await axios(config);
		const { data } = response.data;

		return data;
	} catch (error) {
		logger.error({
			message: `Failed to get customer integration status for customer: ${customerID}`,
			body: parseError(error)
		});

		throw new InternalApiError(
			"getCustomerIntegrationStatus: Something went wrong. Please try again",
			StatusCodes.INTERNAL_SERVER_ERROR,
			ERROR_CODES.UNKNOWN_ERROR
		);
	}
};

export const createCaseOnApplicationEdit = async (businessID: UUID, body: any, authorization: string) => {
	try {
		const config = {
			method: "post",
			url: `${envConfig.CASE_BASE_URL}/api/v1/internal/businesses/${businessID}/case`,
			headers: {
				"Content-Type": "application/json",
				authorization
			},
			data: body
		};

		const response = await axios.request(config);

		return response.data?.data;
	} catch (error: any) {
		throw new InternalApiError(
			`createCaseOnApplicationEdit: Something went wrong while creating cases during application edit: ${error.message}`,
			StatusCodes.INTERNAL_SERVER_ERROR,
			ERROR_CODES.UNKNOWN_ERROR
		);
	}
};

export const getCases = async payload => {
	try {
		const config = {
			method: "get",
			maxBodyLength: Infinity,
			url: `${envConfig.CASE_BASE_URL}/api/v1/internal/cases`,
			headers: {
				"Content-Type": "application/json"
			},
			data: payload
		};

		const response = await axios(config);
		const { data } = response.data;

		return data.records;
	} catch (error) {
		logger.error({ message: `Failed to get cases`, body: parseError(error) });
		if (axios.isAxiosError(error)) {
			throw new InternalApiError(
				`getCases: Something went wrong. Please try again: ${error.message}`,
				StatusCodes.INTERNAL_SERVER_ERROR,
				ERROR_CODES.UNKNOWN_ERROR
			);
		}
		throw error;
	}
};
export const internalGetBusinessByTin = async (tin: string | number): Promise<any[]> => {
	try {
		return caseRequest(`v1/internal/businesses/tin/${tin}`);
	} catch (error) {
		logger.error({ message: "Could not locate business by TIN", tin });
		throw new InternalApiError(
			"internalGetBusinessByTin: Something went wrong. Please try again",
			StatusCodes.INTERNAL_SERVER_ERROR,
			ERROR_CODES.UNKNOWN_ERROR
		);
	}
};
export const internalGetCustomerBusinessByExternalId = async (
	customerId: UUID,
	externalId: string
): Promise<unknown[]> => {
	try {
		return caseRequest(`v1/internal/businesses/customers/${customerId}/external_id/${externalId}`);
	} catch (error) {
		logger.error({ message: "Could not locate business by external id", customerId, externalId });
		throw new InternalApiError(
			"internalGetCustomerBusinessByExternalId: Something went wrong. Please try again",
			StatusCodes.INTERNAL_SERVER_ERROR,
			ERROR_CODES.UNKNOWN_ERROR
		);
	}
};

export const internalGetCustomerBusinessBylId = async (customerId: UUID, Id: string): Promise<unknown[]> => {
	try {
		return caseRequest(`v1/internal/businesses/customers/${customerId}/${Id}`);
	} catch (error) {
		logger.error({ message: "Could not locate business by id", customerId, Id: Id });
		throw new InternalApiError(
			"internalGetCustomerBusinessById: Something went wrong. Please try again",
			StatusCodes.INTERNAL_SERVER_ERROR,
			ERROR_CODES.UNKNOWN_ERROR
		);
	}
};

export const internalValidateCustomerBusiness = async (
	customerId: UUID,
	businessData: string[]
): Promise<{ success?: { required: any[]; mapped: any[]; rejected: any[] }; error?: any[] }> => {
	try {
		return caseRequest(
			`v1/internal/businesses/customers/${customerId}/bulk/validate`,
			"post",
			businessData.join("\n"),
			{ "Content-Type": "text/csv" }
		);
	} catch (error) {
		logger.error({ message: "Could not validate business", customerId, businessData });
		throw new InternalApiError(
			"internalValidateCustomerBusiness: Something went wrong. Please try again",
			StatusCodes.INTERNAL_SERVER_ERROR,
			ERROR_CODES.UNKNOWN_ERROR
		);
	}
};
export const internalProcessCustomerBusiness = async (
	customerId: UUID,
	businessData: string[]
): Promise<{ result?: any[]; error?: any[] }> => {
	try {
		return caseRequest(`v1/internal/businesses/customers/${customerId}/bulk/process`, "post", businessData.join("\n"), {
			"Content-Type": "text/csv"
		});
	} catch (error) {
		logger.error({ message: "Could not process business", customerId, businessData });
		throw new InternalApiError(
			"internaProcessCustomerBusiness: Something went wrong. Please try again",
			StatusCodes.INTERNAL_SERVER_ERROR,
			ERROR_CODES.UNKNOWN_ERROR
		);
	}
};
export type BusinessName = {
	name: string;
	is_primary: boolean;
};
export const BusinessAddressSchema = z.object({
	line_1: z.string(),
	apartment: z.string().nullable().optional(),
	city: z.string(),
	state: z.string(),
	country: z.string(),
	postal_code: z.string(),
	mobile: z.string().nullable().optional(),
	is_primary: z.boolean()
});
export type BusinessAddress = z.infer<typeof BusinessAddressSchema>;

export type BusinessNamesAndAddresses = {
	businessID: UUID;
	names: BusinessName[];
	addresses: BusinessAddress[];
};
export const internalGetBusinessNamesAndAddresses = async (businessID: UUID): Promise<BusinessNamesAndAddresses> => {
	try {
		return caseRequest(`v1/internal/businesses/${businessID}/names-addresses`);
	} catch (error) {
		logger.error({ message: "Could not get business names and addresses", businessID });
		throw new InternalApiError(
			"internalGetBusinessNamesAndAddresses: Something went wrong. Please try again",
			StatusCodes.INTERNAL_SERVER_ERROR,
			ERROR_CODES.UNKNOWN_ERROR
		);
	}
};
/** Shortcut to make a request to the Cases service  */
const caseRequest = async (path: string, method?: Method, body?: any, headers?: Record<string, any>) => {
	const config = {
		method: method ?? "get",
		maxBodyLength: Infinity,
		url: `${envConfig.CASE_BASE_URL}/api/${path.trim()}`,
		headers: {
			"Content-Type": "application/json",
			...headers
		},
		data: body
	};
	const response = await axios(config);
	const { data } = response.data;

	return data;
};

export const getRiskCases = async () => {
	try {
		const config = {
			method: "get",
			maxBodyLength: Infinity,
			url: `${envConfig.CASE_BASE_URL}/api/v1/internal/risk-alerts/cases`,
			headers: {
				"Content-Type": "application/json"
			}
		};

		const response = await axios(config);
		const { data } = response.data;

		return data;
	} catch (error) {
		logger.error({ message: "Failed to get risk cases", body: parseError(error) });

		throw new InternalApiError(
			"getRiskCases: Something went wrong. Please try again",
			StatusCodes.INTERNAL_SERVER_ERROR,
			ERROR_CODES.UNKNOWN_ERROR
		);
	}
};
//this function call only single time
export const InternalDeleteDuplicateRisksById = async (body: any): Promise<unknown[]> => {
	try {
		const config = {
			method: "post",
			url: `${envConfig.CASE_BASE_URL}/api/v1/internal/risk-alerts/delete-duplicate`,
			headers: {
				"Content-Type": "application/json"
			},
			data: body
		};

		const response = await axios.request(config);

		return response.data?.data;
	} catch (error) {
		logger.error({ message: "Failed to delete duplicate risk cases", body: parseError(error) });
		throw new InternalApiError(
			"InternalDeleteDuplicateRisksById: Something went wrong. Please try again",
			StatusCodes.INTERNAL_SERVER_ERROR,
			ERROR_CODES.UNKNOWN_ERROR
		);
	}
};

export const getInvitationDetails = async (invitationID: string): Promise<InvitationDetailsResponse> => {
	try {
		const config: AxiosRequestConfig = {
			method: "get",
			url: `${envConfig.CASE_BASE_URL}/api/v1/internal/invitation/${invitationID}`,
			headers: {
				"Content-Type": "application/json"
			}
		};

		const { data } = await axios.request(config);

		return data.data;
	} catch (error: any) {
		logger.error({ error }, "getInvitationDetails");
		if (axios.isAxiosError(error)) {
			throw new InternalApiError(
				"getInvitationDetails: Something went wrong in fetching invitation details",
				StatusCodes.INTERNAL_SERVER_ERROR,
				ERROR_CODES.UNKNOWN_ERROR
			);
		}
		// Handle non-Axios errors
		throw error;
	}
};

export const internalGetNaicsCode = async (
	naicsCode?: string
): Promise<
	Array<{
		naics_code: number;
		naics_id: number;
		naics_label: string;
		mcc_id: number;
		mcc_code: number;
		mcc_label: string;
	}>
> => {
	try {
		let url = `v1/internal/core/naics`;
		if (naicsCode) {
			url += `?code=${naicsCode}`;
		}
		return caseRequest(url);
	} catch (error) {
		logger.error({ message: "Could not get naics info", naicsCode });
		throw new InternalApiError(
			"internalGetNaicsCode: Something went wrong. Please try again",
			StatusCodes.INTERNAL_SERVER_ERROR,
			ERROR_CODES.UNKNOWN_ERROR
		);
	}
};
export const internalGetMccCode = async (
	mccCode?: string
): Promise<
	Array<{
		naics_code: number;
		naics_id: number;
		naics_label: string;
		mcc_id: number;
		mcc_code: number;
		mcc_label: string;
	}>
> => {
	try {
		let url = `v1/internal/core/mcc`;
		if (mccCode) {
			url += `?code=${mccCode}`;
		}
		return caseRequest(url);
	} catch (error) {
		logger.error({ message: "Could not get mcc info", mccCode });
		throw new InternalApiError(
			"internalGetMccCode: Something went wrong. Please try again",
			StatusCodes.INTERNAL_SERVER_ERROR,
			ERROR_CODES.UNKNOWN_ERROR
		);
	}
};
export const internalGetIndustries = async (
	sectorCode?: number
): Promise<Array<{ id: number; name: string; sector_code: number }>> => {
	try {
		let url = `v1/internal/core/business-industries`;
		if (sectorCode) {
			url += `?sector=${sectorCode}`;
		}
		return caseRequest(url);
	} catch (error) {
		logger.error({ message: "Could not get industry information" });
		throw new InternalApiError(
			"internalGetIndustries: Something went wrong. Please try again",
			StatusCodes.INTERNAL_SERVER_ERROR,
			ERROR_CODES.UNKNOWN_ERROR
		);
	}
};

export const getCustomerSettings = async (customerId: string): Promise<CustomerSettingsResponse> => {
	try {
		const config: AxiosRequestConfig = {
			method: "get",
			url: `${envConfig.NOTIFICATION_BASE_URL}/api/v1/internal/customer-settings/${customerId}`,
			headers: {
				"Content-Type": "application/json"
			}
		};

		const response = await axios.request<BusinessDetailsResponse>(config);

		return response.data as unknown as CustomerSettingsResponse;
	} catch (error) {
		if (axios.isAxiosError(error)) {
			logger.debug(error);
			throw new InternalApiError(
				"Something went wrong in fetching customer settings",
				StatusCodes.INTERNAL_SERVER_ERROR,
				ERROR_CODES.UNKNOWN_ERROR
			);
		}
		throw error;
	}
};

export const getCustomerOnboardingStagesSettings = async (customerID: string, setupType: string) => {
	try {
		const config = {
			method: "get",
			maxBodyLength: Infinity,
			url: `${envConfig.CASE_BASE_URL}/api/v1/internal/customers/${customerID}/customer-onboarding-stages?setupType=${setupType}`,
			headers: {
				"Content-Type": "application/json"
			}
		};

		const response = await axios(config);
		const { data } = response.data;

		return data;
	} catch (error) {
		logger.error({ message: "Failed to get customer onboarding stages", body: parseError(error) });

		throw new InternalApiError(
			"getCustomerOnboardingStagesSettings: Something went wrong. Please try again",
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
			headers: {
				"Content-Type": "application/json",
				authorization: `Bearer ${envConfig.ECONSENT_API_KEY}`
			},
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

/**
 * Translate an array of title IDs to their human-readable titles.
 *
 * @param titleIdsArr - Array of numeric title IDs, e.g. [3, 8]
 * @returns An array of title strings corresponding to each provided ID, e.g. ["Director", "President"]
 */
export async function getOwnerTitles(): Promise<Array<{ id: number; title: string }>> {
	try {
		const config = {
			method: "get",
			maxBodyLength: Infinity,
			url: `${envConfig.CASE_BASE_URL}/api/v1/internal/titles`,
			headers: {
				"Content-Type": "application/json"
			}
		};

		const response = await axios(config);
		return response.data?.data;
	} catch (error) {
		logger.error({ message: "Failed to fetch titles", body: parseError(error) });
		throw new InternalApiError(
			"getOwnerTitles: Failed to fetch titles ",
			StatusCodes.INTERNAL_SERVER_ERROR,
			ERROR_CODES.UNKNOWN_ERROR
		);
	}
}

export const getDocuments = async (businessID: UUID, caseID: UUID) => {
	try {
		const config = {
			method: "get",
			maxBodyLength: Infinity,
			url: `${envConfig.CASE_BASE_URL}/api/v1/internal/businesses/${businessID}/documents${caseID ? `?caseID=${caseID}` : ""}`,
			headers: {
				"Content-Type": "application/json"
			}
		};

		const response = await axios(config);
		const { data } = response.data;

		return data;
	} catch (error: any) {
		logger.error({ message: "Failed to get documents", body: parseError(error) });

		throw new InternalApiError(
			`getDocuments: Something went wrong. Please try again: ${error.message} : ${error?.response?.data?.message}`,
			StatusCodes.INTERNAL_SERVER_ERROR,
			ERROR_CODES.UNKNOWN_ERROR
		);
	}
};

export interface EntityMatchingAddress {
	address: string;
	city: string;
	state: string;
	zip: string;
	country: string;
}

interface ExtraMatchingInfo {
	npi: string; // Optional for NPI Requests
	first_name: string; // Required for NPI Request
	last_name: string; // Required for NPI Request
	email: string;
	phone: string;
	website: string;
	title: string;
}

interface EntityMatchingPayload {
	business_id: UUID;
	names: string[];
	addresses: Array<EntityMatchingAddress>;
	extra?: Partial<ExtraMatchingInfo>;
	source?: string;
}

interface EntityMatchingResponse {
	business_id: UUID;
	match_id: UUID;
	status: "pending";
	names: string[];
	addresses: Array<EntityMatchingAddress & { collected_at: string }>;
}

interface ConfidenceScorePayload {
	business: NormalizedBusiness;
	integration_business: NormalizedBusiness;
}

interface ConfidenceScoreResponse {
	integration_business: Record<string, any>;
	prediction: number;
	extra_verification: Record<string, boolean | null>;
}

export const confidenceScore = async (payload: ConfidenceScorePayload): Promise<ConfidenceScoreResponse> => {
	try {
		const config = {
			method: "post",
			maxBodyLength: Infinity,
			url: `${envConfig.WAREHOUSE_BASE_URL}/matching/confidence`,
			headers: {
				"Content-Type": "application/json"
			},
			data: payload
		};
		const response = await axios(config);
		const data: ConfidenceScoreResponse = response.data;

		return data;
	} catch (error: any) {
		logger.error({ message: "Failed to fetch confidence score", body: payload });
		// Specific handling for 422 Unprocessable Entity as this is likely user error.
		if (error?.response?.status === 422) {
			// If Input data was invalid, this will throw a validation error
			// which contains details about what was wrong with the input data
			throw new InternalApiError(
				`confidenceScore: Validation error. Please check the input data: ${error.response.details}`,
				StatusCodes.UNPROCESSABLE_ENTITY,
				ERROR_CODES.VALIDATION_ERROR
			);
		}
		throw new InternalApiError(
			`confidenceScore: Something went wrong. Please try again: ${error.message} : ${error?.response?.data?.message}`,
			StatusCodes.INTERNAL_SERVER_ERROR,
			ERROR_CODES.UNKNOWN_ERROR
		);
	}
};

export const confidenceScoreMany = async (
	customerSubmittedBusiness: NormalizedBusiness,
	integrationBusinesses: NormalizedBusiness[]
): Promise<ConfidenceScoreResponse[] | undefined> => {
	if (customerSubmittedBusiness && integrationBusinesses.length === 0) {
		return;
	}

	const payloads: ConfidenceScorePayload[] = [];

	for (const integrationBusiness of integrationBusinesses) {
		payloads.push({ business: customerSubmittedBusiness, integration_business: integrationBusiness });
	}

	// Fire all confidenceScore requests concurrently
	const results = await Promise.allSettled(payloads.map(payload => confidenceScore(payload)));

	// Filter for fulfilled promises only
	const fulfilledResults: ConfidenceScoreResponse[] = results
		.filter((r): r is PromiseFulfilledResult<ConfidenceScoreResponse> => r.status === "fulfilled")
		.map(r => r.value);

	// Optionally log errors if you want visibility
	const rejectedResults = results.filter(r => r.status === "rejected");
	if (rejectedResults.length > 0) {
		console.warn(`⚠️ ${rejectedResults.length} confidenceScore calls failed`);
	}

	return fulfilledResults;
};

export const entityMatching = async (payload: EntityMatchingPayload): Promise<EntityMatchingResponse> => {
	try {
		const config = {
			method: "post",
			maxBodyLength: Infinity,
			url: `${envConfig.WAREHOUSE_BASE_URL}/matching/match`,
			headers: {
				"Content-Type": "application/json"
			},
			data: payload
		};

		const maxAttempts = 3;
		let lastError: any;
		for (let attempt = 0; attempt < maxAttempts; attempt++) {
			try {
				const response = await axios(config);
				const data = response.data;
				return data;
			} catch (error: unknown) {
				lastError = error;
				if (isAxiosError(error)) {
					const message = String(error?.message || "").toLowerCase();
					const code = String(error?.code || "");
					// check for socket hang up or connection reset or connection aborted
					const isSocketHangup = message.includes("socket hang up") || code === "ECONNRESET" || code === "ECONNABORTED";
					if (isSocketHangup && attempt < maxAttempts) {
						const delayMs = 1000 * (attempt + 1);
						logger.warn(
							{ attempt: attempt + 1, delayMs, code, message },
							`entityMatching: retrying after socket hang up: ${code}`
						);
						await new Promise(resolve => setTimeout(resolve, delayMs));
						continue;
					}
					break;
				}
			}
		}
		throw lastError;
	} catch (error: any) {
		logger.error({ payload, message: "Failed to submit request to entityMatching", body: parseError(error) });

		throw new InternalApiError(
			`entityMatching: Something went wrong. Please try again: ${error.message} : ${error?.response?.data?.message}`,
			StatusCodes.INTERNAL_SERVER_ERROR,
			ERROR_CODES.UNKNOWN_ERROR
		);
	}
};

interface EntityMatchingResult {
	matches: Array<{
		match_id: string;
		business_id: string;
		source: EntityMatchingIntegrations;
		match: MatchDetails;
		prediction: number;
	}>;
}

type MatchDetails = {
	zip: string;
	zip3: string;
	city: string;
	name: string;
	state: string;
	source: string;
	address: string;
	address_2: string;
	company_id: string;
	short_name: string;
	state_code: string;
	location_id: string;
	street_name: string;
	collected_at: string;
	street_number: number;
	es_location_id: string;
	normalised_address: string;
	normalised_address_2: string;
};

export const getEntityMatchingResults = async (matchId: string): Promise<EntityMatchingResult> => {
	try {
		const config = {
			method: "get",
			maxBodyLength: Infinity,
			url: `${envConfig.WAREHOUSE_BASE_URL}/matching/results/${matchId}`,
			headers: {
				"Content-Type": "application/json"
			}
		};

		const response = await axios(config);
		const data = response.data;

		return data;
	} catch (error: any) {
		logger.error({ message: "Failed to getEntityMatchingResults", body: parseError(error) });

		throw new InternalApiError(
			`getEntityMatchingResults: Something went wrong. Please try again: ${error.message} : ${error?.response?.data?.message}`,
			StatusCodes.INTERNAL_SERVER_ERROR,
			ERROR_CODES.UNKNOWN_ERROR
		);
	}
};

export const updateAuthRedisCache = async customerID => {
	try {
		const config = {
			method: "post",
			maxBodyLength: Infinity,
			url: `${envConfig.CASE_BASE_URL}/api/v1/internal/customer-authorization/update-cache/${customerID}`,
			headers: {
				"Content-Type": "application/json"
			}
		};

		const response = await axios(config);
		const { data } = response.data;

		return data;
	} catch (error) {
		logger.error({ message: "Failed to update auth redis cache", body: parseError(error) });
		if (axios.isAxiosError(error)) {
			if (error.response?.data?.errorCode === ERROR_CODES.INVALID) {
				throw new InternalApiError(
					"updateAuthRedisCache: issue while updating redis cache",
					StatusCodes.NOT_FOUND,
					ERROR_CODES.NOT_FOUND
				);
			}
			throw new InternalApiError(
				"updateAuthRedisCache: Something went wrong. Please try again",
				StatusCodes.INTERNAL_SERVER_ERROR,
				ERROR_CODES.UNKNOWN_ERROR
			);
		}
		throw error;
	}
};

export const setApplicationEditData = async (businessID: UUID, body: any) => {
	try {
		const config = {
			method: "post",
			url: `${envConfig.CASE_BASE_URL}/api/v1/internal/business/${businessID}/application-edit`,
			headers: {
				"Content-Type": "application/json"
			},
			data: body
		};

		logger.info(`config: ${JSON.stringify(config)}`);

		const response = await axios.request(config);

		return response.data?.data;
	} catch (error) {
		logger.error({ message: "Failed to set Application Edit Data", body: parseError(error) });
		throw new InternalApiError(
			"setApplicationEditData: Something went wrong in setting application edit data",
			StatusCodes.INTERNAL_SERVER_ERROR,
			ERROR_CODES.UNKNOWN_ERROR
		);
	}
};

export const getApplicationEdit = async (businessID: string, body?: { stage_name?: string }) => {
	try {
		const config = {
			method: "get",
			url: `${envConfig.CASE_BASE_URL}/api/v1/internal/business/${businessID}/application-edit`,
			headers: {
				"Content-Type": "application/json"
			},
			data: body
		};

		const response = await axios.request(config);
		return response.data;
	} catch (error) {
		logger.error({ message: "Failed to get Application Edit Data", body: parseError(error) });
		if (axios.isAxiosError(error)) {
			throw new InternalApiError(
				"getApplicationEdit: Something went wrong in fetching application edit details",
				StatusCodes.INTERNAL_SERVER_ERROR,
				ERROR_CODES.UNKNOWN_ERROR
			);
		}
		// Handle non-Axios errors
		throw error;
	}
};

export const getBusinessFacts = async (businessID: UUID) => {
	try {
		const config = {
			method: "get",
			url: `${envConfig.WAREHOUSE_BASE_URL}/facts/${businessID}`,
			headers: {
				"Content-Type": "application/json"
			}
		};

		const response = await axios.request(config);
		return response.data;
	} catch (error) {
		logger.error({ message: "Failed to get Facts Data", body: parseError(error) });
		if (axios.isAxiosError(error)) {
			throw new InternalApiError(
				"getBusinessFacts: Something went wrong in fetching facts details",
				StatusCodes.INTERNAL_SERVER_ERROR,
				ERROR_CODES.UNKNOWN_ERROR
			);
		}
		// Handle non-Axios errors
		throw error;
	}
};

export const getBusinessFactsByKeys = async (businessID: UUID, facts: string[]): Promise<Record<string, any>> => {
	try {
		const config = {
			method: "post",
			url: `${envConfig.WAREHOUSE_BASE_URL}/facts/${businessID}`,
			headers: {
				"Content-Type": "application/json"
			},
			data: { facts_required: facts }
		};

		const response = await axios.request(config);

		const factMap = response.data.reduce((acc, fact) => {
			acc[fact.name] = fact.value.value; // The Object structure is data -> [{ name, value: { value: value }}}]
			return acc;
		}, {});

		return factMap;
	} catch (error) {
		logger.error({
			message: "Failed to get Facts Data by keys",
			body: parseError(error),
			request: { businessID, facts }
		});
		throw new InternalApiError(
			"getBusinessFactsByKeys: Something went wrong in fetching facts details by keys",
			StatusCodes.INTERNAL_SERVER_ERROR,
			ERROR_CODES.UNKNOWN_ERROR
		);
	}
};

const isEmptyEquivalent = (a: any, b: any): boolean => {
	const normalizeEmpty = (val: any) => {
		if (_.isNil(val)) return null;
		if (typeof val === "string") {
			try {
				val = JSON.parse(val);
			} catch {
				// not a JSON string, leave as is
			}
		}
		if (_.isPlainObject(val) && _.isEmpty(val)) return null;
		if (Array.isArray(val) && val.length === 0) return null;
		return val;
	};

	return _.isEqual(normalizeEmpty(a), normalizeEmpty(b));
};

const normalize = (val: any): any => {
	if (val === null || val === undefined) return null;

	if (typeof val === "string") {
		const num = Number(val);
		if (!isNaN(num) && val.trim() !== "") return num;

		if (val.trim().toLowerCase() === "true") return true;
		if (val.trim().toLowerCase() === "false") return false;

		if (["null", "undefined"].includes(val.trim().toLowerCase())) return null;
	}

	return val;
};

const safeValue = (val: any) => {
	if (val === undefined) return null;
	if (_.isPlainObject(val) || Array.isArray(val)) return JSON.stringify(val);
	return String(val);
};

export const extractEdits = (fieldPrefix: string, original: any, updated: any, useUnion: boolean = false) => {
	const edits: any[] = [];

	const normOld = normalize(original);
	const normNew = normalize(updated);

	if (!_.isPlainObject(normOld) && !_.isPlainObject(normNew)) {
		if (_.isEqual(normOld, normNew) || isEmptyEquivalent(normOld, normNew)) {
			return edits;
		}

		edits.push({
			field_name: fieldPrefix,
			old_value: safeValue(original),
			new_value: safeValue(updated),
			metadata: {}
		});
		logger.info(`Final edits: ${JSON.stringify(edits, null, 2)}`);
		return edits;
	}

	const allKeys = useUnion
		? _.union(_.keys(original || {}), _.keys(updated || {}))
		: _.intersection(_.keys(original || {}), _.keys(updated || {}));
	for (const key of allKeys) {
		const oldVal = normalize(original?.[key]);
		const newVal = normalize(updated?.[key]);

		if (_.isEqual(oldVal, newVal)) continue;

		edits.push({
			field_name: `${fieldPrefix}.${key}`,
			old_value: safeValue(original?.[key]),
			new_value: safeValue(updated?.[key]),
			metadata: {}
		});
	}
	logger.info(`Final edits: ${JSON.stringify(edits, null, 2)}`);
	return edits;
};

export const getInternalCaseByBusinessId = async (businessID: UUID): Promise<CaseStatusDetails[]> => {
	const URL = `${envConfig.CASE_BASE_URL}/api/v1/internal/businesses/${businessID}/cases`;
	try {
		const config = {
			method: "get",
			maxBodyLength: Infinity,
			url: URL,
			headers: {
				"Content-Type": "application/json"
			}
		};
		const response = await axios.request(config);
		const { data } = response.data;

		return data.records as CaseStatusDetails[];
	} catch (error) {
		logger.error({ message: `Failed to get case by business ID: ${businessID}`, body: parseError(error) });
		throw new InternalApiError(
			"getInternalCaseByBusinessId: Something went wrong. Please try again",
			StatusCodes.INTERNAL_SERVER_ERROR,
			ERROR_CODES.UNKNOWN_ERROR
		);
	}
};
