class CoreApiError extends Error {
	constructor(message, httpStatus, errorCode) {
		super(message);
		this.name = "CoreApiError";
		this.status = httpStatus;
		this.errorCode = errorCode;
	}
}

export { CoreApiError };
