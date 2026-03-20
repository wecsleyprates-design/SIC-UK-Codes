import { TaskManager } from "#api/v1/modules/tasks/taskManager";
import { envConfig } from "#configs";
import { logger } from "#helpers/logger";
import type { UUID } from "crypto";
import { getGooglePlacesReviews } from "./reviews";
import { DIRECTORIES, INTEGRATION_ID } from "#constants";
import { uploadRawIntegrationDataToS3 } from "#common/index";
import { db } from "#helpers/knex";

export class GoogleReviews extends TaskManager {
	protected PLATFORM_ID = INTEGRATION_ID.GOOGLE_PLACES_REVIEWS;

	protected taskHandlerMap = {
		fetch_google_reviews: async taskId => this.fetchGoogleReviews(taskId)
	};

	async fetchGoogleReviews(taskId: UUID) {
		const connection = this.getDBConnection();
		if (!connection) {
			throw new Error("No Connection");
		}
		const placeID = connection?.configuration?.place_id;
		if (!placeID) {
			logger.info(`GOOGLE REVIEWS: Place ID not found for connection ${connection.id}`);
			throw new Error(`GOOGLE REVIEWS: Place ID not found for connection ${connection.id}`);
		}
		let response: any = {};
		let error;
		try {
			const apiKey = envConfig.GOOGLE_MAP_API_KEY;
			response = await getGooglePlacesReviews(`place_id=${placeID}&fields=name,reviews,rating,user_ratings_total&key=${apiKey}`);
		} catch (err) {
			error = err;
			logger.error({ error: err, task_id: taskId }, "Error fetching Google Reviews");
			return false;
		}

		if (response?.result?.reviews?.length) {
			await db("integration_data.business_ratings").insert({
				business_integration_task_id: taskId,
				average_rating: response?.result?.rating || 0,
				total_reviews: response?.result?.user_ratings_total || 0
			});

			const rows: Array<Record<string, any>> = response?.result?.reviews?.map(item => {
				// convert unix epoch time to utc string
				const time = new Date(item.time * 1000);
				const formattedTime = time.toUTCString();
				return { business_integration_task_id: taskId, star_rating: item.rating, text: item.text, review_datetime: formattedTime };
			});
			await db("integration_data.reviews").insert(rows);
		}

		await uploadRawIntegrationDataToS3(response, connection.business_id, "public_records", DIRECTORIES.PUBLIC_RECORDS, "GOOGLE_PLACES_REVIEWS");
		return true;
	}
}
