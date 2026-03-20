class PublicRecordsApiError extends Error {
	status;
	errorCode;
	constructor(message, httpStatus, errorCode) {
		super(message);
		this.name = "PublicRecordsApiError";
		this.status = httpStatus;
		this.errorCode = errorCode;
	}
}
export { PublicRecordsApiError };