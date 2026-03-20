module.exports = {
	Kafka: jest.fn().mockImplementation(() => ({
		consumer: jest.fn().mockImplementation(() => ({
			subscribe: jest.fn(),
			run: jest.fn()
		})),
		producer: jest.fn().mockImplementation(() => ({
			connect: jest.fn(),
			send: jest.fn()
		})),
		KafkaJSError: jest.fn()
	})),
	logLevel: {
		ERROR: "error",
		DEBUG: "debug"
	},
	Partitioners: {
		LegacyPartitioner: jest.fn()
	}
};
