class VerificationApiError extends Error {
	constructor(message, httpStatus, errorCode) {
		super(message);
		this.name = "VerificationApiError";

		this.status = httpStatus;
		this.errorCode = errorCode;

		// Allow the error to be serialized to JSON
		this.toJSON = () => {
			return {
				name: this.name,
				message: this.message,
				errorCode: this.errorCode,
				status: this.status
			};
		};
	}
}

export { VerificationApiError };
