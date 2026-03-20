export enum TruliooFlows {
	KYB = "KYB",
	PSC = "PSC"
}

export interface FlowParams {
	flowId: string;
}

export interface ClientDataParams {
	clientId: string;
}

export interface OAuthTokenResponse {
	access_token: string;
	expires_in: number;
	token_type: string;
	scope?: string;
}

export interface TruliooPersonInquiryResult {
	data: {
		inquiry_id?: string;
		is_trulioo_verified?: boolean;
		personId?: string;
		[key: string]: unknown;
	};
	message: string;
}

// Error types for better type safety
export interface TruliooError extends Error {
	code?: string;
	status?: number;
	details?: unknown;
}

// Task handler types
export interface TaskUpdateData {
	status?: string;
	metadata?: Record<string, unknown>;
	error?: string;
	[key: string]: unknown;
}

export type TaskUpdateCallback = (taskId: string, data: TaskUpdateData) => Promise<void>;

// Task interface for database operations
export interface TruliooTask {
	id: string;
	business_id: string;
	connection_id: string;
	platform_id?: string | number;
	[key: string]: unknown;
}

// Data integrations table interface (legacy compatibility)
export interface TruliooDataIntegration {
	id?: string;
	integration_id: number;
	business_id: string;
	data: unknown;
	status: string;
	created_by: string;
	updated_by: string;
	created_at?: string;
	updated_at?: string;
	inquiry_id?: string;
	inquiry_status?: string;
	[key: string]: unknown;
}

// Flow result types
export interface TruliooFlowResponse {
	data: {
		hfSession: string;
		clientData?: {
			status?: string;
			external_id?: string;
			businessData?: TruliooBusinessData;
			watchlistResults?: TruliooWatchlistHit[];
			[key: string]: unknown;
		};
		[key: string]: unknown;
	};
	hfSession: string;
}

// Business address type
export interface TruliooBusinessAddressData {
	is_primary?: boolean;
	addressLine1?: string;
	addressLine2?: string;
	city?: string;
	state?: string;
	postalCode?: string;
	country?: string;
	[key: string]: unknown;
}

export interface TruliooKYBFormData {
	/* IMPORTANT KEEP THE NAME FORMAT. THIS NAMING 
        WILL BE AUTOMATICALLY MAPPED WITH THE FLOW INIT RESPONSE FROM TRULIOO I.E: "role": "company_name", */
	/** Name of business */
	companyName: string;
	/** Business registration number */
	companyregno?: string;
	/** Business email */
	companyEmail?: string;
	/** Tax ID / VAT Number */
	companyVat?: string;
	/** Country of incorporation (ISO country code) */
	companyCountryIncorporation: string;
	/** State / Province of Incorporation */
	companyState?: string;
	/** State / Province of Address */
	companyStateAddress: string;
	/** City */
	companyCity?: string;
	/** ZIP code */
	companyZip: string;
	/** Full company address */
	companyAddressFull?: string;
}

export interface TruliooPSCFormData {
	/* IMPORTANT KEEP THE NAME FORMAT. THIS NAMING 
        WILL BE AUTOMATICALLY MAPPED WITH THE FLOW INIT RESPONSE FROM TRULIOO I.E: "role": "company_name", */
	/** Name of business */
	companyName: string;
	/** Business registration number */
	companyregno?: string;
	/** Business email */
	companyEmail?: string;
	/** Tax ID / VAT Number */
	companyVat?: string;
	/** Country of incorporation (ISO country code) */
	companyCountryIncorporation: string;
	/** State / Province of Incorporation */
	companyState?: string;
	/** State / Province of Address */
	companyStateAddress: string;
	/** City */
	companyCity?: string;
	/** ZIP code */
	companyZip: string;
	/** Full company address */
	companyAddressFull?: string;
}

export interface FlowElement {
	id: string;
	role: string;
	[key: string]: unknown;
}

export interface FlowResponse {
	elements: FlowElement[];
}

export interface TruliooEntityToMatch {
	hfSession: string;
	payload: TruliooKYBFormData | TruliooPSCFormData;
}

// UBO/Director Person Data Types for PSC Screening
export interface TruliooUBOPersonData {
	/** Full name of the UBO/Director */
	fullName: string;
	/** First name */
	firstName: string;
	/** Last name */
	lastName: string;
	/** Date of birth (YYYY-MM-DD format) */
	dateOfBirth: string;
	/** Email address */
	email?: string;
	/** Phone number */
	phone?: string;
	/** Address line 1 */
	addressLine1: string;
	/** Address line 2 */
	addressLine2?: string;
	/** City */
	city: string;
	/** State/Province */
	state?: string;
	/** Postal/ZIP code */
	postalCode: string;
	/** Country code (ISO 2-letter) */
	country: string;
	/** Ownership percentage (0-100) */
	ownershipPercentage?: number;
	/** Type of control/ownership */
	controlType: "UBO" | "DIRECTOR" | "BENEFICIARY" | "CONTROL";
	/** Job title/position */
	title?: string;
	/** Nationality */
	nationality?: string;
	/** Passport number */
	passportNumber?: string;
	/** National ID number */
	nationalId?: string;
}

export interface TruliooPSCScreeningRequest {
	/** Business information for context */
	businessData: TruliooPSCFormData;
	/** List of UBOs/Directors to screen */
	persons: TruliooUBOPersonData[];
	/** Business ID for tracking */
	businessId: string;
}

export interface TruliooPSCScreeningResult {
	/** Person data that was screened */
	person: TruliooUBOPersonData;
	/** Screening status */
	status: "PENDING" | "COMPLETED" | "FAILED";
	/** Watchlist hits */
	watchlistHits: TruliooWatchlistHit[];
	/** Screening provider used */
	provider: "trulioo";
	/** Screening timestamp */
	screenedAt: string;
	/** Additional metadata */
	metadata?: Record<string, unknown>;
}

export interface TruliooScreenedPersonData extends TruliooUBOPersonData {
	/** Screening status */
	screeningStatus: "completed" | "pending" | "failed";
	/** Screening results */
	screeningResults: {
		watchlistHits?: TruliooWatchlistHit[];
		provider?: string;
		screenedAt?: string;
		metadata?: Record<string, unknown>;
		[key: string]: unknown;
	};
}

export interface TruliooWatchlistHit {
	/** Type of watchlist */
	listType: "PEP" | "SANCTIONS" | "ADVERSE_MEDIA" | "OTHER";
	/** Name of the specific list */
	listName: string;
	/** Match confidence score */
	confidence: number;
	/** Match details */
	matchDetails: string;
	/** URL to the source document (from fullServiceDetails) */
	url?: string;
	/** Source agency name (from fullServiceDetails) */
	sourceAgencyName?: string;
	/** Source region (from fullServiceDetails) */
	sourceRegion?: string;
	/** Source list type (from fullServiceDetails) */
	sourceListType?: string;
	/** Country/region for the list (derived from sourceRegion) */
	listCountry?: string;
}

/**
 * Raw hit shape from Trulioo WL_results / AM_results / PEP_results (fullServiceDetails).
 * Used when mapping to TruliooWatchlistHit in createWatchlistHit.
 */
export interface TruliooWatchlistRawHit {
	subjectMatched?: string;
	entityName?: string;
	remarks?: string;
	sourceListType?: string;
	score?: number;
	URL?: string;
	sourceAgencyName?: string;
	sourceRegion?: string;
	[key: string]: unknown;
}

// Business Data Types for UBO/Director Extraction
export interface TruliooBusinessAddress {
	addressLine1?: string;
	addressLine2?: string;
	city?: string;
	state?: string;
	postalCode?: string;
	country?: string;
}

// Standardized location from Trulioo response
export interface TruliooStandardizedLocation {
	Address1?: string;
	BuildingNumber?: string;
	StreetName?: string;
	City?: string;
	StateProvinceCode?: string;
	PostalCode?: string;
	CountryCode?: string;
	LocationType?: string;
}

export interface TruliooUBO {
	name?: string;
	fullName?: string;
	firstName?: string;
	lastName?: string;
	dateOfBirth?: string;
	email?: string;
	phone?: string;
	ownershipPercentage?: number;
	title?: string;
	nationality?: string;
	passportNumber?: string;
	nationalId?: string;
	address?: TruliooBusinessAddress;
	[key: string]: unknown; // Allow additional properties from Trulioo response
}

export interface TruliooDirector {
	name?: string;
	fullName?: string;
	firstName?: string;
	lastName?: string;
	dateOfBirth?: string;
	email?: string;
	phone?: string;
	title?: string;
	nationality?: string;
	passportNumber?: string;
	nationalId?: string;
	address?: TruliooBusinessAddress;
	[key: string]: unknown; // Allow additional properties from Trulioo response
}

export interface TruliooBusinessData {
	ubos?: TruliooUBO[];
	directors?: TruliooDirector[];
	address?: TruliooBusinessAddress;
	business_addresses?: TruliooBusinessAddressData[];
	name?: string;
	country?: string;
	state?: string;
	city?: string;
	postalCode?: string;
	[key: string]: unknown; // Allow additional properties from Trulioo response
}

// Flow Result Types
export interface TruliooFlowResult {
	hfSession?: string;
	external_id?: string;
	status?: string;
	businessData?: TruliooBusinessData;
	clientData?: {
		status?: string;
		external_id?: string;
		businessData?: TruliooBusinessData;
		watchlistResults?: TruliooWatchlistHit[];
		[key: string]: unknown;
	};
	[key: string]: unknown; // Allow additional properties from Trulioo response
}

// Person Verification Data Types
export interface TruliooPersonVerificationData {
	inquiryId: string;
	status?: string;
	results?: {
		watchlistHits?: TruliooWatchlistHit[];
		screeningStatus?: string;
		[key: string]: unknown;
	};
	[key: string]: unknown; // Allow additional properties from Trulioo response
}
