import { Task } from "#api/v1/modules/tasks/task";
import { INTEGRATION_ID, type IntegrationPlatformId } from "#constants";
import { logger } from "#helpers";
import { EntityMatching } from "#lib/entityMatching/entityMatching";
import type { IBusinessIntegrationTaskEnriched, IDBConnection } from "#types";

export async function fetchBusinessEntityVerification<T = any>(
	connection: IDBConnection,
	task: IBusinessIntegrationTaskEnriched<T>
): Promise<void> {
	try {
		if (
			(
				[
					INTEGRATION_ID.OPENCORPORATES,
					INTEGRATION_ID.ZOOMINFO,
					INTEGRATION_ID.CANADA_OPEN,
					INTEGRATION_ID.ENTITY_MATCHING
				] as IntegrationPlatformId[]
			).includes(connection.platform_id)
		) {
			// If EntityMatching is enabled, then we don't directly execute the matching tasks here
			//  The entity_matching "platform" sends an HTTP post to the warehouse service which in turn sends Kafka messages with match details
			//  The match details are then processed via the kafka message, so we're essentialy just skipping this task here because it gets completed as a side effect of the entity_matching platform
			//  We have "entity_matching" platform in this array because it will return FALSE for isEnabled() since it doesn't have its own FF.  It will actually always hit the taskObject.process();
			const isEntityMatchingEnabled = await EntityMatching.isEnabled(connection.platform_id);
			if (isEntityMatchingEnabled) {
				return;
			}
			const taskObject = await Task.fromId(task.id);
			await taskObject.process();
		} else if (connection.platform_id === INTEGRATION_ID.MATCH) {
			const taskObject = await Task.fromId(task.id);
			await taskObject.process();
		} else if (connection.platform_id === INTEGRATION_ID.TRULIOO) {
			logger.info({ task, connection }, "Processing Trulioo fetch_business_entity_verification task");
			const taskObject = await Task.fromId(task.id);
			await taskObject.process();
		} else if (connection.platform_id === INTEGRATION_ID.MIDDESK) {
			// TODO: here need to implement logic for second task (standalone case) that is pending
			// we can replicate same data that have in one of success task
			// Or create new order for middesk
		} else if (connection.platform_id === INTEGRATION_ID.BASELAYER) {
			// TODO: here need to implement logic for baselayer, that is pending as well. We need to understand what data we have in baselayer and how we can use it to create task for business entity verification
			// logger.info({ task, connection }, "Processing Baselayer fetch_business_entity_verification task");
			// const taskObject = await Task.fromId(task.id);
			// await taskObject.process();
		}
	} catch (error: unknown) {
		logger.error({ task, error }, "Error in fetch_business_entity_verification handler");
	}
}
