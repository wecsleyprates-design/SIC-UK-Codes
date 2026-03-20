import { isObjectLike } from "./isObjectLike";

function isDate(value: unknown): value is Date {
	return value != null && typeof value === "object" && value instanceof Date;
}

export function isDeepEqual(a: unknown, b: unknown): boolean {
	if (a === b) return true;
	if (isDate(a) && isDate(b)) return a.getTime() === b.getTime();
	if (Array.isArray(a) && Array.isArray(b)) {
		return a.length === b.length && a.every((item, idx) => isDeepEqual(item, b[idx]));
	}
	if (isObjectLike(a) && isObjectLike(b) && !Array.isArray(a) && !Array.isArray(b)) {
		const aKeys = Object.keys(a as Record<string, any>);
		const bKeys = Object.keys(b as Record<string, any>);
		if (aKeys.length !== bKeys.length) return false;
		return aKeys.every(key => isDeepEqual((a as Record<string, any>)[key], (b as Record<string, any>)[key]));
	}
	return false;
}
