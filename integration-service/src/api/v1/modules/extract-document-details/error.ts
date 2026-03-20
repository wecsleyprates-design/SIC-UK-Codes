class ExtractDocumentDetailsApiError extends Error {
	status: number;
	errorCode: string;

	constructor(message: string, httpStatus: number, errorCode: string) {
		super(message);
		this.name = "ExtractDocumentDetailsApiError";

		this.status = httpStatus;
		this.errorCode = errorCode;
	}
}

export { ExtractDocumentDetailsApiError };
