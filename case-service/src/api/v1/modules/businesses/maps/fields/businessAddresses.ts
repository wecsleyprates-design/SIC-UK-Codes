import type { Business, MapperField } from "#types";
import { SupportedCountryCode } from "#constants";
import { AddressUtil } from "#utils";
import type { BusinessState } from "../../businessState";
import type { Mapper } from "../../mapper";
import { assertTruthy, sanitizePhoneNumber } from "../utils";

// Creates a postal code sanitizer for a given index of address fields (defaults to 1)
// Address fields may range from 1-5, can use addressIndex to retrieve the correct countryCode value
const createPostalCodeSanitizer = (addressIndex = 1) => async (mapper: Mapper, str: string) => {
	const countryCode = mapper.getInputValue<string>(`address${addressIndex}_country`) as SupportedCountryCode;
	const postalCode = str.toString();
	return AddressUtil.sanitizePostalCode(countryCode, postalCode);
};

const createStateSanitizer = (addressIndex = 1) => async (mapper: Mapper, str: string) => {
	const countryCode = mapper.getInputValue<string>(`address${addressIndex}_country`);
	return AddressUtil.sanitizeStateToAbbreviation(str, { countryCode });
};

const baseBusinessMailingAddressesFields: MapperField<string>[] = [
	{
		column: "address1_line_1",
		description: "The first line of an additional business address",
		alternate: ["address1_line1", "mailing_address1_line1", "mailing_address1_line_1"],
		sanitize: async (_, str) => str.toString().substring(0, 255).trim()
	} as MapperField<string>,
	{
		column: "address1_apartment",
		description: "The second line of an additional business address",
		alternate: ["address1_line2", "mailing_address1_line2", "mailing_address1_line_2"],
		sanitize: async (_: Mapper, str) => str.toString().substring(0, 255).trim()
	} as MapperField<string>,
	{
		column: "address1_city",
		description: "The city of an additional business address",
		alternate: ["mailing_address1_city"],
		sanitize: async (_, str) => str.toString().substring(0, 100).trim()
	} as MapperField<string>,
	{
		column: "address1_state",
		description: "The state abbreviation of an additional business address",
		alternate: ["mailing_address1_state"],
		// Accept 2-3 character state codes to support:
		// - US/CA: 2 characters (AL, CA, ON, BC, etc.)
		// - AU/NZ: 3 characters (NSW, VIC, QLD, AUK, BOP, etc.)
		validate: async (_, field) => assertTruthy(typeof field.value === "string" && field.value.length >= 2 && field.value.length <= 3, field),
		sanitize: createStateSanitizer()
	} as MapperField<string>,
	{
		column: "address1_country",
		description: "The country code of an additional business address",
		alternate: ["mailing_address1_country"],
		sanitize: async (_, str) => str.toString().substring(0, 15).trim()
	} as MapperField<string>,
	{
		column: "address1_postal_code",
		description: "The postal code of an additional business address",
		alternate: [
			"mailing_address1_postal_code",
			"address1_zip",
			"mailing_address1_zip",
			"mailing_address1_zipcode",
			"address1_zipcode",
			"address1_postalcode",
			"mailing_address1_postalcode"
		],
		// addressIndex defaults to 1, therefore uses address1_country to retrieve countryCode
		sanitize: createPostalCodeSanitizer()
	} as MapperField<string>,
	{
		column: "address1_mobile",
		description: "The phone number of an additional business address",
		alternate: ["address1_phone", "mailing_address1_phone", "mailing_address1_mobile"],
		sanitize: async (_, value: string) => sanitizePhoneNumber(value),
		validate: async (_, field) => assertTruthy(field && ("" + field.value).length === 11, field)
	} as MapperField<string>
];

// Construct "dba{n}_" fields for n = 2, 3, 4, 5
export function getBusinessMailingAddressesFields() {
	return (baseBusinessMailingAddressesFields as MapperField[]).reduce((acc, field) => {
		for (let i = 1; i <= 5; i++) {
			const column = field.column.replace("address1_", `address${i}_`);
			// map to canonical keys used in state/diff
			const canonicalKeyMap: Record<string, string> = {
				line_1: "address_line_1",
				apartment: "address_line_2",
				city: "address_city",
				state: "address_state",
				postal_code: "address_postal_code",
				country: "address_country",
				mobile: "address_mobile"
			};
			const prop = column.split("_").slice(1).join("_"); // e.g., line_1, apartment, city
			const canonicalProp = canonicalKeyMap[prop] ?? prop;

			// Sanitizers that need the address-specific country code to apply country-aware rules.
			// Add new entries here when a field requires per-address country context.
			const indexAwareSanitizers: Record<string, (idx: number) => typeof field.sanitize> = {
				postal_code: createPostalCodeSanitizer,
				state: createStateSanitizer,
			};
			const sanitize = indexAwareSanitizers[prop]?.(i) ?? field.sanitize;

			acc.push({
				...field,
				table: "data_business_addresses",
				column,
				description: (field.description ?? "").concat(` #${i}`),
				alternate: field.alternate?.map(a => a.replace("address1_", `address${i}_`)),
				pathKey: `data_business_addresses[].${canonicalProp}`,
				sanitize
			});
		}
		return acc;
	}, [] as MapperField<string>[]);
}

export async function collectMailingAddresses(mapper: Mapper, fields: MapperField[]): Promise<void> {
	const metadata = mapper.getAdditionalMetadata();
	const { originalState }: { originalState: BusinessState | undefined } = metadata;
	const mailingAddresses: Map<string, Business.BusinessAddress> = new Map(
		(originalState?.getState()?.data_business_addresses ?? []).map(address => [
			AddressUtil.toFingerprint(address, address.is_primary ?? false),
			address
		])
	);
	const addressesNumbers: number[] = fields
		.filter(f => f.column.startsWith(`address`))
		.reduce((acc, field) => {
			const matches = field.column.match(/address(\d+)_/);
			if (matches && matches[1] && acc.includes(parseInt(matches[1])) === false) {
				acc.push(parseInt(matches[1]));
			}
			return acc;
		}, [] as number[]);

	addressesNumbers.forEach(id => {
		if (fields && fields.length > 0) {
			const formattedAddress: Business.BusinessAddress = {
				line_1: fields.find(f => f.column === `address${id}_line_1`)?.value as string,
				apartment: fields.find(f => f.column === `address${id}_apartment`)?.value as string,
				city: fields.find(f => f.column === `address${id}_city`)?.value as string,
				state: fields.find(f => f.column === `address${id}_state`)?.value as string,
				postal_code: fields.find(f => f.column === `address${id}_postal_code`)?.value as string,
				country: fields.find(f => f.column === `address${id}_country`)?.value as string,
				mobile: fields.find(f => f.column === `address${id}_mobile`)?.value as string,
				is_primary: false
			};
			const fingerprint = AddressUtil.toFingerprint(formattedAddress);
			if (mailingAddresses.get(fingerprint)) {
				return;
			}
			mailingAddresses.set(fingerprint, formattedAddress);
		}
	});
	if (mailingAddresses.size > 0) {
		const mailingAddressesArray = Array.from(mailingAddresses.values());
		mapper.addAdditionalMetadata({
			mailing_addresses: mailingAddressesArray
		});
	}
}
