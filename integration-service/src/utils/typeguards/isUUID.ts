import type { UUID } from "crypto";

/**
 * Typeguard to check if a value is a well-formed UUID
 */
export function isUUID(uuid: unknown): uuid is UUID {
	if (typeof uuid !== "string") {
		return false;
	}
	const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
	return uuidRegex.test(uuid);
}
