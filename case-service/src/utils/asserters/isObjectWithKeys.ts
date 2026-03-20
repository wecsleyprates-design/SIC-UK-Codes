export enum IS_OBJECT_WITH_KEYS_STRATEGY {
	EVERY = 0,
	SOME = 1
}

export const isObjectWithKeys = <T extends Record<string, unknown>>(
	obj: unknown,
	strategyOrKey: IS_OBJECT_WITH_KEYS_STRATEGY | keyof T,
	...keys: (keyof T)[]
): obj is T => {
	let strategy: IS_OBJECT_WITH_KEYS_STRATEGY = IS_OBJECT_WITH_KEYS_STRATEGY.EVERY;
	let allKeys = keys;

	if (typeof strategyOrKey === "number") {
		strategy = strategyOrKey;
	} else {
		allKeys = [strategyOrKey, ...keys];
	}

	if (obj === null || typeof obj !== "object") return false;

	return strategy === IS_OBJECT_WITH_KEYS_STRATEGY.SOME
		? allKeys.some(key => key in obj)
		: allKeys.every(key => key in obj);
};
