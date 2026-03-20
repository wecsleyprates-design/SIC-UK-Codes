import { adverseMedia } from "#api/v1/modules/adverse-media/adverse-media";
import type { FetchAdverseMediaReportsBody } from "#api/v1/modules/adverse-media/types";
import { INTEGRATION_ID, TASK_STATUS } from "#constants";
import { db, getBusinessDetails, getOrCreateConnection, logger } from "#helpers";
import type { IBusinessIntegrationTaskEnriched, IDBConnection } from "#types";

export async function fetchAdverseMedia<T = any>(
	_connection: IDBConnection,
	task: IBusinessIntegrationTaskEnriched<T>
) {
	const businessDetails = await getBusinessDetails(task.business_id);
	if (businessDetails.status !== "success") {
		logger.error(`Error fetching business details for business ${task.business_id}: ${businessDetails.message}`);
		return;
	}
	try {
		if (!task.customer_id) {
			logger.warn(`Customer ID is required for adverse media`);
			return;
		}
		const isAdverseMediaEnabled = await adverseMedia.customerSettingsForIntegration(task.customer_id, "adverse_media");

		if (!isAdverseMediaEnabled) {
			logger.warn(
				`Adverse media settings are disabled for customer customerId=${task.customer_id} businessId=${task.business_id}`
			);
			return;
		}

		const connection = await getOrCreateConnection(task.business_id, INTEGRATION_ID.ADVERSE_MEDIA);
		if (task.task_status === TASK_STATUS.SUCCESS) {
			// Check if we need to backfill media_type for existing articles
			const existingArticles = await db("integration_data.adverse_media_articles")
				.select("id")
				.where("business_id", task.business_id)
				.whereNull("media_type")
				.limit(1);

			if (existingArticles.length === 0) {
				logger.warn(
					`Task ${task.id} is already success for business ${task.business_id} and media_type is already populated`
				);
				return;
			}

			logger.warn(
				`Task ${task.id} is already success for business ${task.business_id}, but reprocessing to backfill media_type`
			);
		}

		const adverseMediaRequest: FetchAdverseMediaReportsBody = {
			customer_id: task.customer_id,
			business_id: task.business_id,
			business_name: businessDetails.data.name,
			dba_names: businessDetails.data.business_names?.map(name => name.name),
			case_id: task.case_id,
			contact_names: businessDetails.data.owners?.map(owner => `${owner.first_name} ${owner.last_name}`),
			city: businessDetails.data.business_addresses[0].city,
			state: businessDetails.data.business_addresses[0].state
		};

		await adverseMedia.processAdverseMediaAndHandleTasks(adverseMediaRequest, task);
	} catch (error: any) {
		logger.error(
			{ error },
			`Error fetching adverse media report for business ${task.business_id}, case ${task.case_id}`
		);
		throw error;
	}
}
