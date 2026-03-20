class FaqChatBotApiError extends Error {
	status: number;
	errorCode: string;

	constructor(message: string, httpStatus: number, errorCode: string) {
		super(message);
		this.name = "FaqChatBotApiError";

		this.status = httpStatus;
		this.errorCode = errorCode;
	}
}

export { FaqChatBotApiError };
