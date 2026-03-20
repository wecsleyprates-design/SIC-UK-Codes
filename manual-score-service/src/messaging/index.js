import { consumer, confirmKafkaTopicsExist, logger } from "#helpers/index";
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
