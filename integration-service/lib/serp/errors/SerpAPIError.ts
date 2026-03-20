export class SerpAPIError extends Error {
	status: number;
	errorCode: string;

	constructor(message: string, httpStatus: number, errorCode: string) {
		super(message);
		this.name = "SerpAPIError";

		this.status = httpStatus;
		this.errorCode = errorCode;
	}
}
