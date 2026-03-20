import { ADDRESS_MATCH, BUSINESS_MATCH } from "../constants";
import { GoogleProfile } from "./GoogleProfile";

export interface SerpSearchGoogleProfileMatchResult {
	business_match: (typeof BUSINESS_MATCH)[keyof typeof BUSINESS_MATCH];
	google_profile: GoogleProfile | null;
	address_match: (typeof ADDRESS_MATCH)[keyof typeof ADDRESS_MATCH];
	address_similarity_score: number | null;
}
