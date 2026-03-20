export const Kafka = jest.fn().mockImplementation(() => ({
	consumer: jest.fn().mockImplementation(() => ({
		connect: jest.fn().mockResolvedValue(undefined),
		subscribe: jest.fn().mockResolvedValue(undefined),
		run: jest.fn().mockResolvedValue(undefined),
		commitOffsets: jest.fn().mockResolvedValue(undefined),
		on: jest.fn(),
		events: {
			COMMIT_OFFSETS: "consumer.commit_offsets"
		}
	})),
	producer: jest.fn().mockImplementation(() => ({
		connect: jest.fn().mockResolvedValue(undefined),
		send: jest.fn().mockResolvedValue(undefined)
	}))
}));

export class KafkaJSError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "KafkaJSError";
	}
}

export const logLevel = {
	ERROR: "error",
	DEBUG: "debug"
};

export const Partitioners = {
	LegacyPartitioner: jest.fn()
};

export type Consumer = any;
export type ConsumerConfig = any;
export type KafkaConfig = any;
export type ProducerConfig = any;
