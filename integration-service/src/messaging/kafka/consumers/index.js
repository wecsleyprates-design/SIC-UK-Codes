import { DLQTOPIC, kafkaTopics } from "#constants/index";
import { producer, logger } from "#helpers/index";
import { safeJsonParse } from "#utils/index";
import {
	businessEventsHandler,
	caseEventsHandler,
	integrationEventsHandler,
	reportEventsHandler,
	scoreEventsHandler,
	electronicConsentEventsHandler,
	entityMatchingEventsHandler,
	notificationEventsHandler
} from "./handlers/index";
import { withTimeout, withTimer } from "@joinworth/worth-core-utils";
import { consumerConfig } from "#configs/kafka.config";

const HANDLER_TIMEOUT = consumerConfig.sessionTimeout - 10000; // 80s with 90s session
const SLOW_HANDLER_THRESHOLD = consumerConfig.sessionTimeout / 2; // 45s
const HEARTBEAT_INTERVAL = Math.min(consumerConfig.heartbeatInterval - 500, 10000); // 10s

export const handler = async ({ topic, partition, message, heartbeat }) => {
	const heartbeatIntervalId = setInterval(() => heartbeat(), HEARTBEAT_INTERVAL);

	let error = null;
	logger.info(`Processing topic ${topic}`);
	try {
		const result = (() => {
			switch (topic) {
				case kafkaTopics.BUSINESS:
					return businessEventsHandler.handleEvent(message);

				case kafkaTopics.SCORES:
					return scoreEventsHandler.handleEvent(message);

				case kafkaTopics.CASES:
					return caseEventsHandler.handleEvent(message);

				case kafkaTopics.INTEGRATIONS:
					return integrationEventsHandler.handleEvent(message);

				case kafkaTopics.REPORTS:
					return reportEventsHandler.handleEvent(message);

				case kafkaTopics.ELECTRONIC_CONSENT:
					return electronicConsentEventsHandler.handleEvent(message);

				case kafkaTopics.WAREHOUSE:
					return entityMatchingEventsHandler.handleEvent(message);

				case kafkaTopics.NOTIFICATIONS:
					return notificationEventsHandler.handleEvent(message);

				default:
					return null;
			}
		})();

		// Wrap the business logic in a timer and log the results to identify slow handlers
		const timedHandlerPromise = withTimer(result)
			.then(({ value, durationMs }) => {
				const logContext = { topic, partition, offset: message.offset, durationMs };
				const logMessage = `Processed topic ${topic} in ${durationMs}ms`;
				if (durationMs > SLOW_HANDLER_THRESHOLD) {
					logger.warn(logContext, logMessage);
				} else {
					logger.debug(logContext, logMessage);
				}
				return value;
			})
			.catch(error => {
				logger.error({ error }, `Error processing topic ${topic}`);
				throw error;
			});

		// Top level timeout guardrail to prevent the consumer from hanging indefinitely
		await withTimeout(timedHandlerPromise, HANDLER_TIMEOUT).finally(() => {
			clearInterval(heartbeatIntervalId);
		});
	} catch (err) {
		error = err;
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
						kafka_topic: topic,
						error: safeJsonParse(JSON.stringify(error, Object.getOwnPropertyNames(error)))
					}
				}
			]
		};
		await producer.send(DLQpayload);
		logger.error(error);
	} finally {
		if (error) {
			logger.error(error);
		}
	}
};
