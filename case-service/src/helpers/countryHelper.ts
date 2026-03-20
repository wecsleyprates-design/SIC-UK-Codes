import { rawCountryCode, CUSTOM_ONBOARDING_SETUP, SupportedCountryCode } from "#constants";
import { db } from "./knex";

const getNormalizedCountryMap = (): Record<string, string> => {
	const countries = rawCountryCode;
	const normalizedMap: Record<string, string> = {};

	for (const [code, names] of Object.entries(countries)) {
		if (Array.isArray(names)) {
			for (const name of names) {
				normalizedMap[name.toLowerCase()] = code;
			}
		} else {
			normalizedMap[names.toLowerCase()] = code;
		}
	}
	return normalizedMap;
};

const countryNameToCodeMap = getNormalizedCountryMap();

export const resolveCountryCode = (input?: string | null): string | null => {
	if (!input) return null;

	const upperInput = input.toUpperCase();
	if (Object.keys(rawCountryCode).includes(upperInput)) {
		return upperInput;
	}

	const lowerInput = input.toLowerCase();
	const mappedCode = countryNameToCodeMap[lowerInput];
	return mappedCode ?? null;
};

export const isUSBusiness = (country?: string): boolean => {
	const code = resolveCountryCode(country);
	return code === SupportedCountryCode.US;
};

export const isCountryAllowedWithSetupCheck = async (
	country_code?: string | null,
	customer_id?: string | null
): Promise<boolean> => {
	const resolvedCode = resolveCountryCode(country_code) ?? SupportedCountryCode.US;
	if (!customer_id) {
		return false;
	}

	if (resolvedCode === SupportedCountryCode.US) {
		return true;
	}

	const result = await db("onboarding_schema.rel_customer_setup_status as rcss")
		.leftJoin("onboarding_schema.core_onboarding_setup_types as cost", "cost.id", "rcss.setup_id")
		.select("rcss.is_enabled")
		.where("rcss.customer_id", customer_id)
		.andWhere("cost.code", CUSTOM_ONBOARDING_SETUP.INTERNATIONAL_BUSINESS_SETUP)
		.first();

	return result?.is_enabled === true;
};
