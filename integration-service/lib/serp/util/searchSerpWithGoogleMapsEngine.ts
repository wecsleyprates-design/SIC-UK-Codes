import { envConfig } from "#configs";
import { SerpAPIError } from "../errors";
import { StatusCodes } from "http-status-codes";
import { ERROR_CODES } from "#constants";
import axios from "axios";
import { SerpSearchResponseWithPlaceResults } from "../types";

export const searchSerpWithGoogleMapsEngine = async (
	placeId: string
): Promise<SerpSearchResponseWithPlaceResults | unknown> => {
	const apiKey = envConfig.SERP_API_KEY;

	if (!apiKey) throw new SerpAPIError("SERP API key not found", StatusCodes.INTERNAL_SERVER_ERROR, ERROR_CODES.INVALID);

	const url = `
		https://serpapi.com/search
		?api_key=${apiKey}
		&engine=google_maps
		&type=search
		&google_domain=google.com
		&hl=en
		&place_id=${encodeURIComponent(placeId)}
	`.replace(/\s+/g, "");

	const response = await axios.get<SerpSearchResponseWithPlaceResults | unknown>(url, {
		timeout: envConfig.SYNCHRONOUS_API_TIMEOUT_SECONDS * 1000
	});

	return response.data;
};
