const postalCodeRegex = /[A-Za-z]\d[A-Za-z]\s?\d[A-Za-z]\d/;
const canadaRegex = /\b(CANADA)\b|,\s*(CAN)\b|\b(CAN)\s*$/i;

export const canadianProvinces = [
	"Alberta",
	"AB",
	"British Columbia",
	"BC",
	"Manitoba",
	"MB",
	"New Brunswick",
	"NB",
	"Newfoundland and Labrador",
	"NL",
	"Northwest Territories",
	"NT",
	"Nova Scotia",
	"NS",
	"Nunavut",
	"NU",
	"Ontario",
	"ON",
	"Prince Edward Island",
	"PE",
	"PEI",
	"Quebec",
	"QC",
	"Saskatchewan",
	"SK",
	"Yukon",
	"YT"
];

/**
 * Maps full province/territory names (and aliases like "PEI") to their
 * standard 2-letter abbreviation. Used to guarantee that getCanadianProvince
 * always returns an abbreviation regardless of the input format.
 */
const provinceToAbbreviation: Record<string, string> = {
	ALBERTA: "AB",
	"BRITISH COLUMBIA": "BC",
	MANITOBA: "MB",
	"NEW BRUNSWICK": "NB",
	"NEWFOUNDLAND AND LABRADOR": "NL",
	"NORTHWEST TERRITORIES": "NT",
	"NOVA SCOTIA": "NS",
	NUNAVUT: "NU",
	ONTARIO: "ON",
	"PRINCE EDWARD ISLAND": "PE",
	PEI: "PE",
	QUEBEC: "QC",
	SASKATCHEWAN: "SK",
	YUKON: "YT"
};

/**
 * Finds a Canadian province/territory in the address and always returns the
 * 2-letter abbreviation (e.g. "Alberta" → "AB", "ON" → "ON").
 *
 * This ensures normalizeString produces consistent output regardless of
 * whether the data source uses the full name or the abbreviation.
 */
export function getCanadianProvince(address: string): string | null {
	const normalizedAddress = address.toUpperCase();
	const matchedProvince = canadianProvinces.find(province => normalizedAddress.includes(province.toUpperCase()));

	if (!matchedProvince) return null;

	// Always return the 2-letter abbreviation
	const upper = matchedProvince.toUpperCase();
	return provinceToAbbreviation[upper] ?? upper;
}

export function isCanadianAddress(address: string): boolean {
	// Check if the address has a Canadian postal code format
	const hasCanadianPostalCode = postalCodeRegex.test(address);

	// Check if the address contains a Canadian province
	const province = getCanadianProvince(address);

	// Check if the address contains the word "Canada" or "CAN"
	const hasCanada = canadaRegex.test(address);

	// An address is likely Canadian if it has a Canadian postal code
	// or if it mentions both a Canadian province and Canada
	return hasCanadianPostalCode || (province !== null && hasCanada);
}
export function extractCanadianAddressComponents(address: string): { province: string; postalCode: string; country: string } {
	const postalCodeMatch = address.match(postalCodeRegex);

	const countryMatch = address.match(canadaRegex);

	const province = getCanadianProvince(address);

	const rawPostalCode = postalCodeMatch ? postalCodeMatch[0] : "";
	const postalCode = rawPostalCode.replace(/\s/g, "").toUpperCase();

	return {
		province: province || "",
		postalCode,
		country: countryMatch ? countryMatch[0] : ""
	};
}

// Map for Canadian jurisdiction codes to province abbreviations
export const canadianJurisdictionMap: Record<string, string> = {
	ca_ab: "AB", // Alberta
	ca_bc: "BC", // British Columbia
	ca_mb: "MB", // Manitoba
	ca_nb: "NB", // New Brunswick
	ca_nl: "NL", // Newfoundland
	ca_nt: "NT", // Northwest Territories
	ca_ns: "NS", // Nova Scotia
	ca_nu: "NU", // Nunavut
	ca_on: "ON", // Ontario
	ca_pe: "PE", // Prince Edward Island
	ca_qc: "QC", // Quebec
	ca_sk: "SK", // Saskatchewan
	ca_yt: "YT" // Yukon
};

export function getProvinceFromJurisdictionCode(jurisdictionCode: string): string | null {
	return canadianJurisdictionMap[jurisdictionCode.toLowerCase()] || null;
}
