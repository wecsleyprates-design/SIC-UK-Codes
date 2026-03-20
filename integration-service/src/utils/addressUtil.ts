import type { BusinessAddress } from "#helpers/api";
import { distance } from "fastest-levenshtein";
import parseAddress from "parse-address";
import { extractCanadianAddressComponents, getCanadianProvince, isCanadianAddress } from "./canadianProvinces";
import { logger } from "#helpers/logger";
import { trimAndTitleCase } from "./stringFormat";
import { plaidInputValidationSchema } from "#lib/plaid/plaidInputValidationSchema";

// The cases service returns an address with an "apartment" field which isn't very descriptive name for a business address
type CaseAddressObject = Pick<BusinessAddress, "line_1" | "apartment" | "city" | "state" | "postal_code"> &
	Partial<Pick<BusinessAddress, "country">>;
/*
A normalized address object
Takes an address or intersection specifier, and normalizes its components, 
stripping out all leading and trailing whitespace and punctuation, and substituting official abbreviations 
for prefix, suffix, type, and state values.
 Also, city names that are prefixed with a directional abbreviation (e.g. N, NE, etc.) have the abbreviation expanded.
 */
export type NormalizedAddress = {
	line_1: string | null;
	line_2: string | null;
	line_3: string | null;
	city: string | null;
	state: string | null;
	postal_code: string | null;
	country?: string | null;
	formatted_address?: string | null;
};

export const States: { [key: string]: string }[] = [
	{ AL: "ALABAMA" },
	{ AK: "ALASKA" },
	{ AZ: "ARIZONA" },
	{ AR: "ARKANSAS" },
	{ CA: "CALIFORNIA" },
	{ CA: "CALI" },
	{ CO: "COLORADO" },
	{ CT: "CONNECTICUT" },
	{ CT: "CONN" },
	{ DC: "DISTRICT OF COLUMBIA" },
	{ DC: "WASHINGTON DC" },
	{ DE: "DELAWARE" },
	{ FL: "FLORIDA" },
	{ GA: "GEORGIA" },
	{ HI: "HAWAII" },
	{ ID: "IDAHO" },
	{ IL: "ILLINOIS" },
	{ IN: "INDIANA" },
	{ IA: "IOWA" },
	{ KS: "KANSAS" },
	{ KY: "KENTUCKY" },
	{ LA: "LOUISIANA" },
	{ ME: "MAINE" },
	{ MD: "MARYLAND" },
	{ MA: "MASSACHUSETTS" },
	{ MA: "MASS" },
	{ MI: "MICHIGAN" },
	{ MN: "MINNESOTA" },
	{ MS: "MISSISSIPPI" },
	{ MO: "MISSOURI" },
	{ MT: "MONTANA" },
	{ NE: "NEBRASKA" },
	{ NV: "NEVADA" },
	{ NH: "NEW HAMPSHIRE" },
	{ NJ: "NEW JERSEY" },
	{ NJ: "JERSEY" },
	{ NM: "NEW MEXICO" },
	{ NY: "NEW YORK" },
	{ NC: "NORTH CAROLINA" },
	{ ND: "NORTH DAKOTA" },
	{ OH: "OHIO" },
	{ OK: "OKLAHOMA" },
	{ OR: "OREGON" },
	{ PA: "PENNSYLVANIA" },
	{ PA: "PENN" },
	{ RI: "RHODE ISLAND" },
	{ SC: "SOUTH CAROLINA" },
	{ SD: "SOUTH DAKOTA" },
	{ TN: "TENNESSEE" },
	{ TX: "TEXAS" },
	{ UT: "UTAH" },
	{ VT: "VERMONT" },
	{ VA: "VIRGINIA" },
	{ WA: "WASHINGTON" },
	{ WV: "WEST VIRGINIA" },
	{ WV: "W VIRGINIA" },
	{ WI: "WISCONSIN" },
	{ WY: "WYOMING" },
	// Territories
	{ AS: "AMERICAN SAMOA" },
	{ AS: "SAMOA" },
	{ GU: "GUAM" },
	{ MP: "NORTHERN MARIANA ISLANDS" },
	{ MP: "NORTHERN MARIANA" },
	{ MP: "MARIANA" },
	{ PR: "PUERTO RICO" },
	{ VI: "VIRGIN ISLANDS" },
	{ VI: "US VIRGIN ISLANDS" }
];
export const usStateCodes: string[] = States.map(state => Object.keys(state)[0]);
export class AddressUtil {
	private static readonly DEFAULT_COUNTRY = "US";
	private static regexAddressParse(address: string): NormalizedAddress {
		/**
		 * Fallback regex for parsing addresses.
		 * Structure:
		 *   - street: Everything up to the first comma (e.g. "123 Main St")
		 *   - unit: Optional, matches unit/suite/floor/apt info (e.g. "Suite 200", "Apt 3B")
		 *   - city: Everything up to the next comma (can include additional comma-separated cities, e.g. "Manhattan, New York")
		 *   - state: Two uppercase letters (e.g. "NY")
		 *   - zip: Optional, 5 digits with optional 4-digit extension (e.g. "10001" or "10001-1234")
		 *   - country: Optional, matches country name at the end (e.g. "USA", "Canada")
		 */
		const fallbackPattern = new RegExp(
			"^" +
				"(?<street>[^,]+),\\s*" +
				"(?:(?<unit>[^,]*(?:floor|suite|ste|fl|unit|apt)[^,]*),\\s*)?" +
				"(?<city>[^,]+(?:,\\s*[^,]+)*),\\s*" +
				"(?<state>[A-Z]{2})" +
				"(?:[ ,]\\s*(?<zip>\\d{5}(?:-\\d{4})?))?" +
				"(?:,\\s*(?<country>[A-Za-z ]+))?" +
				"$",
			"i"
		);

		const match = address.match(fallbackPattern);

		logger.info({
			message: "Fallback address parsing triggered",
			originalAddress: address
		});

		if (match?.groups) {
			const { street, unit, city, state, zip, country } = match.groups;

			const result: NormalizedAddress = {
				line_1: trimAndTitleCase(street),
				line_2: trimAndTitleCase(unit),
				city: trimAndTitleCase(city),
				state: state?.trim().toUpperCase() || null,
				postal_code: zip?.trim() || null,
				country: trimAndTitleCase(country),
				line_3: null,
				formatted_address: null
			};

			result.line_3 = [result.city, result.state, result.postal_code].filter(Boolean).join(", ");

			result.formatted_address = [result.line_1, result.line_2, result.line_3].filter(Boolean).join(", ");

			return result;
		}

		// If regex didn't match:
		// 1. return minimal object to avoid crashes
		// 2. log the address and the reason it failed to parse for debugging
		logger.info({
			message: "Fallback address parsing failed",
			originalAddress: address
		});
		return {
			line_1: null,
			line_2: null,
			city: null,
			state: null,
			postal_code: null,
			country: null,
			line_3: null,
			formatted_address: address
		} as NormalizedAddress;
	}

	public static normalizeAddress(addr: BusinessAddress | NormalizedAddress): NormalizedAddress {
		// Note: Currently, this only normalizes country and postal code while returning a copy of the address.
		// Additional normalization of components (e.g. "Apartment 1" -> "apt 1") may be added in the future if needed.
		const normalized = Object.entries(addr).reduce((acc, [key, value]) => {
			if (typeof value === "string") {
				acc[key] = trimAndTitleCase(value as string);
			}
			return acc;
		}, {} as Partial<NormalizedAddress>);
		normalized.country = this.normalizeCountry(addr);
		normalized.postal_code = this.normalizePostalCode(addr);
		normalized.line_3 = [normalized.city, normalized.state, normalized.postal_code].filter(Boolean).join(", ");
		normalized.formatted_address = [normalized.line_1, normalized.line_2, normalized.line_3].filter(Boolean).join(", ");
		return normalized as NormalizedAddress;
	}
	private static normalizeCountry(address: BusinessAddress | NormalizedAddress): NormalizedAddress["country"] {
		return address.country ?? this.DEFAULT_COUNTRY;
	}

	private static normalizePostalCode(address: BusinessAddress | NormalizedAddress): NormalizedAddress["postal_code"] {
		// For US, we want to normalize the postal code to 5 digits when set
		if (address.postal_code && address.country) {
			if (["US", "USA"].includes(address.country)) {
				return (
					address.postal_code
						?.replace(/[^0-9]/g, "")
						.padStart(5, "0")
						.substring(0, 5) ?? undefined
				);
			}
		}
		return address.postal_code;
	}
	public static toFingerprint(
		addr: BusinessAddress | NormalizedAddress,
		fields: (keyof BusinessAddress | keyof NormalizedAddress)[] = [
			"line_1",
			"apartment",
			"city",
			"state",
			"postal_code"
		]
	): string {
		const normalized = this.normalizeAddress(addr);
		return fields
			.map(field => normalized[field] ?? "")
			.join("::")
			.toLowerCase();
	}

	/* Parse an address string into a normalized address object */
	public static stringToParts(address: string): NormalizedAddress {
		// Run a poor man's Canadian address check
		// TODO: remove this once the AI matching is implemented
		const isCanadian = isCanadianAddress(address);
		const parts = parseAddress.parseLocation(address); // This may fail on complex/edge case addresses, returning null

		if (!parts) {
			return this.regexAddressParse(address);
		}

		const addressObject = {
			line_1: `${parts?.number ? parts?.number + " " : ""}${parts?.prefix ? parts?.prefix + " " : ""}${parts?.street} ${parts?.type}${parts?.suffix ? " " + parts?.suffix : ""}`,
			line_2: parts.sec_unit_type && parts.sec_unit_num ? `${parts.sec_unit_type} ${parts.sec_unit_num}` : null,
			city: parts.city || null,
			state: parts.state || null,
			postal_code: parts.zip || null,
			country: parts.country || null
		} as NormalizedAddress;

		// Normalize some components
		// Init caps everything except for State which is all caps
		addressObject.line_1 = trimAndTitleCase(addressObject.line_1);
		addressObject.line_2 = trimAndTitleCase(addressObject.line_2);
		addressObject.city = trimAndTitleCase(addressObject.city);
		addressObject.state = parts.state?.toUpperCase().replace(/undefined/gi, "") || null;
		addressObject.country = trimAndTitleCase(parts.country);
		addressObject.line_3 =
			`${addressObject.city || ""}, ${addressObject.state || ""}, ${addressObject.postal_code || ""}`.replace(
				/undefined/gi,
				""
			);
		addressObject.formatted_address =
			`${addressObject.line_1 || ""}, ${addressObject.line_2 ? addressObject.line_2 + ", " : ""}${addressObject.line_3 || ""}`.replace(
				/undefined/gi,
				""
			);

		// this might not parse correctly for Canadian addresses
		if (isCanadian) {
			const { province, postalCode, country } = extractCanadianAddressComponents(address);
			addressObject.state = province;
			addressObject.postal_code = postalCode;
			addressObject.country = country;
		}

		return addressObject;
	}

	private static isCaseAddressObject(addr: NormalizedAddress | CaseAddressObject): addr is CaseAddressObject {
		return "apartment" in addr;
	}

	/* Convert an address object to a string */
	public static partsToString(address: NormalizedAddress | CaseAddressObject, withApartment: boolean = true): string {
		const { line_1, city, state, postal_code } = address;
		// handle either having line_2 or apartment
		const line_2 = this.isCaseAddressObject(address) ? (address.apartment ?? null) : (address.line_2 ?? null);
		const parts: string[] = [line_1, line_2, city, state, postal_code].reduce((acc, key) => {
			if (key) {
				acc.push(key);
			}
			return acc;
		}, [] as string[]);
		return parts.join(", ");
	}

	/* Convert a CaseAddressObject to a NormalizedAddress */
	public static normalizeCaseAddress(address: CaseAddressObject): NormalizedAddress {
		const normalized = this.partsToString(address, true);
		return this.stringToParts(normalized);
	}

	/* Normalize an address string into a normalized address object */
	public static normalizeString(address: string): string {
		return this.partsToString(this.stringToParts(address), true);
	}

	/**
	 * Regex to match common secondary unit designators (case-insensitive).
	 * These terms are semantically equivalent for address comparison purposes:
	 * Suite, Ste, Unit, Apt, Apartment, No, Num, Fl, Floor, Rm, Room, etc.
	 *
	 * Different data sources (e.g., Trulioo vs Google) may report the same
	 * physical address using different designators (e.g., "Suite 201" vs "Unit 201").
	 * Normalizing them to a common form allows correct matching.
	 */
	private static readonly UNIT_DESIGNATOR_REGEX =
		/\b(suite|ste|unit|apt|apartment|no|num|number|fl|floor|rm|room|dept|department|bldg|building)\b\.?\s*/gi;

	/**
	 * Normalizes an address string for comparison by:
	 * 1. Applying the standard address normalization (parses and re-formats)
	 * 2. Replacing all secondary unit designators with a common token ("Unit ")
	 * 3. Lowercasing for case-insensitive comparison
	 *
	 * This ensures addresses like "171 E Liberty St, Suite 201, NT, M6K 3P6"
	 * and "171 E Liberty St, Unit 201, NT, M6K 3P6" are treated as equivalent.
	 */
	public static normalizeForComparison(address: string): string {
		return this.normalizeString(address)
			.replace(AddressUtil.UNIT_DESIGNATOR_REGEX, "Unit ")
			.replace(/\s+/g, " ")
			.trim()
			.toLowerCase();
	}

	/**
	 * Regex to strip the entire secondary unit segment (designator + number)
	 * from a normalized address. Used for fallback "base address" comparison
	 * when one source omits the unit entirely.
	 *
	 * Matches patterns like ", Unit 201" or ", Ste 3B" and removes them,
	 * leaving only the street, city, state, and postal code.
	 *
	 * Uses \w+ (not \S+) to avoid consuming trailing commas that separate
	 * the unit from subsequent address components.
	 */
	private static readonly UNIT_SEGMENT_REGEX =
		/,?\s*\b(suite|ste|unit|apt|apartment|no|num|number|fl|floor|rm|room|dept|department|bldg|building)\b\.?\s*\w+/gi;

	/**
	 * Normalizes an address to its "base" form by completely stripping the
	 * secondary unit segment (designator + number). This allows matching an
	 * address without a unit number against one that has a unit number, when
	 * the street, city, state, and postal code are the same.
	 *
	 * Example: both "171 E Liberty St, Unit 201, NT, M6K 3P6" and
	 * "171 E Liberty St, NT, M6K 3P6" normalize to "171 e liberty st, nt, m6k 3p6".
	 */
	public static normalizeToBaseAddress(address: string): string {
		return this.normalizeString(address)
			.replace(AddressUtil.UNIT_SEGMENT_REGEX, "")
			.replace(/\s+/g, " ")
			.replace(/,\s*,/g, ",")
			.trim()
			.toLowerCase();
	}

	/* Calculate the levenshtein distance between two addresses */
	public static levenshteinDistance(addr1: NormalizedAddress, addr2: NormalizedAddress);
	public static levenshteinDistance(addr1: string, addr2: string);
	public static levenshteinDistance(addr1: string | NormalizedAddress, addr2: string | NormalizedAddress): number {
		const normalized1 =
			typeof addr1 === "string"
				? this.normalizeString(addr1)
				: this.partsToString(this.normalizeCaseAddress(addr1 as any));
		const normalized2 =
			typeof addr2 === "string"
				? this.normalizeString(addr2)
				: this.partsToString(this.normalizeCaseAddress(addr2 as any));
		return distance(normalized1.toLowerCase(), normalized2.toLowerCase());
	}

	public static isUSAddress(address: string): boolean {
		// Check if the address ends with a US postal code OR ends with `{postalCode}, {country}` or if `{postalCode} {country}` (comma optional)
		// Example formats: "12345" or "12345-1234, US" or "12345, USA" or "12345 US" or "12345 USA"
		// Match 5 digit ZIP code with optional 4 digit suffix (e.g., 12345 or 12345-6789)
		const postalCodeEndRegex = /\d{5}(-\d{4})?$/;
		const endsWithPostalCode = postalCodeEndRegex.test(address);
		// Match 5 digit ZIP code with optional 4 digit suffix followed by US/USA (e.g., 12345 US or 12345-6789, USA)
		const postalCodeCountryEndRegex = /\d{5}(-\d{4})?,?\s*(US|USA|UNITED STATES|UNITED STATES OF AMERICA)$/i;
		const endsWithPostalCodeAndCountry = postalCodeCountryEndRegex.test(address.toUpperCase());

		const hasUSPostalCode = endsWithPostalCode || endsWithPostalCodeAndCountry;

		// Check for a US State code
		// Look for `, {StateCode}, {PostalCode}`
		const stateCodesPattern = usStateCodes.join("|");
		const usStateCodeRegex = new RegExp(`,\\s*(${stateCodesPattern}),?\\s*\\d{5}`, "i");
		const hasUSStateCode = usStateCodeRegex.test(address.toUpperCase());

		// Does the address end with "us" or "usa"?
		const hasUSA = address.toLowerCase().endsWith(" us") || address.toLowerCase().endsWith(" usa");
		return hasUSPostalCode && (hasUSStateCode || hasUSA);
	}

	public static isUkAddress(address: string): boolean {
		if (!address) return false;

		const lower = address.toLowerCase();

		// 1. Country/region references
		const countryIndicators = [
			"united kingdom",
			"uk",
			"great britain",
			"britain",
			"england",
			"wales",
			"scotland",
			"northern ireland",
			"gb"
		];
		const mentionsUK = countryIndicators.some(term => lower.includes(term));

		// 2. UK postcode pattern: e.g., "G1 1DT", "SW1A 1AA", "EC1A 1BB"
		const ukPostcodePattern = /\b([A-Z]{1,2}\d{1,2}[A-Z]?) ?\d[A-Z]{2}\b/i;
		const hasUKPostcode = ukPostcodePattern.test(address);

		// Return true if either a UK keyword is present or a valid postcode is found
		return mentionsUK || hasUKPostcode;
	}

	/**
	 * Converts country codes to full country names
	 * Uses Plaid's comprehensive country mapping as the primary source
	 * Falls back to common variations for better coverage
	 *
	 * @param countryCode - The country code (e.g., "US", "CA", "UK")
	 * @returns The full country name (e.g., "United States", "Canada", "United Kingdom")
	 */
	public static getCountryFullName = (countryCode: string): string => {
		const normalizedCode = countryCode.toUpperCase();

		// Find the country in the Plaid schema
		const countryData = plaidInputValidationSchema.find(item => item.country.code === normalizedCode);

		if (countryData) {
			return countryData.country.name;
		}

		// Fallback for common variations
		const fallbackMapping: Record<string, string> = {
			US: "United States",
			CA: "Canada"
		};

		return fallbackMapping[normalizedCode] || countryCode;
	};

	/**
	 * Adds country information to address strings
	 * Detects country from address content and adds consistent country information
	 *
	 * @param address - The address string to enhance with country information
	 * @returns The address string with country information added
	 */
	public static addCountryToAddress = (address: string): string => {
		if (!address || typeof address !== "string") return address;

		// Check if address already has country information
		// CA is the identifier for a US State and also for a Country, so handling that use case specifically.
		const hasCountry = /\b(United States|Canada|United Kingdom|US|UK|GB|CA(?=\s*$))\b/i.test(address);
		if (hasCountry) return address;

		// Detect country and add it
		if (isCanadianAddress(address)) {
			return `${address}, Canada`;
		} else if (AddressUtil.isUSAddress(address)) {
			return `${address}, United States`;
		} else if (AddressUtil.isUkAddress(address)) {
			return `${address}, United Kingdom`;
		}

		return address;
	};
	
	/**
	 * Formats BusinessAddress object into a string for display
	 *
	 * @param address - BusinessAddress object to format
	 * @returns Formatted address string
	 */
	public static formatBusinessAddressToString = (address: BusinessAddress): string => {
		const keys = ["line_1", "apartment", "city", "state", "postal_code", "country"];
		return keys
			.map(key => {
				if (key === "country" && address[key]) {
					return this.getCountryFullName(address[key]);
				}
				return address[key]?.toString().trim();
			})
			.filter(Boolean)
			.join(", ");
	}
}
/**
 * Normalizes country to 3 Digits for Match
 */
export const normalizeCountryCode = (country: string | null | undefined): string => {
	if (!country) return "USA"; // Default fallback

	switch (country) {
		case "US":
			return "USA";
		case "CA":
			return "CAN";
	}

	return "USA"; // Default fallback
};
