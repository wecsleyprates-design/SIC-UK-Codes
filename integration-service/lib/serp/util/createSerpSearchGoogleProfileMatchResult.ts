import { ADDRESS_MATCH, BUSINESS_MATCH } from "../constants";
import { SerpSearchGoogleProfileMatchResult } from "../types/SerpSearchGoogleProfileMatchResult";

export const createSerpSearchGoogleProfileMatchResult = (
	overrides: Partial<SerpSearchGoogleProfileMatchResult> = {}
): SerpSearchGoogleProfileMatchResult => {
	return {
		business_match: BUSINESS_MATCH.NOT_FOUND,
		google_profile: null,
		address_match: ADDRESS_MATCH.NOT_MATCHED,
		address_similarity_score: 0,
		...overrides
	};
};
