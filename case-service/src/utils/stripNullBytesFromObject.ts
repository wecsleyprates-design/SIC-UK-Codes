/**
 * Recursively strips null bytes (\x00) from all string values in an object.
 * Joi's .trim() does not remove null bytes; they cause PostgreSQL
 * "invalid byte sequence for encoding UTF8: 0x00" errors.
 * Use this on request body/params/query before validation so schema accepts clean data.
 */
const NULL_BYTE = /\x00/g;

function stripNullBytesFromValue(value: unknown): unknown {
	if (typeof value === "string") {
		return value.replace(NULL_BYTE, "");
	}
	if (Array.isArray(value)) {
		return value.map(stripNullBytesFromValue);
	}
	if (value !== null && typeof value === "object") {
		const out: Record<string, unknown> = {};
		for (const [k, v] of Object.entries(value)) {
			out[k] = stripNullBytesFromValue(v);
		}
		return out;
	}
	return value;
}

export function stripNullBytesFromObject<T>(obj: T): T {
	return stripNullBytesFromValue(obj) as T;
}
