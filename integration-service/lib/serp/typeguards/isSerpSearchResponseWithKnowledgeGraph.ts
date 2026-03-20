import { isObjectWithKeys } from "#utils";
import { SerpSearchResponseWithKnowledgeGraph } from "../types";

export const isSerpSearchResponseWithKnowledgeGraph = (
	response: unknown
): response is SerpSearchResponseWithKnowledgeGraph => {
	return isObjectWithKeys(response, "knowledge_graph");
};
