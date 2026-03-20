class KafkaHandlerError extends Error {
	constructor(message) {
		super(message);
		this.name = "KafkaHandlerError";
	}
}

export { KafkaHandlerError };
