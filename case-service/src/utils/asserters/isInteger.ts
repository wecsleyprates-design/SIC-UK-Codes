/**
 * Typeguard to check if a value is an number -- but also an integer
 * @param value 
 * @returns 
 */
export function isInteger(value: unknown): value is number {
	return typeof value === "number" || (typeof value === "string" && !isNaN(Number(value)) && Number.isInteger(Number(value)));
}