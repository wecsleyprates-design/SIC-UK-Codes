export const ENVIRONMENTS = {
	UNIT: "unit",
	INTEGRATION: "integration",
	DEVELOPMENT: "development",
	STAGING: "staging",
	PRODUCTION: "production"
};

/** Used when CONFIG_SERVICE_MODE=worker. Undefined = legacy (run Kafka + all Bull queues). */
export const WORKER_TYPES = {
	KAFKA: "kafka",
	CRITICAL: "critical",
	GENERAL: "general"
};

export const VALID_WORKER_TYPES = Object.values(WORKER_TYPES);

export const SERVICE_MODES = {
	JOB: "job", // Kubernetes background job
	API: "api", // Express Server
	WORKER: "worker" // Queue/Task/Kafka Consumer Worker
};
