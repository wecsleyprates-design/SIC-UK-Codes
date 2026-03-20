import type * as Verdata from "#lib/verdata/types";
import { sources } from "../sources";
import type * as VerdataType from "#lib/verdata/types";
import { simpleFactToFacts, type Fact, type SimpleFact } from "../types";
import { SerpScrapeResponseSchema } from "#api/v1/modules/data-scrape/schema";

const floatIt = (value: number): number => parseFloat(value.toFixed(2));

export const getVerdataStatisticsValue = (
	verdata: VerdataType.Record,
	key: string
): number | undefined => {
	if (!verdata?.seller || !verdata?.feature_store) return undefined;

	for (const element of verdata?.feature_store) {
		if (Object.hasOwn(element, key)) {
			return typeof element[key] === "number" ? floatIt(element[key]) : undefined;
		}
	}
	return undefined;
};

export const getVerdataRatingValue = (
	verdata: VerdataType.Record,
	key: string
): number | undefined => {
	const publicReviewsAllTime = verdata?.public_reviews?.all_time?.[key];

	return !!publicReviewsAllTime?.length ? 
			(publicReviewsAllTime?.reduce((sum, review) => 
				sum + (review?.rating ?? 0), 0) / publicReviewsAllTime?.length) :
			undefined;
};

const simpleFacts: SimpleFact = {
	review_count: {
		verdata: async (_, verdata: Verdata.PublicRecord) =>
			verdata?.id &&
			(verdata.google_review_count ?? 0) +
				(verdata.yelp_review_count ?? 0) +
				(verdata.healthgrades_review_count ?? 0) +
				(verdata.vitals_review_count ?? 0) +
				(verdata.webmd_review_count ?? 0) +
				(verdata.bbb_review_count ?? 0) +
				(verdata.angi_review_count ?? 0),
		serp: "totalGoogleReviews",
		googlePlacesRatings: async (_, googlePlacesRatings: any) => googlePlacesRatings?.records?.length ?? undefined
	},
	review_rating: {
		verdata: "average_rating",
		serp: "overallGoogleRating",
		googlePlacesRatings: "avg_rating"
	},
	count_of_total_reviewers_all_time: {
		verdataRaw: async (_, verdata: VerdataType.Record) => getVerdataStatisticsValue(verdata, "rev_0161")
	},
	count_of_complaints_all_time: {
		verdataRaw: async (_, verdata: VerdataType.Record) => getVerdataStatisticsValue(verdata, "compl_a_0014")
	},
	count_of_complaints_alert_words_all_time: {
		verdataRaw: async (_, verdata: VerdataType.Record) => {
			const countOfComplaints = getVerdataStatisticsValue(verdata, "compl_a_0014"); // count_of_complaints_all_time
			const percentageOfComplaintsAlertWords = getVerdataStatisticsValue(verdata, "compl_a_0119"); // percentage_of_complaints_containing_alert_words_all_time
			return (countOfComplaints && percentageOfComplaintsAlertWords) && Math.floor(countOfComplaints * percentageOfComplaintsAlertWords / 100);
		}
	},
	count_of_answers_resolved_all_time: {
		verdataRaw: async (_, verdata: VerdataType.Record) => getVerdataStatisticsValue(verdata, "compl_a_0217")
	},
	count_of_resolved_resolved_all_time: {
		verdataRaw: async (_, verdata: VerdataType.Record) => getVerdataStatisticsValue(verdata, "compl_a_0245")
	},
	count_of_unresolved_resolved_all_time: {
		verdataRaw: async (_, verdata: VerdataType.Record) => getVerdataStatisticsValue(verdata, "compl_a_0273")
	},
	count_of_other_resolved_all_time: {
		verdataRaw: async (_, verdata: VerdataType.Record) => getVerdataStatisticsValue(verdata, "compl_a_0287")
	},
	min_rating_allsources: {
		verdataRaw: async (_, verdata: VerdataType.Record) => getVerdataStatisticsValue(verdata, "rev_0175"),
		serp: async (_, serp: SerpScrapeResponseSchema) => {
			const ratingStars = serp?.businessMatch?.rating_summary?.map(rating => rating?.stars) ?? [];
			return ratingStars.length > 0 ? Math.min(...ratingStars) : undefined;
		}
	},
	median_rating_allsources: {
		verdataRaw: async (_, verdata: VerdataType.Record) => getVerdataStatisticsValue(verdata, "rev_0189"),
		serp: async (_, serp: SerpScrapeResponseSchema) => {
			const ratingSummary = serp?.businessMatch?.rating_summary.sort((a, b) => a.stars - b.stars) ?? [];
			const totalAmount = ratingSummary?.reduce((sum, rating) => sum + (rating.amount ?? 0), 0);
			const medianIndex = totalAmount ? totalAmount / 2 : 0;

			let index = 0;
			for (const rating of ratingSummary) {
				index += rating?.amount ?? 0;
				// Find the first rating that has an index greater than or equal to the median index
				if (index >= medianIndex) {
					return rating?.stars;
				}
			}
			return undefined;
		}
	},
	max_rating_allsources: {
		verdataRaw: async (_, verdata: VerdataType.Record) => getVerdataStatisticsValue(verdata, "rev_0196"),
		serp: async (_, serp: SerpScrapeResponseSchema) => {
			const ratingStars = serp?.businessMatch?.rating_summary?.map(rating => rating?.stars) ?? [];
			return ratingStars.length > 0 ? Math.max(...ratingStars) : undefined;
		}
	},
	google_review_count: {
		verdata: "google_review_count",
		serp: "totalGoogleReviews"
	},
	google_review_rating: {
		verdataRaw: async (_, verdata: VerdataType.Record) => getVerdataRatingValue(verdata, "Google"),
		serp: "overallGoogleRating"
	},
	yelp_review_count: {
		verdata: "yelp_review_count"
	},
	yelp_review_rating: {
		verdataRaw: async (_, verdata: VerdataType.Record) => getVerdataRatingValue(verdata, "Yelp")
	},
	angi_review_count: {
		verdata: "angi_review_count"
	},
	angi_review_rating: {
		verdataRaw: async (_, verdata: VerdataType.Record) => getVerdataRatingValue(verdata, "Angi")
	},
	bbb_review_count: {
		verdata: "bbb_review_count"
	},
	bbb_review_rating: {
		verdataRaw: async (_, verdata: VerdataType.Record) => getVerdataRatingValue(verdata, "BBB")
	},
	healthgrades_review_count: {
		verdata: "healthgrades_review_count"
	},
	healthgrades_review_rating: {
		verdataRaw: async (_, verdata: VerdataType.Record) => getVerdataRatingValue(verdata, "Healthgrades")
	},
	vitals_review_count: {
		verdata: "vitals_review_count"
	},
	vitals_review_rating: {
		verdataRaw: async (_, verdata: VerdataType.Record) => getVerdataRatingValue(verdata, "Vitals")
	},
	webmd_review_count: {
		verdata: "webmd_review_count"
	},
	webmd_review_rating: {
		verdataRaw: async (_, verdata: VerdataType.Record) => getVerdataRatingValue(verdata, "Webmd")
	}
};

export const reviewFacts: readonly Fact[] = simpleFactToFacts(simpleFacts, sources);
