class OcrApiError extends Error {
	status: number;
	errorCode: string;

	constructor(message: string, httpStatus: number, errorCode: string) {
		super(message);
		this.name = "OcrApiError";

		this.status = httpStatus;
		this.errorCode = errorCode;
	}
}

export { OcrApiError };
