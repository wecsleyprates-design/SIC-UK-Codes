import { CONNECTION_STATUS, INTEGRATION_ID, TASK_STATUS } from "#constants/index";
import { db, logger } from "#helpers/index";
import { getConnectionForBusinessAndPlatform } from "#helpers/platformHelper";
import { adverseMedia } from "#api/v1/modules/adverse-media/adverse-media";
import type { FetchAdverseMediaReportsBody } from "#api/v1/modules/adverse-media/types";

export class AdverseMediaManager {
	// TODO: Refactor this method to properly use a repository class pattern
	async fetchAdverseMediaReport(body: FetchAdverseMediaReportsBody): Promise<void> {
		try {
			const isAdverseMediaEnabled = await adverseMedia.customerSettingsForIntegration(
				body.customer_id,
				"adverse_media"
			);

			if (!isAdverseMediaEnabled) {
				logger.warn(`Adverse media settings are disabled for customer ${body.customer_id} ${body.business_id}`);
				return;
			}

			const connection = await getConnectionForBusinessAndPlatform(body.business_id, INTEGRATION_ID.ADVERSE_MEDIA);
			const task = await adverseMedia.getAdverseMediaTask(body.business_id, body.case_id);

			if (task.task_status === TASK_STATUS.SUCCESS) {
				// Check if we need to backfill media_type for existing articles
				const existingArticles = await db("integration_data.adverse_media_articles")
					.select("id")
					.where("business_id", body.business_id)
					.whereNull("media_type")
					.limit(1);

				if (existingArticles.length === 0) {
					logger.warn(
						`Task ${task.id} is already success for business ${body.business_id} and media_type is already populated`
					);
					return;
				}

				logger.warn(
					`Task ${task.id} is already success for business ${body.business_id}, but reprocessing to backfill media_type`
				);
			}

			// connection will always be SUCCESS
			await db("integrations.data_connections")
				.where("id", connection.id)
				.update({ connection_status: CONNECTION_STATUS.SUCCESS });

			await adverseMedia.processAdverseMediaAndHandleTasks(body, task);
		} catch (error: any) {
			logger.error(
				`Error fetching adverse media report for business ${body.business_id}, case ${body.case_id}: ${error.message}`
			);
			throw error;
		}
	}
}
