class CustomerApiError extends Error {
	constructor(message, httpStatus, errorCode, data = {}) {
		super(message);
		this.name = "CustomerApiError";
		this.status = httpStatus;
		this.errorCode = errorCode;
		this.data = data;
	}
}

export { CustomerApiError };
