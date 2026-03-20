import { BullQueue, consumer, logger, confirmKafkaTopicsExist } from "#helpers/index";
import { kafkaTopics } from "#constants/index";
import { handler } from "./kafka/consumers";

/**
 * Initialize Kafka handler
 * @param {boolean} connectOnly - If true, only verify connection without consuming messages.
 *                                Used in health check mode to verify Kafka connectivity
 *                                without actually processing any messages.
 */
export const initKafkaHandler = async (connectOnly = false) => {
	try {
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
	logger.debug(`Enqueueing ${queueEvent} for business: ${businessID} to ${queue.queue.name}`);
	await queue
		.addJob(queueEvent, payload, {
			jobId,
			removeOnComplete: true,
			removeOnFail: true,
			delay: 500,
			timeout: 100000 /* Fail if it takes 1000ms of actual processing */
		})
		.catch(error => {
			logger.error({ error }, `Error enqueuing ${queueEvent} for business: ${businessID}`);
			throw error; // rethrow error to be caught by the caller and thus get put into DLQ
		});
};
