import {
	Kafka,
	KafkaJSError,
	Consumer as KafkaConsumer,
	Producer as KafkaProducer,
	EachMessageHandler,
	KafkaConfig,
	ConsumerConfig,
	ProducerConfig
} from "kafkajs";
import { consumerConfig, producerConfig, kafkaConfig, envConfig } from "#configs/index";
import { ENVIRONMENTS } from "#constants";
import { logger } from "./logger";

const kafkaClient = new Kafka(kafkaConfig as unknown as KafkaConfig);

class Consumer {
	private consumer: KafkaConsumer;

	constructor() {
		this.consumer = kafkaClient.consumer(consumerConfig as unknown as ConsumerConfig);
	}

	async init() {
		try {
			await this.consumer.connect();
		} catch (error) {
			throw error;
		}
	}

	async run(topics: string[], handler: EachMessageHandler) {
		try {
			await this.consumer.subscribe({ topics, fromBeginning: true });
			const partitionsConsumedConcurrently =
				Number(process.env.KAFKA_PARTITIONS_CONSUMED_CONCURRENTLY) || 3;
			await this.consumer.run({
				autoCommit: true,
				partitionsConsumedConcurrently: partitionsConsumedConcurrently,
				eachMessage: handler
			});
		} catch (error) {
			throw error;
		}
	}

	async commitOffsets(offsets) {
		try {
			await this.consumer.commitOffsets(offsets);
		} catch (error) {
			throw error;
		}
	}
}

class Producer {
	private producer: KafkaProducer;

	constructor() {
		this.producer = kafkaClient.producer(producerConfig as unknown as ProducerConfig);
	}

	async init() {
		try {
			await this.producer.connect();
		} catch (error) {
			throw error;
		}
	}

	/**
	 * Sends messages to Kafka topic
	 * @param {String} topic - The Kafka topic name
	 * @param {Array} messages - Array of message objects with the following properties:
	 *   - key: (string) - Entity identifier for partitioning (e.g., businessId, caseId)
	 *   - value: (object) - Message payload containing 'event' property for routing
	 * @returns {Promise<void>}
	 *
	 * @example
	 * await producer.send({
	 *   topic: 'business.v1',
	 *   messages: [{
	 *     key: 'business-123',  // Entity ID for partitioning
	 *     value: {
	 *       event: 'BUSINESS_INVITED',  // Event type for routing (required)
	 *       case_id: '123',
	 *       business_id: 'business-123'
	 *     }
	 *   }]
	 * });
	 */
	async send({
		topic,
		messages
	}: {
		topic: string;
		messages: Array<{
			key: string;
			value: { event: string; [key: string]: any };
		}>;
	}): Promise<void> {
		const serializedMessages = messages.map(msg => ({
			key: msg.key,
			value: JSON.stringify(msg.value)
		}));

		try {
			await this.producer.send({ topic, messages: serializedMessages });
		} catch (error) {
			if (error instanceof KafkaJSError && (error as Error).message === "The producer is disconnected") {
				await this.init();
				await this.producer.send({ topic, messages: serializedMessages });
				return;
			}
			throw error;
		}
	}
}

export const consumer = new Consumer();
export const producer = new Producer();

/**
 * Ensures that all required Kafka topics exist in the cluster.
 *
 * Behavior:
 * - In DEVELOPMENT: automatically creates any missing topics (idempotent).
 * - In NON-DEVELOPMENT (e.g., staging/production): throws an error if topics are missing,
 *   so that misconfiguration or infra issues are caught early at startup.
 *
 * @param topics - Array of Kafka topic names that must exist.
 * @throws Error if required topics are missing in non-development environments.
 *
 * Example usage:
 * ```ts
 * await confirmKafkaTopicsExist(["user-events", "order-events"]);
 * ```
 */
export const confirmKafkaTopicsExist = async (topics: string[]) => {
	const admin = kafkaClient.admin();

	try {
		// Establish a short-lived admin connection
		await admin.connect();

		// Retrieve all topic names currently registered in the cluster
		const existing = await admin.listTopics();

		// Identify which required topics are missing
		const missing = topics.filter(t => !existing.includes(t));

		// Determine whether we are in development mode
		const isDev = envConfig.ENV === ENVIRONMENTS.DEVELOPMENT;

		if (missing.length > 0) {
			if (isDev) {
				// Development: create only the missing topics (idempotent — safe to call multiple times)
				await admin.createTopics({
					topics: missing.map(topic => ({
						topic,
						numPartitions: 1,
						replicationFactor: 1
					})),
					waitForLeaders: true // ensure leader election before proceeding
				});

				// Log each topic creation explicitly for better observability
				missing.forEach(topic => {
					logger.info(`Created Kafka topic: ${topic}`);
				});
			} else {
				// Non-development: fail fast so infra/config problems are surfaced early
				throw new Error(`Missing required Kafka topics: ${missing.join(", ")}`);
			}
		} else {
			// All required topics are present → nothing to do
			logger.debug("All required Kafka topics exist");
		}

		// Normal completion (return is optional here but explicit for clarity)
	} catch (err) {
		// Log error context and propagate upwards to caller
		logger.error(err as Error, "confirmKafkaTopicsExist failed");
		throw err;
	} finally {
		// Always clean up connection.
		// If disconnect itself fails, log a warning instead of throwing,
		// so that the original error (if any) isn't masked.
		await admin.disconnect().catch(err => {
			logger.warn(err as Error, "Kafka admin disconnect failed");
		});
	}
};

