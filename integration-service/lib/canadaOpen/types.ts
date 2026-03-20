import type { EntityMatchTask } from "#lib/entityMatching/types";

export type CanadaOpenResponse = {
	match: MatchResult;
	match_mode?: "ai";
};

export type MatchResult = {
	source: "canada_open";
	country: "CA" | string;

	corporate_id: number;
	business_number: number;

	zip: string;
	city: string;
	name: string;
	zip3: string;
	region: string;
	address: string;
	short_name: string;
	state_code: string;
	other_names: string;
	street_name: string;
	collected_at: Date;
	street_number: number;
	canonical_name: string;
	normalized_zip: string;
	sanitized_name: string;
	normalized_name: string;
	other_addresses: string;
	normalized_address: string;
	extra_verification: {
		npi_match: boolean | null;
		name_match: boolean | null;
		canada_open_business_number_match: boolean | null;
		canada_open_corporate_id_match: boolean | null;
	}
};

export type CanadaOpenEntityMatchTask = EntityMatchTask<{ match: MatchResult; business?: MatchResult | null }>;
