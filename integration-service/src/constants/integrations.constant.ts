import { CustomerIntegrationSettingsSettingsData } from "../api/v1/modules/customer-integration-settings/types";

export const INTEGRATION_ID = {
	PLAID: 1,
	QUICKBOOKS: 2,
	PERSONA: 3,
	VERDATA: 4,
	RUTTER_QUICKBOOKS: 5,
	RUTTER_XERO: 6,
	RUTTER_ZOHO: 7,
	RUTTER_FRESHBOOKS: 8,
	RUTTER_QUICKBOOKSDESKTOP: 9,
	RUTTER_WAVE: 10,
	RUTTER_NETSUITE: 11,
	RUTTER_STRIPE: 12,
	RUTTER_SQUARE: 13,
	RUTTER_PAYPAL: 14,
	TAX_STATUS: 15,
	MIDDESK: 16,
	EQUIFAX: 17,
	PLAID_IDV: 18,
	GOOGLE_PLACES_REVIEWS: 19,
	GOOGLE_BUSINESS_REVIEWS: 20,
	MANUAL: 21, //manual upload,
	SERP_SCRAPE: 22,
	OPENCORPORATES: 23,
	ZOOMINFO: 24,
	ELECTRONIC_SIGNATURE: 25,
	GIACT: 26,
	ADVERSE_MEDIA: 27,
	NPI: 28,
	ENTITY_MATCHING: 29,
	WORTH_WEBSITE_SCANNING: 30,
	AI_NAICS_ENRICHMENT: 31,
	CANADA_OPEN: 32,
	AI_SANITIZATION: 33,
	MANUAL_BANKING: 34,
	MANUAL_ACCOUNTING: 35,
	AI_WEBSITE_ENRICHMENT: 36,
	MATCH: 37,
	TRULIOO: 38,
	SERP_GOOGLE_PROFILE: 39,
	KYX: 40,
	STRIPE: 41,
	TRULIOO_PSC: 42,
	BASELAYER: 43
} as const;

export const INTEGRATION_CATEGORIES = {
	ACCOUNTING: 1,
	VERIFICATION: 2,
	BANKING: 3,
	TAXATION: 4,
	PUBLIC_RECORDS: 5,
	COMMERCE: 6,
	BUSINESS_ENTITY_VERIFICATION: 7,
	BUREAU: 8,
	MANUAL: 9,
	PAYMENTS: 10
} as const;

// Onboarding setup IDs used with getCustomerCountries API
export const ONBOARDING_SETUP_ID = {
	INTERNATIONAL_BUSINESS: 7
} as const;

export const INTEGRATION_CODES = {
	PROCESSOR_ORCHESTRATION: "processor_orchestration",
}

export const CORE_INTEGRATION_STATUS = {
	ENABLED: "ENABLED",
	DISABLED: "DISABLED",
}

export const CONNECTION_STATUS = {
	CREATED: "CREATED",
	INITIALIZED: "INITIALIZED",
	SUCCESS: "SUCCESS",
	FAILED: "FAILED",
	NEEDS_ACTION: "NEEDS_ACTION",
	REVOKED: "REVOKED"
} as const;

export const SCORE_TRIGGER = {
	ONBOARDING_INVITE: "ONBOARDING_INVITE",
	MANUAL_REFRESH: "MANUAL_REFRESH",
	MONITORING_REFRESH: "MONITORING_REFRESH",
	SUBCSCRIPTION_REFRESH: "SUBCSCRIPTION_REFRESH",
	APPLICATION_EDIT: "APPLICATION_EDIT"
} as const;

export const TASK_STATUS = {
	// todo - on submission of business verification
	CREATED: "CREATED",
	INITIALIZED: "INITIALIZED",
	STARTED: "STARTED",
	IN_PROGRESS: "IN_PROGRESS",
	// todo - on webhook event for business.updated
	SUCCESS: "SUCCESS",
	FAILED: "FAILED",
	ERRORED: "ERRORED"
} as const;

export const ACCOUNT_TYPE = {
	DEPOSITORY: "DEPOSITORY",
	CREDIT: "CREDIT",
	LOAN: "LOAN",
	OTHER: "OTHER"
} as const;

export const INTEGRATION_TASK = {
	fetch_balance_sheet: 1,
	fetch_profit_and_loss_statement: 2,
	fetch_assets_data: 3,
	fetch_public_records: 4,
	fetch_cash_flow: 5,
	fetch_accounting_records: 6,
	fetch_accounting_business_info: 7,
	fetch_commerce_payments: 8,
	fetch_commerce_records: 9,
	fetch_tax_filings: 10,
	fetch_bureau_score_owners: 11,
	fetch_business_entity_verification: 12,
	fetch_identity_verification: 13,
	fetch_google_reviews: 14,
	fetch_middesk_business_entity_website_details: 47,
	fetch_worth_business_entity_website_details: 65,
	manual: 16,
	manual_tax_filing: 18,
	electronic_signature: 19,
	fetch_giact_verification: 20,
	fetch_adverse_media: 21,
	fetch_healthcare_provider_verification: 22,
	perform_business_enrichment: 23,
	fetch_accounting_accounts: 17,
	fetch_watchlist_hits: 25
} as const;

export const IDV_STATUS = {
	SUCCESS: 1,
	PENDING: 2,
	CANCELED: 3,
	EXPIRED: 4,
	FAILED: 99
} as const;

export const taskCodesForAccounting: IntegrationTaskKey[] = [
	"fetch_accounting_records",
	"fetch_accounting_business_info",
	"fetch_balance_sheet",
	"fetch_profit_and_loss_statement",
	"fetch_cash_flow",
	"fetch_accounting_accounts"
] as const;

export enum TaskCodeEnum {
	"fetch_balance_sheet",
	"fetch_profit_and_loss_statement",
	"fetch_assets_data",
	"fetch_public_records",
	"fetch_cash_flow",
	"fetch_accounting_records",
	"fetch_accounting_business_info",
	"fetch_commerce_payments",
	"fetch_commerce_records",
	"fetch_tax_filings",
	"fetch_bureau_score_owners",
	"fetch_business_entity_verification",
	"fetch_identity_verification",
	"fetch_google_reviews",
	"fetch_business_entity_website_details",
	"manual",
	"fetch_accounting_accounts",
	"manual_tax_filing",
	"fetch_giact_verification",
	"electronic_signature",
	"fetch_adverse_media",
	"fetch_healthcare_provider_verification",
	"fetch_worth_business_entity_website_details",
	"fetch_middesk_business_entity_website_details",
	"perform_business_enrichment",
	"fetch_google_profile",
	"fetch_watchlist_hits"
}

/* Integrations that may be executed even if their connection status is not success */
export const INTEGRATION_EXECUTION_OVERRIDE = {
	[INTEGRATION_ID.EQUIFAX]: [CONNECTION_STATUS.CREATED, CONNECTION_STATUS.SUCCESS],
	[INTEGRATION_ID.GOOGLE_PLACES_REVIEWS]: [CONNECTION_STATUS.CREATED, CONNECTION_STATUS.SUCCESS],
	[INTEGRATION_ID.VERDATA]: [CONNECTION_STATUS.CREATED, CONNECTION_STATUS.SUCCESS, CONNECTION_STATUS.FAILED], // some verdata connections are marked as FAILED, causing issues with task execution
	[INTEGRATION_ID.SERP_SCRAPE]: [CONNECTION_STATUS.CREATED, CONNECTION_STATUS.SUCCESS],
	[INTEGRATION_ID.OPENCORPORATES]: [CONNECTION_STATUS.CREATED, CONNECTION_STATUS.SUCCESS],
	[INTEGRATION_ID.ZOOMINFO]: [CONNECTION_STATUS.CREATED, CONNECTION_STATUS.SUCCESS],
	[INTEGRATION_ID.MANUAL]: [CONNECTION_STATUS.CREATED, CONNECTION_STATUS.SUCCESS],
	[INTEGRATION_ID.GIACT]: [CONNECTION_STATUS.CREATED, CONNECTION_STATUS.SUCCESS],
	[INTEGRATION_ID.ENTITY_MATCHING]: [
		CONNECTION_STATUS.CREATED,
		CONNECTION_STATUS.SUCCESS,
		CONNECTION_STATUS.INITIALIZED
	],
	[INTEGRATION_ID.NPI]: [CONNECTION_STATUS.CREATED, CONNECTION_STATUS.SUCCESS],
	[INTEGRATION_ID.MIDDESK]: [CONNECTION_STATUS.CREATED, CONNECTION_STATUS.SUCCESS],
	[INTEGRATION_ID.CANADA_OPEN]: [CONNECTION_STATUS.CREATED, CONNECTION_STATUS.SUCCESS],
	[INTEGRATION_ID.AI_NAICS_ENRICHMENT]: [CONNECTION_STATUS.CREATED, CONNECTION_STATUS.SUCCESS],
	[INTEGRATION_ID.AI_WEBSITE_ENRICHMENT]: [CONNECTION_STATUS.CREATED, CONNECTION_STATUS.SUCCESS],
	[INTEGRATION_ID.AI_SANITIZATION]: [CONNECTION_STATUS.CREATED, CONNECTION_STATUS.SUCCESS],
	[INTEGRATION_ID.MANUAL_ACCOUNTING]: [CONNECTION_STATUS.CREATED, CONNECTION_STATUS.SUCCESS],
	[INTEGRATION_ID.MANUAL_BANKING]: [CONNECTION_STATUS.CREATED, CONNECTION_STATUS.SUCCESS],
	[INTEGRATION_ID.ADVERSE_MEDIA]: [CONNECTION_STATUS.CREATED, CONNECTION_STATUS.SUCCESS],
	[INTEGRATION_ID.TAX_STATUS]: [CONNECTION_STATUS.CREATED, CONNECTION_STATUS.SUCCESS],
	[INTEGRATION_ID.ELECTRONIC_SIGNATURE]: [CONNECTION_STATUS.CREATED, CONNECTION_STATUS.SUCCESS],
	[INTEGRATION_ID.GOOGLE_BUSINESS_REVIEWS]: [CONNECTION_STATUS.CREATED, CONNECTION_STATUS.SUCCESS],
	[INTEGRATION_ID.WORTH_WEBSITE_SCANNING]: [CONNECTION_STATUS.CREATED, CONNECTION_STATUS.SUCCESS],
	[INTEGRATION_ID.MATCH]: [CONNECTION_STATUS.CREATED, CONNECTION_STATUS.SUCCESS],
	[INTEGRATION_ID.SERP_GOOGLE_PROFILE]: [CONNECTION_STATUS.CREATED, CONNECTION_STATUS.SUCCESS],
	[INTEGRATION_ID.TRULIOO]: [CONNECTION_STATUS.CREATED, CONNECTION_STATUS.SUCCESS],
	[INTEGRATION_ID.TRULIOO_PSC]: [CONNECTION_STATUS.CREATED, CONNECTION_STATUS.SUCCESS]
	// TODO: temporarily disabling Baselayer execution until the integration is implemented and tested
	//[INTEGRATION_ID.BASELAYER]: [CONNECTION_STATUS.CREATED, CONNECTION_STATUS.SUCCESS]
};

export const PLAID_WEBHOOK_CODE = {
	ITEM_ADD_RESULT: "ITEM_ADD_RESULT",
	PRODUCT_READY: "PRODUCT_READY",
	SESSION_FINISHED: "SESSION_FINISHED"
} as const;

export const PLAID_WEBHOOK_STATUS = {
	EXITED: "exited",
	SUCCESS: "success"
} as const;

export enum GIACT_VERIFICATION_STATUS {
	"CREATED",
	"INITIALIZED",
	"IN_PROGRESS",
	"SUCCESS",
	"FAILED",
	"ERRORED"
}

export enum GIACT_VERIFICATION_TYPE {
	"gVerify",
	"gAuthenticate"
}
// Active status keywords
export const OC_ACTIVE_STATUSES = [
	"active",
	"registered",
	"dormant",
	"converted",
	"in good standing",
	"good standing",
	"exists",
	"live",
	"incorporated"
];

// Inactive status keywords
export const OC_INACTIVE_STATUSES = [
	"dissolved",
	"struck off",
	"in liquidation",
	"in administration",
	"removed",
	"cancelled",
	"pending dissolution",
	"terminated",
	"revoked"
];

export const STRATEGY_ENUM = {
	PRODUCTION: "PRODUCTION",
	SANDBOX: "SANDBOX"
} as const;

export type TaskCode = keyof typeof TaskCodeEnum;

export type AccountType = keyof typeof ACCOUNT_TYPE;
export type TaskStatus = keyof typeof TASK_STATUS;
export type ScoreTrigger = keyof typeof SCORE_TRIGGER;
export type ConnectionStatus = keyof typeof CONNECTION_STATUS;
export type IntegrationCategory = keyof typeof INTEGRATION_CATEGORIES;
export type IntegrationPlatform = keyof typeof INTEGRATION_ID;
export type IntegrationPlatformId = (typeof INTEGRATION_ID)[IntegrationPlatform];
export type IntegrationCategoryId = (typeof INTEGRATION_CATEGORIES)[IntegrationCategory];
export type IdvStatus = keyof typeof IDV_STATUS;
export type IdvStatusId = (typeof IDV_STATUS)[IdvStatus];
export type GiactVerificationStatus = keyof typeof GIACT_VERIFICATION_STATUS;
export type GiactVerificationType = keyof typeof GIACT_VERIFICATION_TYPE;
export type CustomerIntegrationsEnum = keyof CustomerIntegrationSettingsSettingsData;

export type IntegrationTaskKey = keyof typeof INTEGRATION_TASK;
export type Strategy = keyof typeof STRATEGY_ENUM;
