import { Partitioners, logLevel } from "kafkajs";
import { envConfig } from "./env.config";

const baseConfig = {
	brokers: (envConfig.KAFKA_BROKERS || "").split(",").map(broker => broker.trim()),
	ssl: envConfig.KAFKA_SSL_ENABLED,
	clientId: envConfig.KAFKA_CLIENT_ID,
	connectionTimeout: 3000,
	requestTimeout: 30000,
	enforceRequestTimeout: false,
	retry: {
		// Documentation: https://kafka.js.org/docs/configuration#default-retry
		maxRetryTime: 30000,
		initialRetryTime: 300,
		retries: 5,
		factor: 0.2,
		multiplier: 2,
		logLevel: envConfig.ENV === "production" ? logLevel.ERROR : logLevel.DEBUG
	}
};

let kafkaConfig = {};

if (envConfig.KAFKA_SSL_ENABLED) {
	kafkaConfig = {
		...baseConfig,
		sasl: {
			mechanism: "scram-sha-512", // scram-sha-256 or scram-sha-512
			username: envConfig.KAFKA_SASL_USERNAME,
			password: envConfig.KAFKA_SASL_PASSWORD
		}
	};
} else {
	kafkaConfig = baseConfig;
}

export { kafkaConfig };

/* Refer Documentation: https://kafka.js.org/docs/consuming#a-name-options-a-options */
export const consumerConfig = {
	groupId: envConfig.KAFKA_GROUP_ID,
	// partitionAssigners: PartitionAssigner[PartitionAssigners.roundRobin] (Default)
	metadataMaxAge: 300000, // 5 minutes
	sessionTimeout: 90000, // 90s — tolerates event loop blocks up to ~30s
	rebalanceTimeout: 300000, // 5 min — gives coordinator plenty of time with lots of pod members
	heartbeatInterval: 25000, // must be < sessionTimeout/3 (30000)
	maxBytesPerPartition: 1048576, // 1 MB
	minBytes: 1, // 1 byte
	maxBytes: 10485760, // 10 MB
	maxWaitTimeInMs: 5000,
	retry: {
		maxRetryTime: 30000,
		initialRetryTime: 300,
		retries: 5,
		factor: 0.2,
		multiplier: 2
	},
	allowAutoTopicCreation: false,
	readUncommitted: false
};

/* Refer Option Config https://kafka.js.org/docs/producing#options*/

export const producerConfig = {
	retry: {
		// Documentation: https://kafka.js.org/docs/configuration#default-retry
		maxRetryTime: 30000,
		initialRetryTime: 300,
		retries: 5,
		factor: 0.2,
		multiplier: 2
	},
	metadataMaxAge: 300000,
	allowAutoTopicCreation: false, // Default: true
	idempotent: false,
	createPartitioner: Partitioners.LegacyPartitioner
};

export const sslConfig = {
	rejectUnauthorized: true,
	ca: ["path/to/ca.pem"],
	key: "path/to/client.key",
	cert: "path/to/client.crt"
};
