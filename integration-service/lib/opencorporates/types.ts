import { EntityMatchTask } from "#lib/entityMatching/types";

export type MatchResult = {
	company_number: string;
	jurisdiction_code: string;
	normalized_name: string;
	address: string;
	normalized_address: string;
	suppliedName?: string;
	suppliedAddress?: string;
	suppliedname?: string;
	suppliedaddress?: string;
	index: number;
	extra_verification: {
		npi_match: boolean | null;
		name_match: boolean | null;
		canada_open_business_number_match: boolean | null;
		canada_open_corporate_id_match: boolean | null;
	};
} & Record<string, any>;
export type NameResult = {
	company_number: string;
	jurisdiction_code: string;
	name: string;
	normalized_name?: string;
	name1?: string;
	name2?: string;
	source: "companies" | "alternate";
};
export type AddressResult = {
	company_number: string;
	jurisdiction_code: string;
	address_type?: string;
	address_parts?: any;
	normalized_address: string;
	zip: string;
	line1: string;
	city: string;
	state: string;
	zip2: string;
	zip3: string;
	zip4: string;
	source?: string;
	address?: string;
};
export type OfficerResult = {
	name: string;
	title?: string | null;
	position?: string | null;
	// Address fields
	officer_address_street?: string | null;
	officer_address_locality?: string | null;
	officer_address_region?: string | null;
	officer_address_postal_code?: string | null;
	officer_address_country?: string | null;
	officer_address_full?: string | null;
	// Name fields
	officer_first_name?: string | null;
	officer_last_name?: string | null;
	// Metadata fields
	officer_status?: string | null;
	officer_start_date?: string | null;
	officer_person_uid?: string | null;
	officer_person_number?: string | null;
	officer_type?: string | null;
	officer_source_url?: string | null;
	officer_retrieved_at?: string | null;
};
export type FirmographicResult = {
	company_number: string;
	jurisdiction_code: string;
	name: string;
	normalised_name: string;
	company_type: string;
	nonprofit: boolean | null;
	current_status: string;
	incorporation_date: string;
	dissolution_date: string;
	branch: string;
	business_number: string;
	current_alternative_legal_name: string;
	current_alternative_legal_name_language: string;
	home_jurisdiction_text: string;
	native_company_number: string;
	previous_names: string;
	retrieved_at: string | null;
	registry_url: string | null;
	restricted_for_marketing: boolean | null;
	inactive: boolean | null;
	accounts_next_due: string;
	accounts_reference_date: string;
	accounts_last_made_up_date: string;
	annual_return_next_due: string;
	annual_return_last_made_up_date: string;
	has_been_liquidated: boolean | null;
	has_insolvency_history: boolean | null;
	has_charges: boolean | null;
	number_of_employees: string;
	// Nested type for registered_address
	registered_address?: {
		street_address: string;
		locality: string;
		region: string;
		postal_code: string;
		country: string;
		in_full: string;
	};
	"registered_address.region"?: string;
	"registered_address.postal_code"?: string;
	"registered_address.country"?: string;
	"registered_address.in_full"?: string;
	"registered_address.street_address"?: string;
	"registered_address.locality"?: string;
	home_jurisdiction_code: string;
	home_jurisdiction_company_number: string;
	industry_code_uids: string;
	latest_accounts_date: string;
	latest_accounts_cash: number | null;
	latest_accounts_assets: number | null;
	latest_accounts_liabilities: number | null;
	naics?: number | null;
};
export type OpenCorporateResponse = {
	match: MatchResult;
	firmographic?: FirmographicResult;
	names?: NameResult[];
	addresses?: AddressResult[];
	officers?: OfficerResult[];
	sosFilings?: FirmographicResult[];
	match_mode?: "heuristic" | "ai";
};

export type OpenCorporateEntityMatchTask = EntityMatchTask<{
	firmographic?: FirmographicResult | null;
	names?: NameResult[] | null;
	addresses?: AddressResult[] | null;
	officers?: OfficerResult[] | null;
	sosFilings?: FirmographicResult[] | null;
}>;

export interface BuildOpenCorporatesSearchQueryData {
	zip3: string[];
	name2: string[];
	names: string[];
	addresses: string[];
	country?: string[];
}

export interface BuildOpenCorporatesSearchQueryMetadata extends BuildOpenCorporatesSearchQueryData {
	hasCanadianAddress: boolean;
}
