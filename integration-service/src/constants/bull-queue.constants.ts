export const QUEUES = {
	VERDATA: "verdata",
	VERDATA_RETRY: "verdata-retry",
	BUSINESS_REVIEWS: "business-reviews",
	BUREAU: "bureau",
	JOB: "job",
	TASK: "task",
	AI_ENRICHMENT: "ai-enrichment",
	WEBSITE_SCANNING: "website-scanning",
	STATE_UPDATE: "state-update",
	TRULIOO_PSC: "trulioo-psc",
	ENTITY_MATCHING: "entity-matching",
	FIRMOGRAPHICS: "firmographics",
	OPEN_CORPORATES: "open-corporates",
	ZOOMINFO: "zoominfo",
	NPI: "npi",
	CASE_SUBMITTED: "case-submitted",
	BUSINESS_ONBOARDING: "business-onboarding"
} as const;

export const EVENTS = {
	SELLER_NOT_FOUND: "seller-not-found",
	FETCH_BUSINESS_REVIEWS: "fetch-business-reviews",
	ENRICH_RESPONSE: "enrich-response",
	EQUIFAX_MATCH: "equifax-match",
	BUSINESS_IMPORT: "business-import",
	PLAID_ASSET_REPORT: "plaid-asset-report",
	RETRY_OR_DELAY_SELLER_SEARCH: "retry-or-delay-seller-search",
	REFRESH_SCORE: "refresh-score",
	FETCH_PUBLIC_RECORDS: "fetch-public-records",
	INTEGRATION_DATA_UPLOADED: "integration-data-uploaded",
	INTEGRATION_DATA_READY: "integration-data-ready",
	CASE_SUBMITTED_EXECUTE_TASKS: "case-submitted-execute-tasks",
	BUSINESS_MATCH: "business-match",
	OPEN_CORPORATES_MATCH: "open-corporates-match", // deprecated, use FIRMOGRAPHICS queue instead
	ZOOMINFO_MATCH: "zoominfo-match", // deprecated, use FIRMOGRAPHICS queue instead
	OCR_PARSE_DOCUMENT: "ocr-parse-document",
	OCR_VALIDATE_DOCUMENT_TYPE: "ocr-validate-document-type",
	LINK_WEBHOOK: "link-webhook",
	FETCH_ASSET_REPORT: "fetch-asset-report",
	FETCH_GIACT_VERIFICATION: "fetch-giact-verification",
	NPI_BUSINESS_MATCH: "npi-business-match", // deprecated, use FIRMOGRAPHICS queue instead
	PURGE_BUSINESS: "purge-business",
	ENTITY_MATCHING: "entity-matching", // deprecated, use ENTITY_MATCHING queue instead
	FIRMOGRAPHICS_EVENT: "firmographics-event", // deprecated, use FIRMOGRAPHICS queue instead
	AI_ENRICHMENT: "ai-enrichment", 
	FETCH_WORTH_BUSINESS_WEBSITE_DETAILS: "fetch-worth-business-website-details",
	FETCH_GOOGLE_PROFILE: "fetch-google-profile",
	MATCH_PRO_BULK: "match-pro-bulk",
	CASE_UPDATED_AUDIT: "case-updated-audit",
	INVITATION_SENT: "invitation-sent-event",
	KYX_MATCH: "kyx-match",
	STATE_UPDATE: "state-update",
	FETCH_WATCHLIST_HITS: "fetch-watchlist-hits",
	BUSINESS_INVITE_ACCEPTED: "business-invite-accepted",
	FETCH_ADVERSE_MEDIA_REPORT: "fetch-adverse-media-report",
	OWNER_UPDATED: "owner-updated"
} as const;

export type EventEnum = (typeof EVENTS)[keyof typeof EVENTS];
export type QueueEnum = (typeof QUEUES)[keyof typeof QUEUES];
