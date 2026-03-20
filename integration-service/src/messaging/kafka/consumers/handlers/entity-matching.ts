import { EVENTS, kafkaEvents, TASK_STATUS } from "#constants";
import { getOrCreateConnection, logger, platformFactory } from "#helpers";
import { validateMessage } from "#middlewares";
import type { UUID } from "crypto";
import { EntityMatchingIntegrationsEnum, EntityMatchingIntegrations } from "./types";
import { BusinessEntityVerificationService } from "#api/v1/modules/verification/businessEntityVerification";
import { updateTask, prepareIntegrationDataForScore } from "#common/index";
import { Tasks } from "#models/tasks";
import type { EntityMatchTask, MatchItem } from "#lib/entityMatching/types";
import { EntityMatching } from "#lib/entityMatching/entityMatching";
import { schema } from "./schema";
import { entityMatchingQueue, firmographicsQueue } from "#workers/taskHandler";
import { kafkaToQueue } from "#messaging/index";
import { FirmographicsEvent } from "@joinworth/types/dist/types/kafka/entity_matching.v1/FirmographicsEvent";
import type { IBusinessIntegrationTaskEnriched } from "#types";
import type { TaskManager } from "#api/v1/modules/tasks/taskManager";

interface EntityMatchingConsumerPayload {
	match_id: UUID;
	business_id: UUID;
	matches: MatchItem[];
	source: EntityMatchingIntegrations;
	matched_at: Date;
}

// Type to define the shape necessary to process a firmographics event
type ValidPlatformForFirmographicsEvent<T extends FirmographicsEvent = FirmographicsEvent> = TaskManager & {
	processFirmographicsEvent: (task: IBusinessIntegrationTaskEnriched<T>, payload: T) => Promise<void>;
};

export class EntityMatchingEventHandler {
	async handleEvent(message: any) {
		try {
			const payload = JSON.parse(message.value.toString());
			
			// TODO: https://worth-ai.atlassian.net/browse/TIG-24
			// Temporary fix until keys are published with this topic
			const event = payload.event || message.key?.toString() || kafkaEvents.ENTITY_MATCHING;

			switch (event) {
				case kafkaEvents.ENTITY_MATCHING:
					validateMessage(schema.entityMatching, payload);
					await kafkaToQueue(entityMatchingQueue, EVENTS.ENTITY_MATCHING, payload);
					break;
				case kafkaEvents.FIRMOGRAPHICS_EVENT:
					await kafkaToQueue(firmographicsQueue, EVENTS.FIRMOGRAPHICS_EVENT, payload);
					break;
				default:
					break;
			}
		} catch (error) {
			throw error;
		}
	}

	async entityMatching(payload: EntityMatchingConsumerPayload) {
		// Populate the appropriate entity matching task with the metadata necessary to execute it
		logger.debug(payload, `Entity matching event received`);

		if (!Object.hasOwn(EntityMatchingIntegrationsEnum, payload.source)) {
			logger.debug(`Unknown source: ${payload.source}`);
			return;
		}
		const isEnabled = await EntityMatching.isEnabled();
		if (!isEnabled) {
			return;
		}

		try {
			const platformId = EntityMatching.SOURCE_TO_PLATFORM_MAP[payload.source][0];
			const taskCode = EntityMatching.getTaskCode(payload.source);
			const dbConnection = await getOrCreateConnection(payload.business_id, platformId);
			const platform: BusinessEntityVerificationService = platformFactory({ dbConnection });
			const taskIds = await platform.getTasksForCode({ taskCode });
			if (!taskIds) {
				return;
			}
			for (const taskId of taskIds) {
				const task = (await Tasks.getById(taskId)) as Tasks<EntityMatchTask>;
				if (task.toApiResponse()?.id) {
					const match: MatchItem | null = payload.matches?.[0] || null;
					const prediction = match?.prediction ?? null;
					const entityMatchMetadata: EntityMatchTask = {
						match_id: taskId,
						prediction,
						match: match?.integration_business ?? null,
						all_matches: payload.matches ?? null
					};
					if (entityMatchMetadata.match && entityMatchMetadata.prediction) {
						entityMatchMetadata.match.index = platform.convertPredictionToIndex(entityMatchMetadata.prediction);
					}
					await task.updateMetadata(entityMatchMetadata);
					await updateTask(taskId, TASK_STATUS.CREATED);
					const enrichedTask = await task.enrich();

					const isDirectQuery = await EntityMatching.isDirectQuery(enrichedTask?.customer_id);
					logger.debug(`Is Direct Query: ${isDirectQuery}`);
					if (isDirectQuery) {
						await platform.processTask({ taskId });
						continue;
					}
					if (!this.isValidPlatformForFirmographicsEvent(platform)) {
						logger.error(
							`Platform ${platformId} does not have a processFirmographicsEvent function and Direct Query is disabled -- falling back to processTask`
						);
						await (platform as BusinessEntityVerificationService).processTask({ taskId });
						continue;
					}
					// set task status to in progress
					await platform.updateTaskStatus(
						taskId,
						TASK_STATUS.IN_PROGRESS,
						"Waiting for kafka message with match payload"
					);
				}
			}
		} catch (error) {
			logger.error({ error }, "Error getting connection for business and platform");
			return;
		}
	}

	public async firmographicsEvent(payload: FirmographicsEvent) {
		const taskIds: UUID[] = [];
		try {
			logger.debug(`Firmographics event received: ${JSON.stringify(payload)}`);
			const platformId = EntityMatching.SOURCE_TO_PLATFORM_MAP[payload.source][0];
			const dbConnection = await getOrCreateConnection(payload.business_id as UUID, platformId);
			const platform: ValidPlatformForFirmographicsEvent = platformFactory({ dbConnection });
			if (!this.isValidPlatformForFirmographicsEvent(platform)) {
				logger.error(`Platform ${platformId} does not have a processFirmographicsEvent function`);
				return;
			}

			const taskCode = EntityMatching.getTaskCode(payload.source as EntityMatchingIntegrations);
			const foundTaskIds =
				(await platform.getTasksForCode({
					taskCode,
					conditions: [{ column: "task_status", in: [TASK_STATUS.IN_PROGRESS] }]
				})) ?? [];
			taskIds.push(...foundTaskIds);
			logger.debug(`Task IDs: ${JSON.stringify(taskIds)}`);

			if (!taskIds || taskIds.length === 0) {
				const newTaskId = await platform.createTaskForCode({
					taskCode,
					metadata: {
						all_matches: [],
						prediction: null,
						integration_business: {},
						source: payload.source
					}
				});
				logger.debug(`New task ID: ${newTaskId}`);
				taskIds.push(newTaskId);
			}

			for (const taskId of taskIds) {
				const task = await BusinessEntityVerificationService.getEnrichedTask(taskId);
				await this.processFirmographicsEvent(platform, payload, task);
			}
		} catch (error) {
			logger.error({ error }, "Error processing firmographics event");
		}
	}

	/**
	 * Process the firmographics event for the given platform
	 * Handle the task lifecycle and update the task status
	 * @param platform
	 * @param payload
	 * @param task
	 * @returns
	 */
	private async processFirmographicsEvent<T extends FirmographicsEvent = FirmographicsEvent>(
		platform: ValidPlatformForFirmographicsEvent<T>,
		payload: T,
		task: IBusinessIntegrationTaskEnriched<T>
	) {
		const platformName = platform.constructor?.name ?? "Unknown";

		if (await EntityMatching.isDirectQuery(task?.customer_id)) {
			logger.warn(
				`Task ${task.id} is associated with ${task.customer_id} and is configured for direct query and will not be processed`
			);
			return;
		}
		if (task) {
			try {
				logger.debug(`Processing task ${task.id} for platform ${platformName} ${task.id}`);

				// If the firmographic prediction is below the minimum threshold, fail the task
				// However, We still want to capture the event for auditing purposes, but we won't process it.
				if (BusinessEntityVerificationService.isFirmographicsBelowPredictionThreshold(payload)) {
					logger.error(`Prediction score ${payload.prediction} is below minimum threshold for source ${payload.source}`);

					await platform.updateTaskStatus(
						task.id,
						TASK_STATUS.FAILED,
						`Prediction score below minimum threshold, prediction=${payload.prediction}`
					);
					return;
				}

				await platform.processFirmographicsEvent(task, payload);
				await platform.updateTaskStatus(task.id, TASK_STATUS.SUCCESS, "Firmographics event processed");
			} catch (error) {
				logger.error({ error }, "Error processing firmographics event");
				await platform.updateTaskStatus(task.id, TASK_STATUS.FAILED, "Firmographics event processing failed");
			} finally {
				try {
					await prepareIntegrationDataForScore(task.id, task?.trigger_type);
				} catch (scoreError) {
					logger.error(
						{ error: scoreError, taskId: task.id },
						"prepareIntegrationDataForScore failed; integration task outcome unchanged"
					);
				}
			}
		}
	}

	/** Typeguard that passed in object has the methods necessary to process a firmographics event */
	private isValidPlatformForFirmographicsEvent<T extends FirmographicsEvent = FirmographicsEvent>(
		platform: TaskManager
	): platform is ValidPlatformForFirmographicsEvent<T> {
		return Object.prototype.hasOwnProperty.call(platform.constructor.prototype, "processFirmographicsEvent");
	}
}

export const entityMatchingEventsHandler = new EntityMatchingEventHandler();
