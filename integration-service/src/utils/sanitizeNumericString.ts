import { isNumericString } from "./typeguards/isNumericString";

/**
 * Sanitize a numeric string or a number to a number
 * @param value - The value to sanitize
 * @returns The sanitized number or null if the value is not a numeric string or number
 */
export const sanitizeNumericString = (value: string | number): number | null => {
	if (typeof value === "number") {
		return value;
	}
	if (typeof value === "string" && isNumericString(value)) {
		return Number(value);
	}
	return null;
};
