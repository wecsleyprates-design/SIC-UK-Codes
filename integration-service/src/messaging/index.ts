import { consumer, logger, confirmKafkaTopicsExist } from "#helpers/index";
import { kafkaTopics } from "#constants/index";
import { handler } from "./kafka/consumers";
import { envConfig } from "#configs/env.config";
import type BullQueue from "#helpers/bull-queue";

/**
 * Initialize Kafka handler
 * @param {boolean} connectOnly - If true, only verify connection without consuming messages.
 *                                Used in health check mode to verify Kafka connectivity
 *                                without actually processing any messages.
 */
export const initKafkaHandler = async (connectOnly = false) => {
	try {
		if (envConfig.KAFKA_DISABLE_CONSUMER === true) {
			logger.warn("Kafka consumer is disabled");
			return;
		}
		const topics = Object.values(kafkaTopics);

		// Verify topics exist (uses admin connection to validate Kafka access)
		await confirmKafkaTopicsExist(topics);

		// Initialize consumer (connects to brokers, validates credentials)
		await consumer.init();

		if (connectOnly) {
			logger.info("Kafka connection verified (health-check mode - not consuming messages)");
			return;
		}

		// Normal mode: subscribe to topics and start consuming messages
		await consumer.run(topics, handler);
		logger.info("Kafka consumer started and processing messages");
	} catch (error) {
		throw error;
	}
};

/** Enqueue a Kafka message into a BullQueue task
 * @param queue: BullQueue
 * @param queueEvent: string
 * @param payload: any
 * @param jobId?: string
 *  Care must be taken that jobId is globally unique if provided
 *
 */
export const kafkaToQueue = async (queue: BullQueue, queueEvent: string, payload: any, jobId?: string) => {
	const { business_id: businessID } = payload;
	logger.info(`Enqueueing ${queueEvent} for business: ${businessID}`);
	await queue
		.addJob(queueEvent, payload, {
			jobId,
			removeOnComplete: { count: 200, age: 60 * 60 * 24 },
			removeOnFail: { count: 100, age: 60 * 60 * 24 },
			delay: 500,
			timeout: 100000
		})
		.catch(error => {
			logger.error(`Error enqueuing ${queueEvent} for business: ${businessID}, error: ${error.message ?? ""}`);
			throw error;
		});
};
