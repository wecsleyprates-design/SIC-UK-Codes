/**
 * Watchlist entity type constants
 * Distinguishes between KYB (business) and PSC (person) watchlist hits
 */
export const WATCHLIST_ENTITY_TYPE = {
	BUSINESS: "business",
	PERSON: "person"
} as const;

export type WatchlistEntityType = typeof WATCHLIST_ENTITY_TYPE[keyof typeof WATCHLIST_ENTITY_TYPE];

export const WATCHLIST_HIT_TYPE = {
	PEP: "pep",
	SANCTIONS: "sanctions",
	ADVERSE_MEDIA: "adverse_media"
} as const;

export type WatchlistHitType = typeof WATCHLIST_HIT_TYPE[keyof typeof WATCHLIST_HIT_TYPE];

export interface SoSRegistration {
	id: string;
	internal_reference?: string;
	filing_name: string;
	entity_type?: string;
	registration_date: string;
	filing_date: string;
	active?: boolean;
	foreign_domestic?: "foreign" | "domestic";
	url: string;
	non_profit?: boolean;
	state: string;
}

export interface WatchlistValueMetadatum {
	id: string;
	type: string;
	entity_type?: WatchlistEntityType;
	metadata: {
		abbr: string;
		title: string;
		agency: string;
		agency_abbr: string;
		entity_name: string;
	};
	url?: string | null;
	list_url?: string | null;
	agency_information_url?: string | null;
	agency_list_url?: string | null;
	list_country?: string | null;
	list_region?: string | null;
	entity_aliases?: string[];
	addresses?: Array<{ full_address: string }>;
	listed_at?: string | null;
	categories?: string[];
	score?: number;
}

export interface WatchlistValue {
	metadata: WatchlistValueMetadatum[];
	message: string;
}
