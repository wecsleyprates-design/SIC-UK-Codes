import { isObjectWithKeys } from "#utils";
import { SerpSearchResponseWithPlaceResults } from "../types";

export const isSerpSearchResponseWithPlaceResults = (
	response: unknown
): response is SerpSearchResponseWithPlaceResults => {
	return isObjectWithKeys(response, "place_results");
};
