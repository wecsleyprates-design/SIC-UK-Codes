import { logger } from "#helpers";
import { plaidInputValidationSchema } from "./plaidInputValidationSchema";
import type { IdentityVerificationCreateRequest, IdentityVerificationRetryRequest, IDNumberType, UserIDNumber } from "plaid";

/**
 * Get the input validation schema for a particular country code
 * @param countryCode - The country code to get the input validation schema for
 * @returns The input validation schema for the country code or undefined if the country code is not supported
 */
export function getInputValidationForCountry(countryCode: string): PlaidInputValidation | undefined {
	const countryCodeAsUpper = countryCode?.toUpperCase();
	return plaidInputValidationSchema.find(validation => validation.country.code === countryCodeAsUpper);
}

/**
 * Silently constrains the input to the country's supported input types.
 * Does not mutate the original input.
 * @param passedInput - The input to constrain
 * @returns The constrained input as a new object
 */
export function constrainInput<T extends IdentityVerificationRetryRequest | IdentityVerificationCreateRequest = IdentityVerificationCreateRequest>(passedInput: T): T {
	// Make a deep copy of the input so we don't mutate the original
	const input = structuredClone(passedInput);

	const countryCode = input.user?.address?.country;
	if (!countryCode) return input;

	const validation = getInputValidationForCountry(countryCode);
	if (!validation) return input;

	const { input_validation } = validation;

	// Remove elements that are not supported for the country
	if (input.user?.address?.postal_code && input_validation["address.postal_code"] === "not_supported") {
		delete input.user.address.postal_code;
	}

	if (input.user?.address?.region && input_validation["address.subdivision"] === "not_supported") {
		delete input.user.address.region;
	}
	if (input.user?.id_number && input_validation["id_number"] === "not_supported") {
		delete input.user.id_number;
	}
	if (input.user?.id_number && input_validation["id_number"] === "optional") {
		// Check to see if the id number is valid for the type, if so keep it otherwise remove it
		try {
			validateIDNumber(input.user.id_number, validation);
		} catch (ex) {
			if (ex instanceof Error) {
				logger.warn(`Stripping invalid ID number: ${input.user.id_number.value} for type: ${input.user.id_number.type}, error: ${ex.message}`);
			}
			delete input.user.id_number;
		}
	}
	return input;
}

/*
 * Validates the input for the country
 * Returns true if the input is valid, false otherwise
 * @param input - The input to validate
 * Throws an error if the input is not valid
 */
export function validate<T extends IdentityVerificationRetryRequest | IdentityVerificationCreateRequest = IdentityVerificationCreateRequest>(input: T): void {
	if (!input?.user) {
		throw new IDVValidationError("User context not provided", input);
	}

	const countryCode = input.user?.address?.country;
	if (!countryCode) {
		throw new IDVValidationError("Country code is required", input);
	}

	const validation = getInputValidationForCountry(countryCode);
	if (!validation) {
		throw new IDVValidationError(`Country code is not supported: ${countryCode}`, input);
	}

	const errors: string[] = [];
	if (validation.input_validation["address.postal_code"] === "required" && !input.user?.address?.postal_code) {
		errors.push(`Address postal code is required for country ${countryCode}`);
	}
	if (validation.input_validation["address.subdivision"] === "required" && !input.user?.address?.region) {
		errors.push(`Address region/subdivision is required for country ${countryCode}`);
	}

	if (validation.input_validation["id_number"] === "required" || validation.input_validation["id_number"] === "optional") {
		// Ensure the ID number object is well formed
		if (validation.input_validation["id_number"] === "required" && input.user?.id_number?.value == null) {
			errors.push(`ID number is required for country ${countryCode}`);
		} else if (validation.input_validation["id_number"] === "required" && input?.user?.id_number?.type == null) {
			errors.push(`ID number type is required for country ${countryCode}`);
		} else if (input.user?.id_number) {
			try {
				validateIDNumber(input.user.id_number, validation);
			} catch (ex) {
				errors.push(ex instanceof Error ? ex.message : "An unknown error occurred while validating the ID number");
			}
		}
	}

	if (validation.input_validation["address.postal_code"] === "not_supported" && input.user?.address?.postal_code) {
		errors.push(`Address postal code is not supported for country ${countryCode}`);
	}
	if (validation.input_validation["address.subdivision"] === "not_supported" && input.user?.address?.region) {
		errors.push(`Address region/subdivision is not supported for country ${countryCode}`);
	}
	if (validation.input_validation["id_number"] === "not_supported" && input.user?.id_number?.value) {
		errors.push(`ID number is not supported for country ${countryCode}`);
	}

	if (errors.length > 0) {
		throw new IDVValidationError(`Identity Verification validation failed: ${errors.join(", ")}`, input, validation);
	}
}

/**
 * Pass in an ID Number and a Plaid Validation Schema
 * Finds the ID number type for the given ID that passes validation
 * @param id - The ID number to find the type for
 * @param validation - The Plaid validation schema
 * @returns The ID number type that passes validation or undefined if no type passes validation
 */
export function findIDNumberType(id: string, validation: PlaidInputValidation): IDNumberTypeValue | undefined {
	// Iterate through the ID number types and find the first one that passes validation
	for (const idNumberType of validation.id_numbers) {
		try {
			validateIDNumber({ value: id, type: idNumberType.type as IDNumberType }, validation);
			return idNumberType.type;
		} catch (ex) {
			// Swallow exception, try the next ID number type
		}
	}
}

function validateIDNumber(userID: UserIDNumber, validation: PlaidInputValidation) {
	if (!userID.type || userID.value == null) {
		throw new Error(`ID not well formed: ${JSON.stringify(userID)} type: ${typeof userID.value}`);
	}
	// Error if the ID number value isn't a string (Plaid also doesn't support anything other than strings - so numbers must be typeof string)
	if (typeof userID.value !== "string") {
		throw new Error(`ID number value must be a string: ${JSON.stringify(userID)}`);
	}

	// Find the right ID number schema for the ID number type
	const idSchema = validation.id_numbers.find(schema => schema.type === userID.type);
	if (!idSchema) {
		const supportedTypes = validation.id_numbers.map(schema => schema.type).join(", ");
		throw new Error(`ID number type ${userID.type} is not supported for country ${validation.country.code} - Supported types: ${supportedTypes}`);
	}

	const { pattern, min_length, max_length } = idSchema.validation;
	if (min_length !== null && userID.value.length < min_length) {
		throw new Error(`ID number length must be at least ${min_length} characters long`);
	}
	if (max_length !== null && userID.value.length > max_length) {
		throw new Error(`ID number length must be less than ${max_length} characters long`);
	}
	// Do pattern last because the length checks will throw and give an easier to read error message
	if (pattern) {
		// Plaid uses Ruby regex, so we need to convert it to Javascript regex
		const jsPattern = convertRubyRegexToJavascriptRegex(pattern);
		const regex = new RegExp(jsPattern);
		if (!regex.test(userID.value)) {
			throw new Error(`ID number does not match pattern: ${jsPattern}`);
		}
	}
}

function convertRubyRegexToJavascriptRegex(rubyRegex: string): string {
	return rubyRegex.replace(/\\A/, "^").replace(/\\z/, "$");
}
class IDVValidationError extends Error {
	context: IdentityVerificationCreateRequest | IdentityVerificationRetryRequest;
	schema: PlaidInputValidation | undefined;
	constructor(message: string, context: IdentityVerificationCreateRequest | IdentityVerificationRetryRequest, schema?: PlaidInputValidation) {
		super(message);
		this.name = "IDVValidationError";
		this.context = context;
		this.schema = schema;
	}
}

type InputType = "address.postal_code" | "address.subdivision" | "id_number";
// Type that captures the values of IDNumberType
type IDNumberTypeValue = IDNumberType[keyof IDNumberType];
interface IDNumberSchema {
	name: string;
	type: IDNumberTypeValue;
	category: string;
	validation: {
		pattern: string;
		min_length: number;
		max_length: number;
		type: "numeric" | "alphanumeric" | "pattern";
	};
	example: string;
}

export interface PlaidInputValidation {
	country: { code: string; name: string };
	input_validation: Record<InputType, "required" | "not_supported" | "optional">;
	id_numbers: Array<IDNumberSchema>;
}
