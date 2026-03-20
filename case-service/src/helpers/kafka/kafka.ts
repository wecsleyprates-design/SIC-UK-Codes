import { consumerConfig, kafkaConfig, producerConfig, envConfig } from "#configs/index";
import {
	EachMessageHandler,
	Kafka,
	Consumer as KafkaConsumer,
	KafkaJSError,
	Producer as KafkaProducer,
	Message,
	ProducerRecord,
	ConsumerConfig
} from "kafkajs";
import { logger } from "../logger";
import { SERVICE_MODES } from "#constants";
import { UUID } from "crypto";

type KafkaTopic = ProducerRecord["topic"];
/**
 * Note: The Kafka Message type already has a headers property. This type is
 * just a refinement of the original type to be more explicit about the idempotencyID header.
 */
export type KafkaMessage = Message & {
	headers?: {
		/**
		 * The `idempotencyID` property is used to identify a message that has already been processed.
		 * It is the responsibility of the kafka consumer on a given service to implement idempotency logic for this to work.
		 * (see `notification-service` for an example)
		 *
		 * Deduplication is done based on the idempotencyID, the topic, and the key of the message.
		 * Idempotency across different topics or keys is not supported.
		 *
		 * Messages with the same idempotencyID, topic, and key, sent within X seconds (as defined by the idempotencyTTL),
		 * will be considered duplicates and skipped (as long as the consuming service implements idempotency logic for the message handler).
		 *
		 * Messages with the same idempotencyID, but with a different topic or key, will not be considered duplicates and will be processed normally.
		 *
		 * **Example:**
		 *
		 * | idempotencyID | topic            | key          | idempotencyTTL | sent at (seconds) | status    | reason                                              |
		 * |---------------|------------------|--------------|----------------|------------------ |-----------|-----------------------------------------------------|
		 * | 123           | cases.v1         | case_created | 1000           | 0                 | unique    | unique idempotencyID, topic, and key                |
		 * | 123           | cases.v1         | case_created | 1000           | 500               | duplicate | same idempotencyID, topic, and key                  |
		 * | 123           | cases.v1         | case_updated | 1000           | 600               | unique    | same idempotencyID, different key                   |
		 * | 123           | notifications.v1 | case_created | 1000           | 700               | unique    | same idempotencyID, different topic                 |
		 * | 234           | cases.v1         | case_created | 1000           | 800               | unique    | different idempotencyID                             |
		 * | 123           | cases.v1         | case_created | 1000           | 1001              | unique    | TTL expired, enough time passed since first message |
		 */
		idempotencyID?: string | UUID;
		/**
		 * The `idempotencyTTL` property, measured in seconds, is used to determine how long the message should be considered processed.
		 * Just like with the `idempotencyID` property, it is the responsibility of the kafka consumer on a given service to implement against this property.
		 *
		 * If the `idempotencyTTL` property is not set, the service consuming the message should use a default value defined within the service.
		 */
		idempotencyTTL?: string;

		[key: string]: any;
	};
};

export const kafkaClient = new Kafka(kafkaConfig);

class Consumer {
	private consumer: KafkaConsumer | null;;

	constructor() {
		if (envConfig.SERVICE_MODE === SERVICE_MODES.API) {
			logger.info("🔧 Isolated environment: Skipping Kafka consumer initialization");
			this.consumer = null;
			return;
		}
		if (!consumerConfig) {
			logger.info("Kafka consumer config unavailable — skipping consumer initialization");
			this.consumer = null;
			return;
		}
		const configWithRestart: ConsumerConfig = {
			...consumerConfig,
			retry: {
				...(consumerConfig as any).retry,
				restartOnFailure: async (error: Error) => {
					logger.error(
						{
							error: error.message,
							name: error.name,
							type: (error as any).type,
							code: (error as any).code
						},
						"Kafka consumer failure — restarting in 5s"
					);
					await new Promise(resolve => setTimeout(resolve, 5000));
					return true;
				}
			}
		} as ConsumerConfig;
		this.consumer = kafkaClient.consumer(configWithRestart);
	}

	async init() {
		if (!this.consumer) {
			return;
		}
		try {
			await this.consumer.connect();
		} catch (error) {
			throw error;
		}
	}

	async run(topics: string[], handler: EachMessageHandler) {
		if (!this.consumer) {
			return;
		}
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
		if (!this.consumer) {
			return;
		}
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
		this.producer = kafkaClient.producer(producerConfig);
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
	 *   - headers: (optional) - Kafka message headers for idempotency
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
		topic: KafkaTopic;
		messages: Array<{
			key: string;
			value: { event: string; [key: string]: any } | string;
			headers?: KafkaMessage["headers"];
		}>;
	}): Promise<void> {
		if (this.isStringifiedMessage(messages)) {
			logger.warn({ topic, messages }, "Stringified messages are not supported. Please use the object format.");
			// convert it to the new way by unserializing then inserting the new 'event' property
			messages = messages.map(msg => ({
				key: msg.key,
				value: { ...JSON.parse(msg.value), event: msg.key },
				...(msg.headers && { headers: msg.headers })
			}));
		}

		const serializedMessages = messages.map(msg => ({
			key: msg.key,
			value: JSON.stringify(msg.value),
			...(msg.headers && { headers: msg.headers })
		}));

		try {
			await this.producer.send({ topic, messages: serializedMessages });
		} catch (error) {
			if ((error as KafkaJSError).message === "The producer is disconnected") {
				await this.init();
				// Retry with same message preparation
				await this.producer.send({ topic, messages: serializedMessages });
				return;
			}
			throw error;
		}
	}

	private isStringifiedMessage(
		messages: unknown
	): messages is Array<{ key: string; value: string; headers?: KafkaMessage["headers"] }> {
		return Array.isArray(messages) && messages.every(msg => typeof msg.value === "string");
	}
}
export const consumer = new Consumer();
export const producer = new Producer();