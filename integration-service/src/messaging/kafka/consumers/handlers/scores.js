import { checkAndTriggerRiskAlert, prepareIntegrationDataForScore } from "#common/common-new";
import { executeIntegrationTask, seedBusinessIntegrationTasks, updateBusinessDetailS3 } from "#common/index";
import { DLQTOPIC, EVENTS, kafkaEvents, kafkaTopics } from "#constants/index";
import { logger, producer, sqlQuery, db } from "#helpers/index";
import { validateMessage } from "#middlewares/index";
import { taskQueue } from "../../../../workers/taskHandler";
import { safeJsonParse } from "aws-jwt-verify/safe-json-parse";
import { KafkaHandlerError } from "./error";
import { schema } from "./schema";

class ScoreEventsHandler {
	async handleEvent(message) {
		try {
			const payload = JSON.parse(message.value.toString());
			const event = payload.event || message.key?.toString();
			logger.debug(`Kafka received message: ${event} with offset: ${message.offset}`);
			switch (event) {
				case kafkaEvents.REFRESH_BUSINESS_SCORE:
					validateMessage(schema.scoreRefreshRequest, payload);
					await this.enqueueScoreRefresh(payload);
					break;

				case kafkaEvents.RESCORE_CASE_EVENT:
					validateMessage(schema.rescoreCase, payload);
					await this.rescoreCase(payload);
					break;

				default:
					break;
			}
		} catch (error) {
			logger.error({ error }, "Unhandled exception with ScoreEventsHandler");
			const parsedValue = message.value ? safeJsonParse(message.value?.toString()) : message.value;
			const DLQpayload = {
				topic: DLQTOPIC,
				messages: [
					{
						key: message.key?.toString(),
						value: {
							event: parsedValue?.event,
							original_event: parsedValue?.event,
							payload: parsedValue,
							kafka_topic: kafkaTopics.SCORES,
							error: safeJsonParse(JSON.stringify(error, Object.getOwnPropertyNames(error)))
						}
					}
				]
			};
			logger.error(`PUSHING TO DLQ: ${JSON.stringify(DLQpayload)}`);
			await producer.send(DLQpayload);
			logger.error(error);
		}
	}

	async enqueueScoreRefresh(payload, index = 0) {
		const MAX_DELAY_MS = 30 * 60 * 1000; // 30 minutes
		const { business_id: businessID, customer_id: customerID, trigger_type: triggerType } = payload;
		const jobId = `${businessID}:${customerID}:${triggerType}`;
		// Staggering logic: 1 minute = 60,000 milliseconds
		const staggeredDelay = Math.min(index * 60 * 1000, MAX_DELAY_MS); // 0 min for first, 1 min for second, etc., prevent very high delays
		logger.debug({
			msg: "Enqueueing score refresh",
			business_id: businessID,
			customer_id: customerID,
			trigger_type: triggerType,
			delay_ms: staggeredDelay
		});
		try {
			await taskQueue.addJob(EVENTS.REFRESH_SCORE, payload, {
				jobId,
				removeOnComplete: true,
				removeOnFail: true,
				delay: staggeredDelay,
				timeout: 300000 // 5 minutes
			});
			logger.debug({ msg: "Successfully enqueued score refresh", jobId, delay_ms: staggeredDelay });
		} catch (error) {
			logger.error({
				msg: "Error enqueuing score refresh",
				business_id: businessID,
				customer_id: customerID,
				error: error.message ?? ""
			});
			throw error;
		}
	}

	async scoreRefresh(payload) {
		try {
			const getLatestBusinessScoreVersionQuery = `SELECT * FROM integrations.business_score_triggers WHERE business_id = $1 ORDER BY version DESC LIMIT 1`;
			const {
				rows: [latestScoreVersion]
			} = await sqlQuery({ sql: getLatestBusinessScoreVersionQuery, values: [payload.business_id] });

			if (!latestScoreVersion) {
				throw new KafkaHandlerError("No score triggers found for business");
			}
			const scoreTrigger = {
				business_id: payload.business_id,
				trigger_type: payload.trigger_type,
				version: latestScoreVersion.version + 1,
				customer_id: payload.customer_id // customer_id is null for subscription score triggers
			};

			const tasks = await seedBusinessIntegrationTasks(scoreTrigger);

			// Loop over tasks and call executeIntegrationTask, its an async function
			let response;
			const failedPlatforms = new Set();
			const failedPlatformsNotificationStatus = new Set();
			for (const task of tasks) {
				response = await executeIntegrationTask(task);
				if (!response.succeed && response.platform) {
					failedPlatforms.add(response.platform);
					failedPlatformsNotificationStatus.add(response.notification_status);
				}
			}
			try {
				await updateBusinessDetailS3(payload.business_id);
			} catch (error) {
				logger.error(
					`Unable to updateBusiness details s3, businessId: ${payload.business_id}, errorMessage: ${error.message}`
				);
			}
			// sending email when integration data fetching is failed
			if (failedPlatforms.size) {
				const emailMessage = {
					platforms: Array.from(failedPlatforms),
					business_id: payload.business_id,
					platformsNotificationStatus: Array.from(failedPlatformsNotificationStatus)
				};

				const emailPayload = {
					topic: kafkaTopics.USERS_NEW,
					messages: [
						{
							key: payload.business_id,
							value: {
								event: kafkaEvents.INTEGRATION_DATA_FETCH_FAILED,
								...emailMessage
							}
						}
					]
				};

				// send kafka event
				await producer.send(emailPayload);
			}

			// Generate risk alert if customer_id is present
			if (payload.customer_id) {
				await checkAndTriggerRiskAlert(
					"integrations",
					payload.business_id,
					tasks[0].business_score_trigger_id,
					payload.customer_id
				);
			}
		} catch (error) {
			logger.error({ error }, "Unhandled exception with score refresh");
			throw error;
		}
	}

	async rescoreCase(payload) {
		try {
			const { case_id: caseID, trigger_type: refreshTriggerType } = payload;
			// 1. Fetch score_trigger_id from data_cases using case_id
			const caseRecord = await db("public.data_cases").select("score_trigger_id").where({ id: caseID }).first();

			if (!caseRecord || !caseRecord.score_trigger_id) {
				throw new Error("No score_trigger_id found for given case_id");
			}

			const scoreTriggerId = caseRecord.score_trigger_id;

			// 2. Fetch all task ids from data_business_integrations_tasks using business_score_trigger_id
			const taskRecords = await db("integrations.data_business_integrations_tasks")
				.select("id")
				.where({ business_score_trigger_id: scoreTriggerId });

			const taskIds = taskRecords.map(task => task.id);

			if (taskIds.length === 0) {
				logger.info("No tasks found for given score_trigger_id");
				return;
			}

			// 3. Run prepareIntegrationDataForScore for each taskId
			logger.info(`Starting integration data preparation for ${taskIds.length} tasks`);
			await Promise.all(
				taskIds.map(async taskId => {
					try {
						await prepareIntegrationDataForScore(taskId, refreshTriggerType);
					} catch (err) {
						logger.error(`Task ${taskId} failed: ${err.message}`);
					}
				})
			);
			logger.info(`All integration data preparations completed for case ${caseID}`);
		} catch (error) {
			throw error;
		}
	}
}

export const scoreEventsHandler = new ScoreEventsHandler();
