import { CertificateMetadata } from "#lib/fileHandler";

/**
 * Interface for the Drivers License information.
 * All fields are optional and can be null.
 */
interface DriversLicense {
	number: string | null;
	country: string | null;
	countrySubdivision: string | null;
}

/**
 * Interface for the address details of a merchant or principal.
 */
interface Address {
	city: string;
	country: string;
	province: string;
	postalCode: string;
	isOtherCity: string; // "Y" or "N"
	addressLineOne: string;
	addressLineTwo: string | null;
	countrySubdivision: string;
}

/**
 * Interface for the Principal (individual associated with the merchant).
 */
interface Principal {
	email: string;
	address: Address;
	lastName: string;
	firstName: string;
	nationalId: string | null;
	dateOfBirth: string; // Contains a value like "*****"
	phoneNumber: string;
	middleInitial: string | null;
	altPhoneNumber: string;
	driversLicense: DriversLicense;
}

/**
 * Interface for URL lists within a URL group.
 */
interface UrlList {
	urls: string[];
}

/**
 * Interface for the URL groups associated with a merchant.
 */
interface UrlGroup {
	noMatchUrls: UrlList;
	closeMatchUrls: UrlList;
	exactMatchUrls: UrlList;
}

/**
 * Interface for a terminated merchant's details.
 */
interface Merchant {
	name: string;
	address: Address;
	comments: string | null;
	urlGroups: UrlGroup[];
	dateClosed: string; // ISO 8601 date string
	dateOpened: string; // ISO 8601 date string
	merchantId: string;
	principals: Principal[];
	reasonCode: string;
	createdDate: string; // ISO 8601 date string
	merchRefNum: string;
	phoneNumber: string;
	nationalTaxId: string | null;
	subMerchantId: string;
	altPhoneNumber: string;
	reasonCodeDesc: string;
	merchantCategory: string;
	addedByAcquirerId: string;
	doingBusinessAsName: string;
	countrySubdivisionTaxId: string | null;
}

/**
 * Interface for the principal match details.
 */
interface PrincipalMatch {
	name: string;
	email: string;
	address: string;
	nationalId: string;
	dateOfBirth: string;
	phoneNumber: string;
	altPhoneNumber: string;
	driversLicense: string;
}

/**
 * Interface for the merchant match details.
 */
interface MerchantMatch {
	name: string;
	address: string;
	phoneNumber: string;
	nationalTaxId: string;
	altPhoneNumber: string;
	principalMatches: PrincipalMatch[];
	doingBusinessAsName: string;
	countrySubdivisionTaxId: string;
}

/**
 * Interface for a single terminated merchant and its match details.
 */
export interface TerminatedMerchant {
	merchant: Merchant;
	merchantMatch: MerchantMatch;
}

/**
 * Interface for a group of possible merchant matches.
 */
interface PossibleMerchantMatch {
	terminatedMerchants: TerminatedMerchant[];
}

/**
 * The root interface for the entire response object.
 */
export interface TerminationInquiryResponse {
	ref: string;
	pageOffset: number;
	possibleMerchantMatches: PossibleMerchantMatch[];
}

/**
 * The root interface for the entire payload object.
 */
export interface TerminationInquiryRequest {
	terminationInquiryRequest: {
		acquirerId: string;
		merchant: {
			name: string;
			doingBusinessAsName: string;
			merchantId: string;
			subMerchantId: string;
			address: {
				addressLineOne: string;
				addressLineTwo: string;
				city: string;
				isOtherCity: string;
				countrySubdivision: string;
				country: string;
				postalCode: string;
			};
			phoneNumber: string;
			altPhoneNumber: string;
			merchantCategory: string;
			nationalTaxId: string;
			countrySubdivisionTaxId: string;
			urls: string[];
			principals: {
				firstName: string;
				middleInitial: string;
				lastName: string;
				address: {
					addressLineOne: string;
					addressLineTwo: string;
					city: string;
					isOtherCity: string;
					countrySubdivision: string;
					postalCode: string;
					country: string;
				};
				phoneNumber: string;
				altPhoneNumber: string;
				email: string;
				driversLicense: {
					number: string;
					countrySubdivision: string;
					country: string;
				};
				dateOfBirth: string;
				nationalId: string;
			}[];
			searchCriteria: {
				minPossibleMatchCount: string;
			};
		};
	};
}

/**
 * The secrets interface.
 */
export interface Secrets {
	customerId: string;
	customerName: string;
	consumerKey: string;
	privateKey: string;
	icas: Array<ICAInput>;
	/** @deprecated Use `icas` instead. Kept for backward compatibility. */
	acquirerId?: string;
	isActive: boolean;
	metadata: CertificateMetadata;
}

export interface ICAObject {
	ica: string;
	isDefault: boolean;
}

export type ICAInput = ICAObject | string;

/**
 * Enum for connection status values returned by checkConnection
 */
export enum connectionStatus {
	CONNECTED = "connected",
	NOT_CONNECTED = "not-connected",
	EXPIRED = "expired",
	ERROR = "error"
}

/**
 * Interface for checkConnection response
 */
export interface connectionResult {
	status: connectionStatus;
	message?: string;
	details?: {
		expiresAt?: string;
		statusCode?: number;
		certificateExpiry?: string;
		error?: string;
		isActive?: boolean;
	};
}

export interface ResponseBody {
	keyPassword?: string;
	customerName?: string;
	consumerKey?: string;
	icas?: Array<ICAObject> | string;
	isActive: boolean;
}

export interface ReasonCode {
	title: string;
	description: string;
}

export interface ResponseCodeStatus {
	variant: "info" | "success" | "warning" | "error";
	text: string;
}

export const VALUE_NOT_AVAILABLE = "N/A";

export const REASON_CODE_MAP: Record<number, ReasonCode> = {
	1: {
		title: "Account data compromise",
		description:
			"This business was terminated due to involvement in a data breach or unauthorized access to account data."
	},
	2: {
		title: "Common Point of Purchase",
		description:
			"This business was identified as a point where multiple cards were compromised — often part of a larger breach."
	},
	3: {
		title: "Laundering",
		description:
			"The business was terminated for laundering transactions, such as processing for unauthorized third parties."
	},
	4: {
		title: "Excessive chargebacks",
		description:
			"The merchant exceeded acceptable chargeback thresholds, indicating disputes or poor transaction quality."
	},
	5: {
		title: "Excessive fraud",
		description:
			"Fraud-to-sales dollar ratio is greater than 8% in a month or fraudulent transactions exceed $5,000 or more in a month."
	},
	6: {
		title: "Coercion",
		description:
			"Transactions were processed under threat of physical harm to the cardholder or their immediate family members."
	},
	7: {
		title: "Fraud Conviction",
		description: "The business or its principals were convicted of fraud. This is a severe regulatory red flag."
	},
	8: {
		title: "MasterCard questionable merchant audit program",
		description: "The business was flagged during Mastercard's internal audit for questionable merchant activity."
	},
	9: {
		title: "Bankruptcy/liquidation/insolvency",
		description: "The business is currently or likely unable to meet its financial obligations and debts."
	},
	10: {
		title: "Violation of standards",
		description:
			"The merchant violated card network and bank standards, such as not honoring all cards or ignoring transaction restrictions."
	},
	11: {
		title: "Merchant collusion",
		description: "The merchant colluded with others to defraud cardholders, issuers, or acquirers."
	},
	12: {
		title: "PCI-DSS non-compliance",
		description: "The business failed to comply with PCI Data Security Standards required for handling payment data."
	},
	13: {
		title: "Illegal transactions",
		description:
			"The business processed transactions that were deemed illegal (e.g., gambling, drugs, or other restricted activities)."
	},
	14: {
		title: "Identity theft",
		description: "The merchant account was opened using stolen or fraudulent identity information."
	},
	15: {
		title: "Transaction Laundering",
		description:
			"The business processed transactions on behalf of unknown or unauthorized third parties - also known as factoring."
	}
};

export const enum MATCH_STATUS_ENUM {
	RESULTS_FOUND = "Results Found",
	NOT_CHECKED = "Not Checked",
	NO_MATCH = "No Match",
	ERROR = "Error",
	MULTIPLE_CODES_ASSOCIATED = "Multiple Codes Associated",
	HIGH_RISK = "High Risk",
	MODERATE_RISK = "Moderate Risk"
}

export const VARIANTS: Record<MATCH_STATUS_ENUM, "info" | "success" | "warning" | "error"> = {
	[MATCH_STATUS_ENUM.RESULTS_FOUND]: "info",
	[MATCH_STATUS_ENUM.NOT_CHECKED]: "warning",
	[MATCH_STATUS_ENUM.NO_MATCH]: "success",
	[MATCH_STATUS_ENUM.ERROR]: "error",
	[MATCH_STATUS_ENUM.MULTIPLE_CODES_ASSOCIATED]: "error",
	[MATCH_STATUS_ENUM.HIGH_RISK]: "error",
	[MATCH_STATUS_ENUM.MODERATE_RISK]: "warning"
};

export const REASON_CODES_STATUS = {
	[MATCH_STATUS_ENUM.HIGH_RISK]: [1, 2, 3, 4, 5, 6, 7, 8, 11, 13, 14, 15],
	[MATCH_STATUS_ENUM.MODERATE_RISK]: [9, 10, 12]
} as const;

export interface MatchProIcaResult {
	terminationInquiryRequest?: unknown;
	terminationInquiryResponse?: unknown;
	/** Aggregated error message for this ICA, as produced by aggregateResults() on failure. */
	error?: string;
	/** Normalized detailed errors as produced by normalizeMatchErrors(). */
	errors?: {
		error?: {
			source: string;
			details: string;
		}[];
	};
}

export interface MatchProData {
	icas: ICAObject[];
	results: Record<string, MatchProIcaResult>;
	execution_metadata?: Record<string, { cached: boolean; timestamp: string }>;
	summary?: { total: number; failed: number; success: number };
	multi_ica: boolean;
	timestamp?: string;
}

/** Aggregated multi-ICA response as produced by aggregateResults(). */
export interface MultiIcaMatchResponse {
	multi_ica: true;
	icas: ICAObject[];
	results: Record<string, MatchProIcaResult>;
	execution_metadata?: Record<string, { cached: boolean; timestamp: string }>;
	summary: { total: number; failed: number; success: number };
	timestamp: string;
}

/** Legacy single-ICA response returned directly from the Match API. */
export interface LegacySingleIcaResponse {
	multi_ica?: false;
	terminationInquiryRequest?: { acquirerId: string; [key: string]: unknown };
	terminationInquiryResponse?: unknown;
	Errors?: unknown;
	errors?: unknown;
	timestamp?: string;
}

/** Discriminated union of all shapes returned by getMatchBusinessResult(). */
export type MatchBusinessResponse = MultiIcaMatchResponse | LegacySingleIcaResponse | {};

export function isMultiIcaMatchResponse(r: MatchBusinessResponse): r is MultiIcaMatchResponse {
	return typeof r === "object" && r !== null && "multi_ica" in r && (r as MultiIcaMatchResponse).multi_ica === true;
}

export function isLegacySingleIcaResponse(r: MatchBusinessResponse): r is LegacySingleIcaResponse {
	return typeof r === "object" && r !== null && !("multi_ica" in r && (r as any).multi_ica === true);
}

export interface BadgeStatus {
	variant: string;
	text: string;
}

export interface TerminatedMerchant {
	reasonCodeDesc: string;
	reasonCode: string;
	reasonCodeInfo: ReasonCodeInfo;
}

export interface ReasonCodeInfo {
	title: string;
	description: string;
}

export interface MatchErrorResponse {
	errors: {
		error: {
			source: string;
			details: string;
		}[];
	};
}

export interface ExecutionResult {
	ica: string;
	result?: (TerminationInquiryResponse | MatchErrorResponse | {}) & TerminationInquiryRequest;
	error?: string;
	cached: boolean;
}

/**
 * Pre-built merchant payload constructed from facts by the rerun integrations adapter.
 * Carries everything needed to build a TerminationInquiryRequest except the ICA (acquirerId),
 * which is resolved at execution time from the customer's credentials.
 */
export interface MatchPrebuiltMerchant {
	name: string;
	doingBusinessAsName: string;
	phoneNumber: string;
	altPhoneNumber: string;
	merchantCategory: string;
	nationalTaxId: string;
	urls: string[];
	address: TerminationInquiryRequest["terminationInquiryRequest"]["merchant"]["address"];
	principals: TerminationInquiryRequest["terminationInquiryRequest"]["merchant"]["principals"];
}

/** Task metadata shape for Match-pro integration (customerID, icas). */
export interface MatchTaskMetadata {
	customerID?: string;
	icas?: string[];
	/** Pre-built merchant payload from the rerun integrations adapter (bypasses case service fetch). */
	merchant?: MatchPrebuiltMerchant;
}

/** Stored Match result passed to validatePreviousRequest / returned from findPreviousResultForIca. */
export interface MatchPreviousReview {
	terminationInquiryRequest?: TerminationInquiryRequest["terminationInquiryRequest"];
	/** API response; stored payload may also include request echo as terminationInquiryRequest */
	response?: TerminationInquiryResponse & {
		terminationInquiryRequest?: TerminationInquiryRequest["terminationInquiryRequest"];
	};
}
