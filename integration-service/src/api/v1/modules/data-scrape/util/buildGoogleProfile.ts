import { GoogleBusinessMatch } from "../schema";
import { GoogleProfile } from "#lib/serp";

export const buildGoogleProfile = (
	entry:
		| Pick<
				GoogleBusinessMatch,
				"title" | "address" | "phone" | "website" | "rating" | "reviews" | "thumbnail" | "gps_coordinates"
		  >
		| null
		| undefined
): GoogleProfile => {
	const cleanedTitle = entry?.title?.replace(/[^a-zA-Z0-9\s]/g, "").trim() ?? "";
	const googleSearchLink = `https://www.google.com/search?q=${encodeURIComponent(cleanedTitle)}`;

	return {
		business_name: entry?.title || null,
		address: entry?.address || null,
		phone_number: entry?.phone || null,
		website: entry?.website || null,
		rating: entry?.rating || null,
		reviews: entry?.reviews || null,
		thumbnail: entry?.thumbnail || null,
		gps_coordinates: entry?.gps_coordinates || null,
		google_search_link: entry?.title ? googleSearchLink : null
	};
};
