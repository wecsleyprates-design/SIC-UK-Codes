import { isUSBusiness } from "#helpers/countryHelper";
import { logger } from "#helpers";
import type { Business } from "#types";
import { SupportedCountryCode } from "@joinworth/types/dist/constants/countryCodes";

// This is the shape of the address fields that are used in the data_businesses record
export type Address = {
	address_line_1: string;
	address_line_2?: string;
	address_city: string;
	address_state: string;
	address_postal_code: string;
	address_country?: string;
	mobile?: string;
};

export class AddressError extends Error {
	private input: unknown;
	constructor(message: string, input: unknown) {
		super(message);
		this.name = "AddressError";
		this.input = input;
	}
	public getInput(): string {
		if (typeof this.input === "object" && this.input !== null) {
			return JSON.stringify(this.input);
		}
		return String(this.input);
	}
}
export abstract class AddressUtil {
	static readonly DEFAULT_COUNTRY: SupportedCountryCode = "US";

	// Typeguard: is Business.BusinessAddress
	static isBusinessAddress(addr: unknown): addr is Business.BusinessAddress {
		return (
			typeof addr === "object" &&
			addr !== null &&
			"line_1" in addr &&
			"city" in addr &&
			"state" in addr &&
			"postal_code" in addr &&
			"country" in addr
		);
	}

	// Typeguard: is Address
	static isAddress(addr: unknown): addr is Address {
		return (
			typeof addr === "object" &&
			addr !== null &&
			"address_line_1" in addr &&
			"address_city" in addr &&
			"address_state" in addr &&
			"address_postal_code" in addr
		);
	}

	static isCompleteAddress(
		addr: Address | Business.BusinessAddress,
		fields: (keyof Address)[] = ["address_line_1", "address_city", "address_postal_code"]
	): boolean {
		if (!addr) {
			return false;
		}
		const address = this.convertToAddress(addr);
		for (const field of fields) {
			const value = address[field];
			if (typeof value === "string") {
				if (value.trim() === "") {
					return false;
				}
				continue;
			}
			return false;
		}
		return true;
	}

	/* Convert an array of unknown address types to Address[] */
	static sanitizeAddresses(addresses: Array<Address | Business.BusinessAddress>): Address[] {
		return addresses?.map(addr => this.convertToAddress(addr)) ?? [];
	}

	static convertToAddress(addr: Business.BusinessAddress | Address): Address {
		if (this.isBusinessAddress(addr)) {
			return {
				address_line_1: addr.line_1,
				address_line_2: addr.apartment ?? undefined,
				address_city: addr.city,
				address_state: addr.state,
				address_postal_code: addr.postal_code,
				address_country: addr.country ?? undefined,
				mobile: addr.mobile ?? undefined
			};
		}
		if (this.isAddress(addr)) {
			return addr;
		}
		throw new AddressError("Invalid address type", addr);
	}

	static normalizeAddress(address: Address | Business.BusinessAddress): Address {
		// Note: Currently, this only normalizes country and postal code while returning a copy of the address.
		// Additional normalization of components (e.g. "Apartment 1" -> "apt 1") may be added in the future if needed.
		const addr = this.convertToAddress({ ...address });

		addr.address_country = this.normalizeCountry(addr);
		addr.address_postal_code = this.normalizePostalCode(addr);

		return addr;
	}

	private static normalizeCountry(address: Address): Address["address_country"] {
		return address.address_country ?? this.DEFAULT_COUNTRY;
	}

	private static normalizePostalCode(address: Address): Address["address_postal_code"] {
		// For US, we want to normalize the postal code to 5 digts when set
		if (address.address_postal_code && address.address_country) {
			if (["US", "USA"].includes(address.address_country)) {
				return (
					address.address_postal_code
						?.replace(/[^0-9]/g, "")
						.padStart(5, "0")
						.substring(0, 5) ?? undefined
				);
			}
		}
		return address.address_postal_code;
	}

	/**
	 * Collapses an address object to a fingerprint string to use for comparisons in a normalized way
	 * Pass in a different array of fields to override the fields used to generate the fingerprint
	 */
	static toFingerprint(
		addr: Address | Business.BusinessAddress,
		isPrimary: boolean | undefined = undefined,
		fields: (keyof Address)[] = [
			"address_line_1",
			"address_line_2",
			"address_city",
			"address_state",
			"address_postal_code"
		]
	): string {
		// Flag if this is a primary or a secondary address -- to allow dupes between both primary & secondary addresses

		const inferPrimarySecondary = addr => {
			// by default returns "primary" if can't determine secondary
			return this.isBusinessAddress(addr) && addr.is_primary === false ? "secondary" : "primary";
		};
		const primarySecondary: "primary" | "secondary" =
			isPrimary === undefined ? inferPrimarySecondary(addr) : isPrimary ? "primary" : "secondary";
		const normalized = this.normalizeAddress(addr);
		return fields
			.map(field => normalized[field] ?? "")
			.concat([primarySecondary])
			.join("::")
			.toLowerCase();
	}

	static convertToBusinessAddress(
		addr: Address | Business.BusinessAddress,
		isPrimary: boolean = false,
		defaultCountry: SupportedCountryCode = this.DEFAULT_COUNTRY
	): Business.BusinessAddress {
		if (this.isAddress(addr)) {
			return {
				line_1: addr.address_line_1,
				apartment: addr.address_line_2 ?? undefined,
				city: addr.address_city,
				state: addr.address_state,
				country: addr.address_country ?? defaultCountry,
				postal_code: addr.address_postal_code,
				mobile: addr.mobile ?? undefined,
				is_primary: isPrimary
			};
		}
		return addr;
	}

	/**
	 * Convert a business record's address fields to a Business.BusinessAddress object
	 * @param business
	 * @returns
	 */
	static convertBusinessToBusinessAddress(
		business: Business.Record,
		defaultCountry: SupportedCountryCode = this.DEFAULT_COUNTRY
	): Business.BusinessAddress {
		return {
			line_1: business.address_line_1 ?? "",
			apartment: business.address_line_2 ?? undefined,
			city: business.address_city ?? "",
			state: business.address_state ?? "",
			country: business.address_country ?? defaultCountry,
			postal_code: business.address_postal_code ?? "",
			mobile: business.mobile ?? undefined,
			is_primary: true
		};
	}

	static convertBusinessAddressToBusinessFields(
		address: Business.BusinessAddress,
		defaultCountry: SupportedCountryCode = this.DEFAULT_COUNTRY
	): Pick<
		Business.Record,
		| "address_line_1"
		| "address_line_2"
		| "address_city"
		| "address_state"
		| "address_country"
		| "address_postal_code"
		| "mobile"
	> {
		return {
			address_line_1: address.line_1,
			address_line_2: address.apartment ?? undefined,
			address_city: address.city,
			address_state: address.state,
			address_country: address.country ?? defaultCountry,
			address_postal_code: address.postal_code,
			mobile: address.mobile ?? undefined
		};
	}

	/**
	 * Sanitizes a state/province name into a state abbreviation.
	 * When a `countryCode` is provided, country-specific rules apply first
	 * (e.g. Puerto Rico has no subdivisions — state is always "PR").
	 *
	 * @param state The state name to sanitize.
	 * @param options.truncate  Truncate unrecognised values to the first 2 characters (default: false).
	 * @param options.countryCode  ISO country code — enables territory short-circuits (e.g. "PR").
	 * @returns The sanitized state abbreviation.
	 */
	static sanitizeStateToAbbreviation(state: string, options?: { truncate?: boolean; countryCode?: string }): string {
		const { truncate = false, countryCode } = options ?? {};

		// Territories with no state subdivisions — the country code IS the state
		const STATELESS_TERRITORIES = ["PR"];
		const upperCountry = countryCode?.toUpperCase();
		if (upperCountry && STATELESS_TERRITORIES.includes(upperCountry)) {
			return upperCountry;
		}

		// Comprehensive mapping of US states, territories, and Canadian provinces/territories
		// keys should be in lower case with no punctuation marks, accents, or spaces
		const stateMap = {
			// US States
			alabama: "AL",
			alaska: "AK",
			arizona: "AZ",
			arkansas: "AR",
			california: "CA",
			colorado: "CO",
			connecticut: "CT",
			delaware: "DE",
			florida: "FL",
			georgia: "GA",
			hawaii: "HI",
			idaho: "ID",
			illinois: "IL",
			indiana: "IN",
			iowa: "IA",
			kansas: "KS",
			kentucky: "KY",
			louisiana: "LA",
			maine: "ME",
			maryland: "MD",
			massachusetts: "MA",
			michigan: "MI",
			minnesota: "MN",
			mississippi: "MS",
			missouri: "MO",
			montana: "MT",
			nebraska: "NE",
			nevada: "NV",
			newhampshire: "NH",
			newjersey: "NJ",
			newmexico: "NM",
			newyork: "NY",
			northcarolina: "NC",
			northdakota: "ND",
			ohio: "OH",
			oklahoma: "OK",
			oregon: "OR",
			pennsylvania: "PA",
			rhodeisland: "RI",
			southcarolina: "SC",
			southdakota: "SD",
			tennessee: "TN",
			texas: "TX",
			utah: "UT",
			vermont: "VT",
			virginia: "VA",
			washington: "WA",
			westvirginia: "WV",
			wisconsin: "WI",
			wyoming: "WY",

			// US Territories
			americansamoa: "AS",
			guam: "GU",
			northernmarianaislands: "MP",
			puertorico: "PR",
			sanjuan: "PR", // San Juan is the capital of Puerto Rico, commonly used as state name
			usvirginislands: "VI",
			virginislands: "VI",
			districtofcolumbia: "DC",
			washingtondc: "DC",

			// Canadian Provinces
			alberta: "AB",
			britishcolumbia: "BC",
			manitoba: "MB",
			newbrunswick: "NB",
			newfoundlandandlabrador: "NL",
			newfoundland: "NL",
			northwestterritories: "NT",
			novascotia: "NS",
			nunavut: "NU",
			ontario: "ON",
			princeedwardisland: "PE",
			quebec: "QC",
			saskatchewan: "SK",
			yukon: "YT",
			yukonterritory: "YT",

			// Australian States and Territories
			newsouthwales: "NSW",
			victoria: "VIC",
			queensland: "QLD",
			westernaustralia: "WA",
			southaustralia: "SA",
			tasmania: "TAS",
			australiancapitalterritory: "ACT",
			northernterritory: "NT",

			// New Zealand Regions
			auckland: "AUK",
			aucklandregion: "AUK",
			bayofplenty: "BOP",
			bayofplentyregion: "BOP",
			canterbury: "CAN",
			canterburyregion: "CAN",
			gisborne: "GIS",
			gisborneregion: "GIS",
			hawkesbay: "HKB",
			hawkesbayregion: "HKB",
			manawatuwanganui: "MWT",
			manawatuwanganuiregion: "MWT",
			marlborough: "MBH",
			marlboroughregion: "MBH",
			nelson: "NSN",
			nelsonregion: "NSN",
			northland: "NTL",
			northlandregion: "NTL",
			otago: "OTA",
			otagoregion: "OTA",
			southland: "STL",
			southlandregion: "STL",
			taranaki: "TKI",
			taranakiregion: "TKI",
			tasman: "TSN",
			tasmanregion: "TSN",
			waikato: "WKO",
			waikatoregion: "WKO",
			wellington: "WGN",
			wellingtonregion: "WGN",
			westcoast: "WTC",
			westcoastregion: "WTC",

			// Common variations and abbreviations
			ala: "AL",
			arkansaw: "AR", // Common misspelling
			calif: "CA",
			cal: "CA",
			cali: "CA",
			conn: "CT",
			fla: "FL",
			ill: "IL",
			mass: "MA",
			mich: "MI",
			minn: "MN",
			miss: "MS",
			mont: "MT",
			neb: "NE",
			nev: "NV",
			newh: "NH",
			newj: "NJ",
			newm: "NM",
			newy: "NY",
			northc: "NC",
			northd: "ND",
			nfld: "NL",
			okla: "OK",
			ore: "OR",
			penn: "PA",
			pq: "QC",
			southc: "SC",
			southd: "SD",
			tenn: "TN",
			tex: "TX",
			wash: "WA",
			wva: "WV",
			wis: "WI",
			wyo: "WY"
		};

		// Is the uppercase version of this a known value? If so just return :)
		if (Object.values(stateMap).includes(state.toString().toUpperCase())) {
			return state.toString().toUpperCase();
		}

		// Convert to ascii characters, strip numbers dashes etc, and force lowercase
		const asciiState = state
			.toString()
			.replace(/[^a-zA-Z]/g, "")
			.toLowerCase()
			.trim();

		// Try exact match
		if (stateMap[asciiState]) {
			return stateMap[asciiState];
		}

		if (truncate) {
			// If no match found, return first two characters uppercase
			const firstTwo = asciiState.toUpperCase().substring(0, 2);
			logger.warn(`State ${state} not found in state map, returning first two characters: ${firstTwo}`);
			return firstTwo;
		}
		logger.warn(`State ${state} not found in state map, returning original value`);
		return state.toString().toUpperCase();
	}

	/**
	 * Sanitizes a postal code based on the country format.
	 * Single source of truth for mapper fields and any other callers.
	 * @param countryCode - SupportedCountryCode or string (e.g. "AU", "NZ", "PR") for API input
	 * @param postalCode - Raw postal code string
	 * @returns Sanitized postal code (US/PR: 5-digit; AU/NZ: 4-digit; CA/UK/others: alphanumeric, max 10)
	 */
	static sanitizePostalCode(countryCode: SupportedCountryCode | string | undefined, postalCode: string): string {
		const cleaned = postalCode.replace(/[^a-zA-Z0-9]/g, "");
		const upper = (countryCode ?? "").toString().toUpperCase();

		// US & Puerto Rico: 5-digit numeric, zero-padded
		// example: 30324-4840 -> 30324; PR uses same format as US
		if (!upper || upper === "US" || upper === "USA" || isUSBusiness(countryCode) || upper === "PR") {
			return cleaned.replace(/[^0-9]/g, "").padStart(5, "0").substring(0, 5);
		}

		// AU & NZ: 4-digit numeric, no padding
		// example: 2013 (NZ) -> 2013; 2000 (AU) -> 2000
		if (upper === "AU" || upper === "NZ") {
			return cleaned.substring(0, 4);
		}

		// CA, UK, GB, others: alphanumeric, no padding, max 10 chars
		// example: A1A 1A1 -> A1A1A1 (CA); SW1A 2AA -> SW1A2AA (UK)
		return cleaned.substring(0, 10);
	}
}
