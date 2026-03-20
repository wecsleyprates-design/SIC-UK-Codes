import dayjs from "dayjs";
import { decryptData, decryptEin, isEncrypted, maskString, safeDecrypt } from "./encryption";

/**
 * Recursively redact SSN-like fields in an arbitrary value (object/array tree).
 *
 * - Masks keys named `ssn`, keys ending in `_ssn`, and `owner{n}_ssn`, & `tin` by masking all but last 4 characters
 * - Masks `date_of_birth` and `owner{n}_dob` by masking all but year
 * - Preserves `last_four_of_ssn`
 * - Mutates the input object/array in place (safe for freshly-built response objects)
 *
 * @param value - The value to redact
 * @param fieldNamesToRemove - Field names to remove from the value
 * @returns The redacted value
 */
export const redactFields = (
	value: any,
	fieldNamesToRemove: string[] = ["is_deleted", "deleted_at", "deleted_by", "integration_data"]
): any => {
	if (Array.isArray(value)) return value.map(item => redactFields(item, fieldNamesToRemove));
	if (!value || typeof value !== "object") return value;

	for (const key of Object.keys(value)) {
		if (value[key] == null) continue;
		// Last four of SSN is always plain text
		if (key === "last_four_of_ssn") continue;
		if (key === "date_of_birth" || /owner\d+_dob$/iu.test(key)) {
			value[key] = maskDate(String(value[key]));
			continue;
		}
		if (key === "tin" || key === "ssn" || /_ssn$/iu.test(key) || /^owner\d+_ssn$/iu.test(key)) {
			value[key] = maskSsn(String(value[key]));
			continue;
		}
		if (fieldNamesToRemove.includes(key)) {
			delete value[key];
			continue;
		}
		value[key] = redactFields(value[key], fieldNamesToRemove);
	}

	return value;
};

/**
 * Attempt to decrypt the value using all encryption methods known to us
 * @param value - The value to decrypt
 * @param methods - The encryption methods to try
 * @returns The decrypted value
 */
const decrypt = (
	value: string,
	methods: ((value: string, log?: boolean) => string)[] = [decryptEin, decryptData]
): string => {
	for (const method of methods) {
		if (isEncrypted(value, method)) {
			value = safeDecrypt(String(value), method);
			break;
		}
	}
	return value;
};

const maskSsn = (value: string): string => {
	value = decrypt(value);
	if (value == null || value.length < 8) {
		return value;
	}
	return maskString(value);
};

const maskDate = (value: string): string => {
	try {
		value = decrypt(value);
		if (value == null || value.length < 8) {
			return value;
		}
		// Extract Year and make day and month XX
		const year = dayjs(value).year();
		return `${year}-XX-XX`;
	} catch (_error: unknown) {
		return value;
	}
};
