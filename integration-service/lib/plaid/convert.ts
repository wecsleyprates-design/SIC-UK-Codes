/* Convert Plaid -> Worth or Worth -> Plaid
    Left (key) is Plaid value, right (value) is Worth value
    It will use the first match found, so you should put the default/preferred mapping first
*/
import { IDV_STATUS, IdvStatusId } from "#constants";
import { logger } from "#helpers";
import { CountryCode, IdentityVerificationStatus } from "plaid";

const conversionMap: {
	status: { [key in IdentityVerificationStatus]?: IdvStatusId }[];
	address: { [key in string]?: string }[];
	country: { [key in CountryCode]?: string }[];
	states: { [key in string]?: string }[];
	phoneCountryCode: { [key in CountryCode]?: number }[];
} = {
	status: [
		{ success: IDV_STATUS.SUCCESS },
		{ canceled: IDV_STATUS.CANCELED },
		{ failed: IDV_STATUS.FAILED },
		{ expired: IDV_STATUS.EXPIRED },
		{ pending_review: IDV_STATUS.PENDING },
		{ active: IDV_STATUS.PENDING }
	],
	address: [
		{ AVE: "AVENUE" },
		{ APT: "" },
		{ STE: "" },
		{ BLVD: "BOULEVARD" },
		{ CIR: "CIRCLE" },
		{ CT: "COURT" },
		{ DR: "DRIVE" },
		{ HWY: "HIGHWAY" },
		{ LN: "LANE" },
		{ PKWY: "PARKWAY" },
		{ PL: "PLACE" },
		{ RD: "ROAD" },
		{ SQ: "SQUARE" },
		{ ST: "STREET" },
		{ TER: "TERRACE" },
		{ WAY: "WAY" },
		{ ALY: "ALLEY" },
		{ BCH: "BEACH" },
		{ BND: "BEND" },
		{ BRG: "BRIDGE" },
		{ BRK: "BROOK" },
		{ BYU: "BAYOU" },
		{ CMN: "COMMON" },
		{ CPE: "CAPE" },
		{ CRK: "CREEK" },
		{ CRST: "CREST" },
		{ XING: "CROSSING" },
		{ DM: "DAM" },
		{ EXPY: "EXPRESSWAY" },
		{ FLD: "FIELD" },
		{ FWY: "FREEWAY" },
		{ GDNS: "GARDENS" },
		{ GLN: "GLEN" },
		{ GRN: "GREEN" },
		{ GRV: "GROVE" },
		{ HOLW: "HOLLOW" },
		{ HTS: "HEIGHTS" },
		{ ISLE: "ISLE" },
		{ JCT: "JUNCTION" },
		{ LNDG: "LANDING" },
		{ LK: "LAKE" },
		{ LGT: "LIGHT" },
		{ MDWS: "MEADOWS" },
		{ MNR: "MANOR" },
		{ MTN: "MOUNTAIN" },
		{ MTWY: "MOTORWAY" },
		{ PASS: "PASS" },
		{ PT: "POINT" },
		{ RADL: "RADIAL" },
		{ RCH: "REACH" },
		{ RST: "REST" },
		{ SHRS: "SHORES" },
		{ SPG: "SPRING" },
		{ SQ: "SQUARE" },
		{ STA: "STATION" },
		{ TRCE: "TRACE" },
		{ TRL: "TRAIL" },
		{ TRFY: "TRAFFICWAY" },
		{ TUNN: "TUNNEL" },
		{ VLY: "VALLEY" },
		{ VW: "VIEW" },
		{ XING: "CROSSING" },
		{ S: "SOUTH" },
		{ N: "NORTH" },
		{ W: "WEST" },
		{ E: "EAST" },
		{ SE: "SOUTHEAST" },
		{ NE: "NORTHEAST" },
		{ SW: "SOUTHWEST" },
		{ NW: "NORTHWEST" }
	],
	states: [
		{ AL: "ALABAMA" },
		{ AK: "ALASKA" },
		{ AZ: "ARIZONA" },
		{ AR: "ARKANSAS" },
		{ CA: "CALIFORNIA" },
		{ CA: "CALI" },
		{ CO: "COLORADO" },
		{ CT: "CONNECTICUT" },
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
		{ VI: "US VIRGIN ISLANDS" },
		// Canada Provinces
		{ AB: "ALBERTA" },
		{ BC: "BRITISH COLUMBIA" },
		{ MB: "MANITOBA" },
		{ NB: "NEW BRUNSWICK" },
		{ NL: "NEWFOUNDLAND AND LABRADOR" },
		{ NT: "NORTHWEST TERRITORIES" },
		{ NS: "NOVA SCOTIA" },
		{ NU: "NUNAVUT" },
		{ ON: "ONTARIO" },
		{ PE: "PRINCE EDWARD ISLAND" },
		{ QC: "QUEBEC" },
		{ SK: "SASKATCHEWAN" },
		{ YT: "YUKON" }
		// Add misspellings and typos as needed
	],
	country: [
		{
			US: "US"
		},
		{
			US: "USA"
		},
		{
			CA: "CA"
		},
		{ CA: "CAN" },
		{ CA: "CANADA" },
		{ GB: "GB" },
		{ GB: "UK" },
		{ GB: "UNITED KINGDOM" },
		{ GB: "UNITED KINGDOM OF GREAT BRITAIN AND NORTHERN IRELAND" },
		{ GB: "GREAT BRITAIN" },
		{ GB: "ENGLAND" },
		{ US: "UNITED STATES" },
		{ US: "UNITES STATES" }
	],
	phoneCountryCode: [{ US: 1 }, { GB: 44 }, { CA: 1 }]
} as const;
type ConversionMap = typeof conversionMap;

/**
 * Given an objectType and a Plaid value, convert to Worth's value
 * @param objectType
 * @param input
 * @returns
 */
export const convertPlaidToWorth = <Key extends keyof ConversionMap>(objectType: Key, input: keyof ConversionMap[Key][0] | string): ConversionMap[Key][0][keyof ConversionMap[Key][0]] => {
	const entry = conversionMap[objectType].find(e => e[input as string] !== undefined);
	if (entry) {
		return entry[input as string]!;
	}
	throw new Error(`Conversion not found for to Worth: ${objectType} ${input.toString()}`);
};

/**
 * Given an objectType and a Worth value, convert to Plaid's value
 * @param objectType
 * @param input
 * @returns
 */
export const convertWorthToPlaid = <Key extends keyof ConversionMap>(
	objectType: Key,
	input: ConversionMap[Key][0][keyof ConversionMap[Key][0]],
	returnIfNotFound?: boolean
): keyof ConversionMap[Key] => {
	// Find in a case insensitive way
	const entry = conversionMap[objectType].find(e => Object.values(e).includes(typeof input === "string" ? input.toUpperCase() : input));
	if (entry) {
		return Object.keys(entry)[0] as keyof ConversionMap[Key];
	}
	if (returnIfNotFound) {
		return input as any;
	}
	throw new Error(`Conversion not found for from Worth: ${objectType} ${input}`);
};

export const formatPostalCode = (input: string | null | undefined, countryCode?: string | null | undefined): string | undefined => {
	if (!input) {
		return undefined;
	}
	if (!countryCode || ["US", "USA"].includes(countryCode)) {
		// Remove all non-digit characters to clean the input
		const digitsOnly = input.replace(/\D/g, "");

		// Truncate to 5 digits if longer
		let zipCode = digitsOnly.substring(0, 5);

		// Pad with zeros if shorter than 5 digits
		while (zipCode.length < 5) {
			zipCode = "0" + zipCode;
		}
		return zipCode;
	}
	// If not US, convert to uppercase & strip all non-alphanumeric characters
	try {
		return input
			.toString()
			?.toUpperCase()
			.replace(/[^A-Z0-9]/g, "");
	} catch (error) {
		logger.error(error, `Error formatting postal code: ${input}`);
		return undefined;
	}
};

/**
 * Convert state into two characters string format
 * @param state : state in string format
 * @returns state as string with two characters
 */
export const convertState = (state: string) => {
	state = state.toUpperCase();
	const entry = conversionMap["states"].find(e => Object.values(e).includes(state));
	if (entry) {
		return Object.keys(entry)[0];
	}
	throw new Error(`Conversion not found for State: ${state}`);
};

/**
 * Convert address abbreviations their full forms
 * @param address : address string
 * @returns converted address string
 */
const transformAddress = (address: string): string => {
	const addressRecord = conversionMap["address"].reduce(
		(acc, curr) => {
			const [key, value] = Object.entries(curr)[0];
			acc[key] = value;
			return acc as Record<string, string>;
		},
		{} as Record<string, string>
	);
	const addrAbbreviations = Object.keys(addressRecord);
	const addrFull = Object.values(addressRecord);

	const addressParts = address.toUpperCase().split(" ");
	for (const addrIndex in addressParts) {
		const addrPart = addressParts[addrIndex];
		if (addrPart) {
			const foundIndex = addrAbbreviations.indexOf(addrPart);
			if (foundIndex >= 0 && addrFull[foundIndex]) {
				addressParts[addrIndex] = addrFull[foundIndex] as string;
			}
		}
	}
	return addressParts.join(" ");
};

export const convertAddress = (address1: string): string => {
	// Convert the address to uppercase and remove all characters except letters, numbers, and spaces
	const address = `${address1}`.toUpperCase().replace(/[^a-zA-Z0-9 ]/g, "");
	return transformAddress(address);
};

export const extractStreetNumber = address => {
	const match = address.match(/^[0-9]+/);
	return match ? match[0] : null;
};

export const lpad = (str: string, length: number, padChar: string): string => {
	while (str.length < length) {
		str = padChar + str;
	}
	return str;
};

export const extractZipParts = (postalCode: string) => {
	const trimmedPostalCode = postalCode.trim();
	const splitParts = trimmedPostalCode.split("-");
	const firstPart = splitParts[0] ? lpad(splitParts[0], 5, "0") : "";
	const secondPart = splitParts[1] ? lpad(splitParts[1], 4, "0") : "";
	return {
		zipcode: firstPart,
		zip4: secondPart
	};
};
