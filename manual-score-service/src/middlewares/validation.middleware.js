import Joi from "joi";
import { StatusCodes } from "http-status-codes";
import { pick } from "#utils/index";
import { ERROR_CODES } from "#constants/index";

class ValidationMiddlewareError extends Error {
	constructor(message, httpStatus, errorCode) {
		super(message);
		this.name = "ValidationMiddlewareError";
		this.status = httpStatus;
		this.errorCode = errorCode;
	}
}

export const validateSchema = schema => (req, res, next) => {
	const validSchema = pick(schema, ["params", "query", "body"]);
	const object = pick(req, Object.keys(validSchema));
	const { value, error } = Joi.compile(validSchema)
		.prefs({ errors: { label: "key", wrap: { label: false } }, abortEarly: false })
		.validate(object);

	if (error) {
		const errorMessage = error.details.map(details => details.message).join(", ");
		throw new ValidationMiddlewareError(errorMessage, StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
	}
	Object.assign(req, value);
	return next();
};

export const validateMessage = (schema, payload) => {
	// Extract event property before validation (used for Kafka routing/migration).
	// This allows messages to include 'event' in payload without validation errors.
	const { event, ...payloadToValidate } = payload;

	const { value, error } = Joi.compile(schema)
		.prefs({ errors: { label: "key", wrap: { label: " " } }, abortEarly: false })
		.validate(payloadToValidate);

	if (error) {
		const errorMessage = error.details.map(details => details.message).join(", ");
		throw new Error(errorMessage);
	}

	Object.assign(payload, value);
	// Restore event property if it was present
	if (event !== undefined) {
		payload.event = event;
	}
};
