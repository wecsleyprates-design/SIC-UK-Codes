import { HttpStatusCode } from "axios";
import { BaseError, type BaseErrorCodes, type BaseErrorContext } from "#models/baseError";

export const DataScrapeApiErrorCodes = {
	DS_C00000: {
		message: "Invalid Connection Reference",
		httpStatus: HttpStatusCode.BadRequest,
		key: "invalid_connection_reference_serp"
	},
	DS_K0000: { message: "Invalid API Key", httpStatus: HttpStatusCode.FailedDependency, key: "invalid_api_key_openai" },
	DS_K0001: { message: "Invalid API Key", httpStatus: HttpStatusCode.FailedDependency, key: "invalid_api_key_serp" },
	DS_I0001: {
		message: "Unable to Serialize Data",
		httpStatus: HttpStatusCode.BadRequest,
		key: "unable_to_serialize_data_openai"
	},
	DS_I0002: {
		message: "Unable to Serialize Data",
		httpStatus: HttpStatusCode.BadRequest,
		key: "unable_to_serialize_data_serp"
	},
	DS_I0003: {
		message: "Unable to Classify Data",
		httpStatus: HttpStatusCode.BadRequest,
		key: "unable_to_classify_data_openai"
	},
	DS_I0004: {
		message: "Unable to Synthesize Data",
		httpStatus: HttpStatusCode.BadRequest,
		key: "unable_to_synthesize_data_openai"
	},
	DS_I0005: {
		message: "Unable to Search API",
		httpStatus: HttpStatusCode.BadRequest,
		key: "unable_to_search_serpapi"
	},
	DS_I0006: {
		message: "Unable to Fetch Latest Record",
		httpStatus: HttpStatusCode.NotFound,
		key: "unable_to_fetch_latest_record"
	},
	DS_I0007: {
		message: "Unable to Execute Task",
		httpStatus: HttpStatusCode.UnprocessableEntity,
		key: "unable_to_execute_serp_search"
	}
} as const satisfies BaseErrorCodes;
export type DataScrapeApiErrorKey = keyof typeof DataScrapeApiErrorCodes;

export type DataScrapeApiErrorRecord = (typeof DataScrapeApiErrorCodes)[DataScrapeApiErrorKey];

class DataScrapeApiError extends BaseError {
	static override readonly CODES = DataScrapeApiErrorCodes;

	constructor(
		errorCode: DataScrapeApiErrorKey | DataScrapeApiErrorRecord,
		message?: string,
		context?: BaseErrorContext
	) {
		super(errorCode, message, context);
	}
}

export { DataScrapeApiError };
