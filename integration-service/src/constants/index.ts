export * from "./environments.constant";
export * from "./log-levels.constant";
export * from "./httpMethods.constants.js";
export * from "./roles.constant";
export * from "./error-codes.constant";
export * from "./s3-directories.constant";
export * from "./email-templates.constant";
export * from "./disposable-domains.constant";
export * from "./integrations.constant";
export * from "./status.integration.constant";
export * from "./tin-checks.constant";
export * from "./value-not-available.constant";
export * from "./kafka.constant";
export * from "./tax-status.constant";
export * from "./bull-queue.constants";
export * from "./displayed-columns-map.constant";
export * from "./risk-alerts.constants";
export * from "./feature-flags.constants";
export * from "./webhooks.constants";
export * from "./businessFields.constant";
export * from "./custom-onboarding-setup.constant";
export * from "./customer-integration-settings.constants";
export * from "./customer-stage-fields.constant";

export function getEnumKeyByValue<T extends Record<PropertyKey, string | number>>(
	enumObj: T,
	value: number | string
): string | undefined {
	return (Object.keys(enumObj) as Array<string>).find(key => enumObj[key] === value);
}

/**
 * Given an enum-ish object and a key, return the value.
 *
 * Supports:
 * - `as const` enum objects (`{ SUCCESS: 1 } as const`)
 * - TS numeric enums (guards against reverse-mapping numeric keys like `"1" -> "SUCCESS"`)
 */
export function getEnumValueByKey<T extends Record<PropertyKey, string | number>>(
	enumObj: T,
	key: string
): T[keyof T] | undefined {
	const k = String(key);
	if (!Object.hasOwn(enumObj, k)) return undefined;

	const value = (enumObj as any)[k] as unknown;

	// Numeric TS enums have reverse mappings: enumObj["1"] -> "SOME_KEY"
	if (/^\d+$/.test(k) && typeof value === "string") return undefined;

	return value as T[keyof T];
}

/* Given an enum-like object and a value, return the VALUE when the passed in value is either a key or a value */
export function enumToValue<T extends string | number = string | number>(
	enumObj: Record<PropertyKey, T>,
	keyOrValue: PropertyKey
): T | undefined {
	//Extrapolate typeof by first key & first value
	const typeOfValue = typeof Object.values(enumObj)[0];

	if (keyOrValue == null || keyOrValue == undefined) return undefined;

	if (typeof keyOrValue === typeOfValue) return keyOrValue as T;
	if (!["number", "string"].includes(typeOfValue)) {
		return undefined;
	}
	return getEnumValueByKey<Record<PropertyKey, T>>(enumObj, String(keyOrValue));
}
