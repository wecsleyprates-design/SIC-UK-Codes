import { VALUE_NOT_AVAILABLE } from "#constants";
import { GoogleProfile } from "#lib/serp";

export declare namespace DataScrapeServiceType {
	interface SerpMatchResponse {
		business_match: string;
		google_profile?: GoogleProfile;
		address_match?: string;
		address_similarity_score?: number;
	}
}
