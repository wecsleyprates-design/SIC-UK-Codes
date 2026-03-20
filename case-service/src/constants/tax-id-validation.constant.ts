/**
 * Tax ID Validation Constants
 *
 * Validation rules for Tax IDs:
 * - US: 9-digit numeric TIN/SSN/EIN (country-specific rule)
 * - All other countries: 1-22 alphanumeric characters (global fallback)
 */

/**
 * Validation rule configuration for Tax IDs.
 */
export interface TaxIdValidationRule {
	regex: RegExp;
	normalize?: (v: string) => string;
	description: string;
}

/**
 * Country-specific label definitions for Tax IDs.
 */
export interface TaxIdLabelConfig {
	short: string;
	long: string;
	formLabel: string;
	sectionTitle: string;
	fieldLabel: string;
}

/**
 * Global fallback validation boundaries for non-US countries.
 * Used in error messages.
 */
export const GLOBAL_TAX_ID_FALLBACK_MIN = 1;
export const GLOBAL_TAX_ID_FALLBACK_MAX = 22;

/**
 * Global fallback regex for non-US countries: 1-22 alphanumeric characters (A-Z, 0-9).
 */
export const GLOBAL_TAX_ID_FALLBACK_REGEX = /^[A-Z0-9]{1,22}$/i;

/**
 * US-specific validation rule for Tax IDs.
 * Non-US countries use the global fallback (1-22 alphanumeric characters).
 */
export const TAX_ID_VALIDATION_RULES: Record<string, TaxIdValidationRule> = {
	US: {
		regex: /^\d{9}$/,
		normalize: (v: string) => v.replace(/\D/g, ""),
		description: "9-digit numeric TIN/SSN/EIN"
	},
	GB: {
		// Accepts UTR (10 digits), NINO (2 letters + 6 digits + optional suffix A-D),
		// CRN (7-8 digits OR 1-2 letters + 5-7 digits), VAT (optional GB prefix + 9-12 digits)
		regex: /^(?:\d{10}|[A-CEGHJ-PR-TW-Z]{2}\d{6}[A-D]?|(?:\d{7,8}|[A-Z]{1,2}\d{5,7})|(?:GB)?\d{9,12})$/i,
		normalize: (v: string) => v.replace(/\s+/g, "").toUpperCase(),
		description:
			"UK business identifiers: UTR (10 digits), NINO (2 letters + 6 digits + optional suffix), CRN (7-8 alphanumeric), VAT (9-12 digits, optional GB prefix)"
	}
};

/**
 * US-specific label definitions for Tax IDs.
 * Non-US countries use DEFAULT_TAX_ID_LABELS.
 */
export const TAX_ID_LABELS: Record<string, TaxIdLabelConfig> = {
	US: {
		short: "TIN",
		long: "Tax ID Number (EIN)",
		formLabel: "TIN/SSN/EIN",
		sectionTitle: "Tax ID Verification",
		fieldLabel: "Tax ID"
	},
	GB: {
		short: "CRN",
		long: "Company Registration Number (CRN)",
		formLabel: "Company Registration Number",
		sectionTitle: "Company Registration Verification",
		fieldLabel: "Company Registration Number"
	}
};

/**
 * Default labels used when a country does not have a defined mapping.
 */
export const DEFAULT_TAX_ID_LABELS: TaxIdLabelConfig = {
	short: "TIN",
	long: "Registration Number",
	formLabel: "Registration Number",
	sectionTitle: "Tax ID Verification",
	fieldLabel: "Tax ID"
};

/**
 * Normalizes country code to determine if US or non-US.
 *
 * @param countryCode - Raw country code input.
 * @returns "US" for US variations, otherwise the uppercase trimmed code.
 */
export const normalizeCountryCode = (countryCode: string | undefined | null): string => {
	if (!countryCode) return "US";

	const code = countryCode.trim().toUpperCase();

	switch (code) {
		case "US":
		case "USA":
		case "U.S.":
		case "U.S.A.":
		case "UNITED STATES":
			return "US";

		case "GB":
		case "GBR":
		case "UK":
		case "U.K.":
		case "UNITED KINGDOM":
			return "GB";

		default:
			return code;
	}
};
