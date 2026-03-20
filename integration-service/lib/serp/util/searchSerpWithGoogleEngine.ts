import { envConfig } from "#configs";
import { SerpAPIError } from "../errors";
import { StatusCodes } from "http-status-codes";
import { ERROR_CODES } from "#constants";
import axios from "axios";
import { SerpSearchResponseWithKnowledgeGraph } from "../types";

export const searchSerpWithGoogleEngine = async (
	...args: (string | null | undefined)[]
): Promise<SerpSearchResponseWithKnowledgeGraph | unknown> => {
	const apiKey = envConfig.SERP_API_KEY;

	if (!apiKey) throw new SerpAPIError("SERP API key not found", StatusCodes.INTERNAL_SERVER_ERROR, ERROR_CODES.INVALID);

	const searchString = args.filter(Boolean).join(", ");
	const q = encodeURIComponent(searchString);
	const url = `
		https://serpapi.com/search?api_key=${apiKey}
		&engine=google
		&type=search
		&google_domain=google.com
		&q=${q}
		&hl=en
	`.replace(/\s+/g, "");

	const response = await axios.get<SerpSearchResponseWithKnowledgeGraph | unknown>(url, {
		timeout: envConfig.SYNCHRONOUS_API_TIMEOUT_SECONDS * 1000
	});

	return response.data;
};
