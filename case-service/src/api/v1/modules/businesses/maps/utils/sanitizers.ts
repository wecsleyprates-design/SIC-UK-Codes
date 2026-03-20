import currency from "currency.js";

import { AddressUtil, parsePhoneNumber as baseParsePhoneNumber } from "#utils";
import { MapperError } from "../../mapper";

export const sanitizePhoneNumber = (value: string) => {
	// Already starts with a "+"? Assume it's already well formatted.
	if (value && value?.toString()?.startsWith("+")) {
		return value.replace(/[^0-9]/g, "").replace(/^/, "+");
	}

	const parsed = baseParsePhoneNumber(value);
	if (!parsed) {
		throw new MapperError(`Invalid phone number: ${value}`);
	}
	const constructedNumber = `${parsed.getCountryCodeOrDefault()}${parsed.getNationalNumberOrDefault()}`;
	return constructedNumber;
};

export const sanitizePositiveInteger = async (mapper, value: any): Promise<null | number> => {
	const parsed = parseInt(value);
	if (isNaN(parsed) || parsed < 0) {
		return null;
	}
	return parsed;
};
export const sanitizePositiveFloat = async (mapper, value: any): Promise<null | number> => {
	const parsed = parseFloat(value);
	if (isNaN(parsed) || parsed < 0) {
		return null;
	}
	return parsed;
};
export const sanitizeCurrency = async (mapper, value: any): Promise<null | number> => {
	return Promise.resolve(currency(value).value);
};

export const sanitizeNpi = async (mapper, value: any): Promise<null | string> => {
	if (typeof value === "string") {
		return value.replace(/\D/g, "");
	}
	return null;
};

/**
 * Sanitizes a postal code based on the country format.
 * Delegates to AddressUtil.sanitizePostalCode (single source of truth) so mapper fields
 * and Logan's createPostalCodeSanitizer share the same rules (US/PR: 5-digit; AU/NZ: 4-digit; CA/UK: alphanumeric).
 */
export const sanitizePostalCode = (postalCode: string, country?: string): string =>
	AddressUtil.sanitizePostalCode(country, postalCode.toString());

export const parseBool = (str, valueIfEmpty = false) => {
	if (typeof str === "string" && str.length) {
		return str.toLowerCase() === "true" || str.toLowerCase() === "yes";
	} else if (typeof str === "boolean") {
		return str;
	}
	return valueIfEmpty;
};
