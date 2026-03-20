/** Used when CONFIG_SERVICE_MODE is set. api = Express only; worker = Kafka + Bull workers. */
export const SERVICE_MODES = {
	API: "api",
	WORKER: "worker"
} as const;
