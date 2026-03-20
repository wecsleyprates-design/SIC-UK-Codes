export const isObjectWithKeys = <T extends Record<string, unknown>>(obj: unknown, ...keys: string[]): obj is T => {
	return obj !== null && typeof obj === "object" && keys.every(key => key in obj);
};
