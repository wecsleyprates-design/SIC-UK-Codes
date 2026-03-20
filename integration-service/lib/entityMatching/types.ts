import type { EntityMatchingIntegrationsEnum } from "#messaging/kafka/consumers/handlers/types";
import type { UUID } from "crypto";

export type EntityMatchTask<T = {}> = T & {
	match_id: UUID;
	prediction: number | null;
	match: (IntegrationBusiness & { index?: number }) | null;
	all_matches: MatchItem[] | null;
	match_mode?: "ai" | "heuristic"; // How was the match actually made
};

export interface IntegrationBusiness {
	collected_at: Date;
	company_id: string;
	location_id: string;
	es_location_id: string;
	name: string;
	address: string;
	address_2?: string;
	city: string;
	state: string;
	zip: string;
	source: keyof typeof EntityMatchingIntegrationsEnum;
	zip3: string;
	state_code: string;
	normalised_address: string;
	normalised_address_2?: string;
	street_number: number;
	street_name: string;
	short_name: string;
	company_number: string;
	jurisdiction_code: string;
	efx_id?: number;
	extra_verification: {
		npi_match: boolean | null;
		name_match: boolean | null;
		canada_open_business_number_match: boolean | null;
		canada_open_corporate_id_match: boolean | null;
	};
}

export interface MatchItem {
	integration_business: IntegrationBusiness;
	prediction: number;
}
