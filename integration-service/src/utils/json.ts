import { logger } from "#helpers/index";

export const safeJsonParse = (value: string, def = {}): object => {
	try {
		return JSON.parse(value);
	} catch (e: unknown) {
		logger.error({ error: e }, "Failed to parse JSON");
		return def;
	}
};
