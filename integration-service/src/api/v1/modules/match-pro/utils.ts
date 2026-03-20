import { ICAInput, ICAObject } from "#lib/match/types";
import { logger } from "#helpers/logger";
import _ from "lodash";

/**
 * Parses ICA input from various formats (array, JSON string, comma-separated string)
 * @param value - The input value to parse
 * @returns Array of ICA objects
 */
const isICAObject = (item: unknown): item is { ica: unknown; isDefault?: unknown } => {
	return typeof item === "object" && item !== null && "ica" in item;
};

const tryParseJsonArray = (value: string): unknown[] | null => {
	const trimmed = value.trim();
	try {
		const parsed = JSON.parse(trimmed);
		return Array.isArray(parsed) ? parsed : null;
	} catch (err) {
		if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
			logger.warn(
				`Failed to parse ICA JSON array input. Falling back to comma-separated parsing. Input: ${trimmed.slice(0, 100)}, Error: ${err instanceof Error ? err.message : String(err)}`
			);
		}
		return null;
	}
};

const getRawItems = (value: string | Array<ICAInput> | undefined): unknown[] => {
	if (!value) {
		return [];
	}

	if (Array.isArray(value)) {
		return value;
	}

	const trimmedValue = value.trim();
	if (trimmedValue === "") {
		return [];
	}

	// Try to parse as JSON array first
	const parsed = tryParseJsonArray(trimmedValue);
	if (parsed) {
		return parsed; // Return raw JSON array items
	}

	// Parse as comma-separated string
	return trimmedValue
		.split(",")
		.map(ica => ica.trim())
		.filter(ica => ica.length > 0);
};

const normalizeToICAObject = (item: unknown, index: number): ICAObject | null => {
	if (typeof item === "string") {
		return { ica: item.trim(), isDefault: index === 0 };
	}

	if (isICAObject(item)) {
		return {
			ica: String(item.ica ?? "").trim(),
			isDefault: typeof item.isDefault === "boolean" ? item.isDefault : index === 0
		};
	}

	return null;
};

export const parseICAs = (value: string | Array<ICAInput> | undefined): Array<ICAObject> => {
	const rawItems = getRawItems(value);

	if (rawItems.length === 0) {
		return [];
	}

	// Normalize all raw items to ICAObjects, ignoring items that cannot be normalized
	const result: Array<ICAObject> = [];

	rawItems.forEach((item, index) => {
		const normalized = normalizeToICAObject(item, index);
		if (normalized && normalized.ica.length > 0) {
			result.push(normalized);
		} else if (normalized === null) {
			logger.warn(`Skipping invalid ICA item during parsing at index ${index}`);
		}
	});

	return result;
};

/**
 * Normalizes error response keys to lowercase standard
 * Handles: { Errors: { Error: [...] } } -> { errors: { error: [...] } }
 */
export const normalizeMatchErrors = (response: any): any => {
	if (!response || typeof response !== "object") return response;

	const deepClone = _.cloneDeep(response);

	// 1. Normalize "Errors" -> "errors"
	if ("Errors" in deepClone) {
		deepClone.errors = deepClone.Errors;
		delete deepClone.Errors;
	}

	// 2. Normalize "errors.Error" -> "errors.error"
	if (deepClone.errors && "Error" in deepClone.errors) {
		deepClone.errors.error = deepClone.errors.Error;
		delete deepClone.errors.Error;
	}

	return deepClone;
};
