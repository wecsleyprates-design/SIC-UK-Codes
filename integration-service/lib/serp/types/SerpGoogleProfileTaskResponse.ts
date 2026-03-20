import { SerpSearchGoogleProfileMatchResult } from "./SerpSearchGoogleProfileMatchResult";
import { SerpSearchResponseWithKnowledgeGraph } from "./SerpSearchResponseWithKnowledgeGraph";
import { SerpSearchResponseWithPlaceResults } from "./SerpSearchResponseWithPlaceResults";

export interface SerpGoogleProfileTaskResponse {
	google_profile_match_result: SerpSearchGoogleProfileMatchResult;
	knowledge_graph: SerpSearchResponseWithKnowledgeGraph["knowledge_graph"];
	place_results: SerpSearchResponseWithPlaceResults["place_results"] | null;
	rawSerpResponses: (SerpSearchResponseWithKnowledgeGraph | SerpSearchResponseWithPlaceResults | null)[];
}
