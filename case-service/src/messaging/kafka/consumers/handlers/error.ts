class KafkaHandlerError extends Error {
	status: number;
	errorCode: number;
	constructor(message, httpStatus, errorCode) {
		super(message);
		this.name = "KafkaHandlerError";
		this.status = httpStatus;
		this.errorCode = errorCode;
	}
}

export { KafkaHandlerError };
