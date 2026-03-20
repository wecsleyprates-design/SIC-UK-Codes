import fuzz from "fuzzball";

import { SerpSearchResponseWithKnowledgeGraph, SerpSearchResponseWithPlaceResults } from "../types";
import { SerpSearchGoogleProfileMatchResult } from "../types/SerpSearchGoogleProfileMatchResult";
import { createSerpSearchGoogleProfileMatchResult as createMatchResult } from "./createSerpSearchGoogleProfileMatchResult";
import { MATCH_THRESHOLD } from "../constants/match.constant";
import { ADDRESS_MATCH, BUSINESS_MATCH } from "../constants";

export const mapSerpSearchAndMapsResponsesToGoogleProfileMatchResult = (
	serpSearchResponseWithKnowledgeGraph: Pick<
		SerpSearchResponseWithKnowledgeGraph,
		"search_metadata" | "knowledge_graph"
	>,
	serpSearchResponseWithPlaceResults:
		| Pick<SerpSearchResponseWithPlaceResults, "search_metadata" | "place_results">
		| null
		| undefined,
	businessAddress: string
): SerpSearchGoogleProfileMatchResult => {
	const knowledgeGraph = serpSearchResponseWithKnowledgeGraph.knowledge_graph;
	const googleUrl = serpSearchResponseWithKnowledgeGraph.search_metadata.google_url;
	const thumbnail = serpSearchResponseWithPlaceResults?.place_results.thumbnail;
	const gpsCoordinates = serpSearchResponseWithPlaceResults?.place_results.gps_coordinates;

	if (!knowledgeGraph) return createMatchResult();

	let addressSimilarityScore = 0;
	let addressMatch = ADDRESS_MATCH.NOT_MATCHED;

	/**
	 * Since we can only reach this point if there was a knowledge graph, the only possible values for business match are "Match Found" or "Potential Match".
	 * In a future state, when we implement mapping functions for other SERP search responses (i.e. local results, place results, etc.)
	 * that are not as confident as the knowledge graph, we should calculate the business match value accordingly.
	 */
	let businessMatch = BUSINESS_MATCH.POTENTIAL_MATCH;

	/**
	 * Google (via SERP) can return a knowledge graph for other locations of a business,
	 * so we need to calculate how similar the knowledge graph address is to the business address.
	 */
	if (knowledgeGraph.address && businessAddress) {
		addressSimilarityScore = fuzz.token_set_ratio(businessAddress, knowledgeGraph.address);

		if (addressSimilarityScore > MATCH_THRESHOLD.FULL_MATCH) {
			addressMatch = ADDRESS_MATCH.MATCH;
			businessMatch = BUSINESS_MATCH.MATCH_FOUND;
		} else if (addressSimilarityScore > MATCH_THRESHOLD.PARTIAL_MATCH) {
			/**
			 * If the address similarity score is between the partial match threshold and the full match threshold,
			 * we consider it a partial match and set the address match and business match to "Partial Match" and "Potential Match" respectively.
			 *
			 * This indicates that, while Google did return a knowledge graph for this business, we are not 100% confident that the knowledge graph
			 * is for the *correct* business.
			 */
			addressMatch = ADDRESS_MATCH.PARTIAL_MATCH;
			businessMatch = BUSINESS_MATCH.POTENTIAL_MATCH;
		}
	}

	return createMatchResult({
		business_match: businessMatch,

		address_match: addressMatch,
		address_similarity_score: addressSimilarityScore,

		google_profile: {
			business_name: knowledgeGraph.title,
			address: knowledgeGraph.address ?? null,
			phone_number: knowledgeGraph.phone ?? null,
			website: knowledgeGraph.website ?? null,
			rating: knowledgeGraph.rating ?? null,
			reviews: knowledgeGraph.review_count ?? null,
			thumbnail: thumbnail ?? null,
			gps_coordinates: gpsCoordinates ?? null,
			google_search_link: googleUrl ?? null
		}
	});
};
