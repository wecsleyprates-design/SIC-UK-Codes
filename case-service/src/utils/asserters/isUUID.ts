import type { UUID } from "crypto";

/**
 * Typeguard to check if a value is a valid UUID
 * @param value 
 * @returns 
 */
export function isUUID(value: unknown): value is UUID { 
	return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}