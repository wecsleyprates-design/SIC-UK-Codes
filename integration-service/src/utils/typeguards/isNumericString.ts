export const isNumericString = (value: unknown): value is `${number}` | `${number}.${number}` => {
	if (typeof value !== "string" || value === null || value === undefined) return false;
	if (value.trim() === "") return false;

	const regex = /^-?\d+(\.\d+)?$/;
	return regex.test(value);
};
