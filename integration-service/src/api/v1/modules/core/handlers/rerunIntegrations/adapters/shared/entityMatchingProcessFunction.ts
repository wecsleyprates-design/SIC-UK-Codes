import type { UUID } from "crypto";
import { isEmpty } from "#utils";
import { logger } from "#helpers/logger";
import { INTEGRATION_ID, type TaskCode } from "#constants";
import type { IntegrationFactEntityMatchingMetadata, IntegrationProcessFunction } from "../types";
import { db, getOrCreateConnection, platformFactory } from "#helpers";
import { EntityMatching } from "#lib/entityMatching/entityMatching";
import { defaultAdapterProcessFunction } from "./defaultAdapterProcessFunction";

/**
 * Generic process function for integrations that rely on EntityMatching.
 *
 * EntityMatching is used by several integrations (OpenCorporates, ZoomInfo, CanadaOpen, NPI, Match)
 * to provide match details from the warehouse service. This function provides a standardized
 * process flow for any integration that follows this pattern:
 *
 * 1. Check if EntityMatching is enabled for the integration
 * 2. If disabled → fall back to standard processing (heuristic/direct query)
 * 3. If enabled → Trigger EntityMatching with names and addresses
 * 4. EntityMatching sends data to warehouse service
 * 5. Warehouse returns Kafka message with match details
 * 6. Integration processes the match asynchronously via Kafka consumer
 *
 * @example
 * ```typescript
 * // In your adapter file
 * export const openCorporatesAdapter: IntegrationFactAdapter = {
 *   factNames: FACT_NAMES,
 *   getMetadata,
 *   process: entityMatchingProcessFunction
 * };
 * ```
 */
export const entityMatchingProcessFunction: IntegrationProcessFunction<
	IntegrationFactEntityMatchingMetadata
> = async params => {
	const { platform, platform_id, platform_code, connection_id, business_id, task_code, metadata, scoreTriggerId } = params;

	if (isEmpty(metadata)) throw new Error(`No metadata provided for ${platform_code} - ${task_code}`);

	/** 1. Check if EntityMatching is enabled for this integration */
	const isEntityMatchingEnabled = await EntityMatching.isEnabled(platform_id);

	if (!isEntityMatchingEnabled) {
		/**
		 * If EntityMatching is disabled, fall back to standard processing.
		 * The integration will use its own heuristic matching logic or direct database query.
		 *
		 * This will trigger the `fetch_business_entity_verification` task handler in the integration's class.
		 * Since EntityMatching is disabled, the task handler will fall back to the integration's own matching logic.
		 *
		 * Since the code within this scope can only be executed if entity matching is disabled, calling the
		 * `defaultAdapterProcessFunction` here will guarantee that the fall back code path is followed.
		 */
		logger.warn(
			{ business_id, platform_code, platform_id },
			`EntityMatching is disabled for ${platform_code} - falling back to heuristic matching`
		);

		return await defaultAdapterProcessFunction(params);
	}

	/** 2. Trigger EntityMatching to get match details */
	logger.debug({ business_id, metadata, platform_code }, `Triggering EntityMatching for ${platform_code}`);

	const entityMatchingConnection = await getOrCreateConnection(business_id as UUID, INTEGRATION_ID.ENTITY_MATCHING);
	const entityMatchingPlatform = platformFactory<EntityMatching>({
		dbConnection: entityMatchingConnection
	});

	/**
	 * Create an EntityMatching task.
	 * The EntityMatching.fetchBusinessEntityVerification() function will:
	 * - Send names and addresses to the warehouse service
	 * - Receive a Kafka message with match details
	 * - Create/update the integration's task with match metadata
	 * - Trigger the integration's processEntityMatching() or processFirmographicsEvent()
	 */
	const entityMatchingTaskId = await entityMatchingPlatform.getOrCreateTaskForCode({
		taskCode: "fetch_business_entity_verification",
		metadata,
		scoreTriggerId,
		/**
		 * If there is an existing task but it has different metadata, we cannot reuse it.
		 * In that scenario, we need to create a new task with the new metadata to ensure
		 * that the task is run with the correct metadata.
		 */
		conditions: [db.raw("metadata::text = ?", [JSON.stringify(metadata)])]
	});

	if (!entityMatchingTaskId) {
		const errorMessage = `Could not create EntityMatching task for ${platform_code}`;
		logger.warn(errorMessage);
		throw new Error(errorMessage);
	}

	/** Process the EntityMatching task */
	await entityMatchingPlatform.processTask({ taskId: entityMatchingTaskId });

	/**
	 * At this point, the EntityMatching flow has been initiated.
	 * The actual integration processing will happen asynchronously when:
	 * 1. Warehouse service responds with Kafka message
	 * 2. EntityMatchingEventHandler receives the message
	 * 3. Integration task is created/updated with match metadata
	 * 4. Integration's processEntityMatching() or processFirmographicsEvent() is called
	 */

	logger.info(
		`Successfully initiated EntityMatching for ${platform_code} - entity_matching_task_id: ${entityMatchingTaskId}, connection_id: ${connection_id}`
	);

	return [entityMatchingTaskId];
};
