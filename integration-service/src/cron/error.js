class CronJobError extends Error {
	constructor(message, httpStatus, errorCode) {
		super(message);
		this.name = "CronJobError";
		this.status = httpStatus;
		this.errorCode = errorCode;
	}
}

export { CronJobError };
