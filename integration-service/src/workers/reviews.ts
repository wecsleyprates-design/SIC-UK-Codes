import { EVENTS, QUEUES } from "#constants";
import { sqlQuery, logger, oauthClient } from "#helpers";
import { getGoogleBusinessReviews } from "#lib/google/reviews";
import BullQueue from "#helpers/bull-queue";
import { buildInsertQuery, getGoogleRatingMapping } from "#utils";
import { isAxiosError } from "axios";
import { type Job } from "bull";
import { type QueryResult } from "pg";
import { ReviewsJobBody, type GoogleReview } from "#types/googleReviews";
import * as qs from "qs";
/**
 * @description This function initializes the worker for fetching google reviews.
 * It processes the job from the queue and fetches the reviews from the google api.
 * It also saves the fetched reviews to the database.
 * As we can't fetch all the reviews at once, we need to fetch the reviews page by page.
 * @returns void
 */
export const initGoogleReviewsWorker = () => {
	const googleReviewsQueue = new BullQueue(QUEUES.BUSINESS_REVIEWS);

	googleReviewsQueue.queue.process(EVENTS.FETCH_BUSINESS_REVIEWS, async (job: Job) => {
		const body = job.data;
		try {
			await processFetchGoogleReviews(body);
		} catch (error) {
			throw error;
		}
	});
};

/**
 * @description This function fetches the google reviews from the google api.
 * It fetches the reviews page by page and saves the fetched reviews to the database.
 * @param {ReviewsJobBody} body - The job body which contains the required data to fetch the reviews.
 * @returns void
 */
const processFetchGoogleReviews = async (body: ReviewsJobBody) => {
	const { accountName, locationName, queryParams, lastFetchedReviewDate } = body;
	var { token } = body;
	try {
		// Run the loop until the nextPageToken is null or undefined
		while (!queryParams.pageToken) {
			const result = await getGoogleBusinessReviews(accountName, locationName, token, qs.stringify(queryParams));
			let reviews = result.reviews || {};
			if (Object.keys(reviews).length > 0) {
				if (lastFetchedReviewDate) {
					// filter the reviews based on the lastFetchedReviewDate
					const newReviews = reviews.filter((review: GoogleReview) => new Date(review.createTime) > new Date(lastFetchedReviewDate));
					if (newReviews.length !== reviews.length) {
						result.data.nextPageToken = null;
						reviews = newReviews;
					}
				}
				// save the reviews to the database
				await insertBusinessReviews(reviews, body.business_integration_task_id);
			}
			queryParams.pageToken = result.nextPageToken;
		}
	} catch (error) {
		if (isAxiosError(error) && error.response?.status === 401) {
			const googleBusinessConfigQuery = `SELECT configuration FROM integrations.data_connections WHERE id = $1 AND business_id = $2`;
			const googleBusinessConfigResult: QueryResult = await sqlQuery({ sql: googleBusinessConfigQuery, values: [body.connection_id, body.business_id] });

			if (!googleBusinessConfigResult.rowCount) {
				logger.error(`REVIEWS WORKER: configuration not found for business: ${body.business_id}, connection_id: ${body.connection_id} in data_connections`);
				throw error;
			}

			const config = googleBusinessConfigResult.rows[0].configuration;

			const refreshToken = config.tokens.refresh_token;

			// refresh the token and again call the api
			const tokenResponse = await oauthClient.refreshTokens(refreshToken);
			// This access token is valid for 1 hour
			token = tokenResponse.credentials.access_token as string;

			// update the configuration in data_connections
			const updateConnectionConfigQuery = `UPDATE integrations.data_connections SET configuration = $1 WHERE id = $2 AND business_id = $3`;
			await sqlQuery({ sql: updateConnectionConfigQuery, values: [{ tokens: tokenResponse.credentials }] });

			await processFetchGoogleReviews(body);
		} else {
			logger.error(JSON.stringify(error));
			throw error;
		}
	}
};

/**
 * @description This function saves the fetched reviews to the database.
 * @param fetchedReviews {GoogleReview[]}: response from the google api for reviews
 * @param businessTaskID {uuid}: business_integration_task_id
 */
const insertBusinessReviews = async (fetchedReviews: GoogleReview[], businessTaskID: string) => {
	const reviews = fetchedReviews.map(review => {
		return [businessTaskID, review.reviewId, getGoogleRatingMapping(review.starRating), review.comment, new Date(review.createTime).toUTCString()];
	});

	const columns = ["business_integration_task_id", "review_id", "star_rating", "text", "review_datetime"];

	const insertGoogleReviewsQuery = buildInsertQuery("integration_data.reviews", columns, reviews);
	await sqlQuery({ sql: insertGoogleReviewsQuery, values: reviews.flat() });
};
