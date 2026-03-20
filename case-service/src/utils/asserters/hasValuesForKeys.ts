export const hasValuesForKeys = <T extends Record<string, unknown>>(
	obj: Partial<T>,
	...keys: (keyof T)[]
): obj is T => {
	if (obj === null || typeof obj !== "object") return false;
	return keys.every(key => (obj as T)[key]);
};
