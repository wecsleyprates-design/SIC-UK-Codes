/*
Checks if the value is an object or an array.
*/
export const isObjectLike = (value: unknown): value is Record<string, any> | unknown[] =>
	typeof value === "object" && value !== null;
