import { logger } from "#helpers";
import { containsSql, isKnexError, isPgDatabaseError } from "#utils";

export class DatabaseError extends Error {
	constructor(errorOrMessage: string | Error | unknown) {
		let message: string;

		if (typeof errorOrMessage === "string") {
			message = errorOrMessage;
		} else if (isKnexError(errorOrMessage)) {
			message = errorOrMessage.nativeError?.message || errorOrMessage.message;
			/**
			 * For security reasons, we don't want to expose any SQL queries in our error messages.
			 * Knex does this annoying thing where it prefixes the pg error message with the full SQL query.
			 * So, if the error message contains SQL, we will remove it.
			 */
			if (containsSql(message)) message = message.split(" - ")?.[1] || message;
		} else if (isPgDatabaseError(errorOrMessage)) {
			message = errorOrMessage.message;
			/**
			 * For security reasons, we don't want to expose any SQL queries in our error messages.
			 * Knex does this annoying thing where it prefixes the pg error message with the full SQL query.
			 * So, if the error message contains SQL, we will remove it.
			 */
			if (containsSql(message)) message = message.split(" - ")?.[1] || message;
		} else if (errorOrMessage instanceof Error) {
			message = errorOrMessage.message;
		} else {
			logger.error(
				{
					error: errorOrMessage
				},
				"DatabaseError: Unknown error type"
			);

			message = "Unknown error";
		}

		super(message);
		this.name = "DatabaseError";
	}
}
