class ScoreApiError extends Error {
	constructor(message, httpStatus, errorCode) {
		super(message);
		this.name = "ScoreApiError";

		this.status = httpStatus;
		this.errorCode = errorCode;
	}
}

export { ScoreApiError };
