import type { DataScrapeService } from "#api/v1/modules/data-scrape/dataScrapeService";
import { TaskManager } from "#api/v1/modules/tasks/taskManager";
import { getBusinessEntityVerificationService } from "#api/v1/modules/verification/businessEntityVerification";
import { prepareIntegrationDataForScore } from "#common";
import { INTEGRATION_ID } from "#constants";
import { getBusinessDetails, getConnectionById, logger, platformFactory } from "#helpers";
import type { IBusinessIntegrationTaskEnriched, IDBConnection } from "#types";

export async function fetchBusinessEntityWebsiteDetails<T = any>(
	connection: IDBConnection,
	task: IBusinessIntegrationTaskEnriched<T>
): Promise<void> {
	try {
		if (connection.platform_id === INTEGRATION_ID.MIDDESK) {
			const businessDetails = await getBusinessDetails(connection.business_id);
			let website = "";
			if (businessDetails.status === "success") {
				website = businessDetails.data.official_website || "";
			}
			if (!website) {
				logger.error(`Official Website not found for business ${connection.business_id}`);
				return;
			}
			const service = await getBusinessEntityVerificationService(connection.business_id);
			const enrichedTask = await TaskManager.getEnrichedTask(task.id);
			await service
				.fetchMiddeskWebsiteDetails(connection.business_id, enrichedTask)
				.catch(err => logger.error(`Error in fetchMiddeskWebsiteDetails: ${err}`));
			await prepareIntegrationDataForScore(task.id);
		} else if (connection.platform_id === INTEGRATION_ID.BASELAYER) {
			// TODO: implement getBaselayerVerificationService and fetchBaselayerWebsiteDetails when Baselayer API is integrated
			logger.debug({ businessId: connection.business_id }, "Baselayer fetch_business_entity_website_details not yet implemented");
		} else if (connection.platform_id === INTEGRATION_ID.SERP_SCRAPE) {
			const serp: DataScrapeService = platformFactory({ dbConnection: connection });
			await serp.processTask({ taskId: task?.id });
		}
		if (connection.platform_id === INTEGRATION_ID.WORTH_WEBSITE_SCANNING) {
			const dbConnection = await getConnectionById(task.connection_id);
			const websiteScanner = platformFactory({ dbConnection });
			await websiteScanner.processTask({ taskId: task.id });
			await prepareIntegrationDataForScore(task.id);
		}
	} catch (error) {
		logger.error(`Error in fetch_business_entity_website_details: ${error}`);
	}
}
