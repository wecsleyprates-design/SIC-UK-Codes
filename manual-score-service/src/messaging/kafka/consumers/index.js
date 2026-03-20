import { dlqTopic, kafkaTopics } from "#constants/index";
import { logger, producer } from "#helpers/index";
import { businessEventsHandler } from "./handlers/business";
import { safeJsonParse } from "#utils/index";
import { aiScoreEventsHandler, scoreEventsHandler, userEventsHandler } from "./handlers/index";
import { reportEventsHandler } from "./handlers/report";
import { withTimeout, withTimer } from "@joinworth/worth-core-utils";
import { consumerConfig } from "#configs/kafka.config";

const sessionTimeout = consumerConfig?.sessionTimeout ?? 90000;
const heartbeatInterval = consumerConfig?.heartbeatInterval ?? 25000;
const HANDLER_TIMEOUT = sessionTimeout - 10000; // 80s with 90s session
const SLOW_HANDLER_THRESHOLD = sessionTimeout / 2; // 45s
const HEARTBEAT_INTERVAL = Math.min(heartbeatInterval - 500, 10000); // 10s

export const handler = async ({ topic, partition, message, heartbeat }) => {
	const heartbeatIntervalId = setInterval(() => heartbeat(), HEARTBEAT_INTERVAL);

	let error = null;
	logger.info(`Processing topic ${topic}`);
	try {
		const result = (() => {
			switch (topic) {
				case kafkaTopics.SCORES:
					return scoreEventsHandler.handleEvent(message);

				case kafkaTopics.AI_SCORES:
					return aiScoreEventsHandler.handleEvent(message);

				case kafkaTopics.USERS:
					return userEventsHandler.handleEvent(message);

				case kafkaTopics.BUSINESS:
					return businessEventsHandler.handleEvent(message);

				case kafkaTopics.REPORTS:
					return reportEventsHandler.handleEvent(message);

				default:
					return null;
			}
		})();

		// Wrap the business logic in a timer and log the results to identify slow handlers
		const timedHandlerPromise = withTimer(Promise.resolve(result))
			.then(({ value, durationMs }) => {
				const logContext = { topic, partition, offset: message.offset, durationMs };
				const logMessage = `Processed topic ${topic} in ${durationMs}ms`;
				if (durationMs > SLOW_HANDLER_THRESHOLD) {
					logger.warn(logContext, logMessage);
				} else {
					logger.warn(logContext, logMessage);
				}
				return value;
			})
			.catch(err => {
				logger.error({ error: err }, `Error processing topic ${topic}`);
				throw err;
			});

		// Top level timeout guardrail to prevent the consumer from hanging indefinitely
		await withTimeout(timedHandlerPromise, HANDLER_TIMEOUT).finally(() => {
			clearInterval(heartbeatIntervalId);
		});
	} catch (err) {
		error = err;
		const messageBody = message.value ? safeJsonParse(message.value?.toString()) : message.value;
		const event = messageBody?.event || message.key?.toString();
		const DLQData = {
			payload: messageBody,
			kafka_topic: topic,
			error: safeJsonParse(JSON.stringify(error, Object.getOwnPropertyNames(error)))
		};
		const DLQpayload = {
			topic: dlqTopic,
			messages: [
				{
					key: message.key?.toString(),
					value: {
						event,
						...DLQData
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
