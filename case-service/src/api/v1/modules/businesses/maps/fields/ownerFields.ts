import { OWNER_TYPES, type OwnerType } from "#constants";
import { logger } from "#helpers";
import type { Business, MapperField, UserInfo } from "#types";
import { AddressUtil, decryptEin, isInteger, isUUID, safeDecrypt, sanitizeDate } from "#utils";
import { businesses } from "../../businesses";
import type { BusinessState } from "../../businessState";
import { InternationalBusinessError } from "../../error";
import { MapperError, type Mapper } from "../../mapper";
import { Owners } from "../../owners";
import { BulkCreateBusinessMap } from "../bulkCreateBusinessMap";
import { assertTruthy, sanitizePhoneNumber, sanitizePostalCode } from "../utils";
import type { UUID } from "crypto";

export async function validateOwnerFields(mapper: Mapper): Promise<void> {
	const metadata = mapper.getAdditionalMetadata();
	//make sure we have values for owner type and optionally ownership percentage
	//Get all owner titles
	const fields = mapper.getMappedFields();
	const titles = await Owners.getOwnerTitles().then(titles => Object.values(titles) as { id: number; title: string }[]);
	mapper.addAdditionalMetadata({ titles });
	let controlOwners = 0;
	let beneficialOwners = 0;
	let totalOwnership = 0;
	const ownerNumbers: number[] = fields
		.filter(f => f.column.startsWith(`owner`))
		.reduce((acc, field) => {
			const matches = field.column.match(/owner(\d+)_/);
			if (matches && matches[1] && acc.includes(parseInt(matches[1])) === false) {
				acc.push(parseInt(matches[1]));
			}
			return acc;
		}, [] as number[]);
	const progressionConfig = await businesses.getProgressionConfig(metadata.customerID);
	const idvStatus =
		progressionConfig
			?.find(row => row?.stage?.toLowerCase() == "ownership")
			?.config?.fields?.find(field => field?.name?.toLowerCase() == "Enable Identity Verification".toLowerCase())
			?.status || false;

	ownerNumbers.forEach(id => {
		const inScopeFields = fields.filter(f => f.column?.startsWith(`owner${id}_`));

		if (id < 1 || id > 5) {
			throw new MapperError("Invalid owner number", inScopeFields[0] as MapperField);
		}
		const ownerType = inScopeFields.find(f => f.column === `owner${id}_owner_type`);
		const ownershipPercentage = inScopeFields.find(f => f.column === `owner${id}_ownership_percentage`);
		const ownerFirstName = inScopeFields.find(f => f.column === `owner${id}_first_name`);
		const ownerLastName = inScopeFields.find(f => f.column === `owner${id}_last_name`);
		const ownerTitle = inScopeFields.find(f => f.column === `owner${id}_title`);
		const ownerDob = inScopeFields.find(f => f.column === `owner${id}_dob`);
		if (ownerTitle?.value && !titles?.find(t => t?.title?.toLowerCase() == ("" + ownerTitle.value)?.toLowerCase())) {
			throw new MapperError(`Invalid owner title for owner ${id} : ${ownerTitle.value}`, ownerTitle);
		}
		if (ownerType?.value === OWNER_TYPES.BENEFICIARY && !ownershipPercentage) {
			mapper.addWarning(`Ownership percentage is required for beneficiary owner ${id}`);
		}
		if (idvStatus && (!ownerFirstName || !ownerLastName || !ownerDob)) {
			mapper.addWarning(
				`For IDV verification, please provide at least Date of Birth, First Name, and Last Name for owner ${id}.`
			);
		}
		if (ownerType?.value) {
			if (ownerType.value === OWNER_TYPES.BENEFICIARY) {
				beneficialOwners++;
			} else if (ownerType.value === OWNER_TYPES.CONTROL) {
				controlOwners++;
				mapper.addAdditionalMetadata({ controlOwner: id });
			}
		}
		totalOwnership += (ownershipPercentage?.value as number) || 0;
		if (totalOwnership > 100) {
			throw new MapperError("Total ownership must not exceed 100%", ownerType);
		}
		if (controlOwners > 1) {
			throw new MapperError("Exactly one control owner is required", ownershipPercentage || fields[0]);
		}
		if (mapper instanceof BulkCreateBusinessMap && beneficialOwners == ownerNumbers.length) {
			throw new MapperError("At least one control owner is required", ownerType);
		}
	});

	return;
}
export async function processOwnerFields(mapper: Mapper, fields: MapperField[]) {
	//construct owner body to match expected input for Owners.addOrUpdateOwners
	const metadata = mapper.getAdditionalMetadata();
	const businessID = metadata.data_businesses?.id;
	const customerID = metadata.customerID;
	if (!businessID) {
		return;
	}
	const { titles, controlOwner } = metadata;
	const addOwnerBody: Omit<Business.Owner, "id">[] = [];
	const ownerNumbers: number[] = fields
		.filter(f => f.column.startsWith(`owner`))
		.reduce((acc, field) => {
			const matches = field.column.match(/owner(\d+)_/);
			if (matches && matches[1] && acc.includes(parseInt(matches[1])) === false) {
				acc.push(parseInt(matches[1]));
			}
			return acc;
		}, [] as number[]);
	ownerNumbers.forEach(id => {
		if (fields) {
			const ownerTitle = fields.find(f => f.column === `owner${id}_title`)?.value ?? "";
			const title = titles.find(t => t?.title?.toLowerCase() == ownerTitle?.toLowerCase());
			let ownerType: OwnerType | undefined = fields.find(f => f.column === `owner${id}_owner_type`)?.value;
			// Try to make sure we get at least one control owner on a CREATE
			if (!ownerType) {
				if (mapper instanceof BulkCreateBusinessMap) {
					if (!controlOwner && id === 1) {
						ownerType = OWNER_TYPES.CONTROL;
					} else if (controlOwner === id) {
						ownerType = OWNER_TYPES.CONTROL;
					} else {
						ownerType = OWNER_TYPES.BENEFICIARY;
					}
				}
			}
			addOwnerBody.push({
				title: title ? { id: title.id, title: title.title } : undefined,
				first_name: fields.find(f => f.column === `owner${id}_first_name`)?.value as string,
				last_name: fields.find(f => f.column === `owner${id}_last_name`)?.value as string,
				email: fields.find(f => f.column === `owner${id}_email`)?.value as string,
				mobile: fields.find(f => f.column === `owner${id}_mobile`)?.value as string,
				ssn: fields.find(f => f.column === `owner${id}_ssn`)?.value as string,
				date_of_birth: fields.find(f => f.column === `owner${id}_dob`)?.value as string,
				address_line_1: fields.find(f => f.column === `owner${id}_address_line_1`)?.value as string,
				address_line_2: fields.find(f => f.column === `owner${id}_address_line_2`)?.value as string,
				address_city: fields.find(f => f.column === `owner${id}_address_city`)?.value as string,
				address_state: fields.find(f => f.column === `owner${id}_address_state`)?.value as string,
				address_postal_code: fields.find(f => f.column === `owner${id}_address_postal`)?.value as string,
				address_country: fields.find(f => f.column === `owner${id}_address_country`)?.value as string,
				owner_type: ownerType as OwnerType,
				ownership_percentage: (fields.find(f => f.column === `owner${id}_ownership_percentage`)?.value as number) || 0,
				external_id: fields.find(f => f.column === `owner${id}_external_id`)?.value
			});
		}
	});
	if (addOwnerBody.length > 0) {
		try {
			await Owners.addOrUpdateOwners({ owners: addOwnerBody, customerID: customerID }, businessID, {
				user_id: metadata?.userID
			} as UserInfo, { bypassMinPercentageValidation: true });
			const owners = await Owners.getBusinessOwners(businessID);
			mapper.addAdditionalMetadata({ owners });
		} catch (ex) {
			if (ex instanceof InternationalBusinessError) {
				mapper.addWarning(`International business setup is not enabled for this customer.`);
			}
		}
	}
}

const validateOwnershipPercentage = async (mapper, field) =>
	assertTruthy(typeof field.value === "number" && field.value >= 0 && field.value <= 100, field);
const validateOwnerType = async (mapper, field) =>
	assertTruthy(typeof field?.value === "string" && Object.keys(OWNER_TYPES).includes(field.value), field);
const validateOwnerDob = async (mapper, field) =>
	assertTruthy(!!field?.value && (new Date(field.value as string) as unknown as string) !== "Invalid Date", field);
const validateOwnerSsn = async (mapper, field) =>
	assertTruthy(
		field?.value === null || (typeof field?.value === "string" && [4, 9].includes(field?.value?.length ?? 0)),
		field
	);

const trimString = async (_: unknown, value: unknown) => (typeof value === "string" ? value.trim() : value);

const baseOwnerFields: Omit<MapperField, "table">[] = [
	/* Owner 1 */
	{ column: "owner1_id", description: "The ID of the owner - used for internal reference only", isReadonly: true },
	{ column: "owner1_title", description: "The title of the owner", sanitize: trimString },
	{ column: "owner1_first_name", description: "The owner's first name", sanitize: trimString },
	{ column: "owner1_last_name", description: "The owner's last name", sanitize: trimString },
	{ column: "owner1_email", description: "The owner's email", sanitize: trimString },
	{
		column: "owner1_mobile",
		alternate: ["owner1_phone"],
		description: "The owner's mobile phone number",
		sanitize: async (mapper, value: string) => sanitizePhoneNumber(value),
		validate: async (mapper, field) => assertTruthy(field && ("" + field.value).length > 10, field)
	},
	{
		column: "owner1_ssn",
		description: "The owner's Social Security or other national identification number",
		isSensitive: true,
		sanitize: (mapper, value: any) => {
			if (value === null) return null;
			return value.toString();
		},
		validate: validateOwnerSsn
	},
	{
		column: "owner1_dob",
		description: "The owner's date of birth",
		alternate: ["owner1_date_of_birth"],
		validate: validateOwnerDob,
		sanitize: async (_, str) => sanitizeDate(str)
	},
	{ column: "owner1_address_line_1", description: "The first line of the owner's address", sanitize: trimString },
	{ column: "owner1_address_line_2", description: "The second line of the owner's address", sanitize: trimString },
	{ column: "owner1_address_city", description: "The city of the owner's address", sanitize: trimString },
	{
		column: "owner1_address_state",
		description: "The state of the owner's address",
		sanitize: async (mapper, str) => {
			const country =
				mapper.getMappedValueForColumn<string>("address_country", "data_businesses") ??
				(mapper as any).input?.get?.("address_country");
			return AddressUtil.sanitizeStateToAbbreviation(str, { countryCode: country });
		}
	},
	{
		column: "owner1_address_postal",
		description: "The postal code of the owner's address",
		alternate: ["owner1_address_zip"],
		sanitize: async (mapper, str) => {
			const country =
				mapper.getMappedValueForColumn<string>("address_country", "data_businesses") ??
				(mapper as any).input?.get?.("address_country");
			return sanitizePostalCode((str as string).toString(), country);
		}
	},
	{ column: "owner1_address_country", description: "Country code of the owner's address", sanitize: trimString },
	{
		column: "owner1_owner_type",
		description: "Ownership type, one of beneficial or control",
		alternate: ["owner1_type"],
		sanitize: async (mapper, value: string) => value.toUpperCase(),
		validate: validateOwnerType
	},
	{
		column: "owner1_ownership_percentage",
		alternate: ["owner1_percent"],
		description: "The ownership percentage of the owner",
		sanitize: async (mapper: Mapper, value: any) => parseFloat(value) || 0,
		validate: validateOwnershipPercentage
	},
	{
		column: "owner1_external_id",
		description: "Optional external identifier for the owner (stored per business-owner relationship)",
		sanitize: trimString
	}
];

export function getOwnerFields(mode: "create" | "update") {
	return (baseOwnerFields as MapperField[]).reduce((acc, field) => {
		for (let i = 1; i <= 5; i++) {
			let inject: Partial<MapperField> = {};
			const column = field.column.replace("owner1_", `owner${i}_`);
			if (mode === "update") {
				inject.isReadonly = false;
				inject.required = false;
			}
			const prop = column.replace(/^owner\d+_/, "");
			const canonicalKeyMap: Record<string, string> = {
				address_postal: "address_postal_code",
				address_zip: "address_postal_code",
				percent: "ownership_percentage",
				type: "owner_type"
			};
			const canonicalProp = canonicalKeyMap[prop] ?? prop;
			acc.push({
				...field,
				...inject,
				table: "data_owners",
				column,
				description: (field.description ?? "").concat(` #${i}`),
				alternate: field.alternate?.map(a => a.replace("owner1_", `owner${i}_`)),
				pathKey: `data_business_owners[].${canonicalProp}`
			});
		}
		return acc;
	}, [] as MapperField[]);
}

export async function updateValidateOwnerFields(mapper: Mapper) {
	const metadata = mapper.getAdditionalMetadata();
	const { originalState }: { originalState: BusinessState; customerID: UUID } = metadata;
	const fields = mapper.getMappedFields().filter(f => f.table === "data_owners");
	const titles = await Owners.getOwnerTitles().then(titles => Object.values(titles) as { id: number; title: string }[]);
	mapper.addAdditionalMetadata({ titles });
	const currentOwners = originalState.getState().data_business_owners;
	const currentOwnersFingerprints: Record<string, Business.Owner> = currentOwners.reduce(
		(acc, owner) => {
			acc[getOwnerFingerprint(owner)] = owner;
			return acc;
		},
		{} as Record<string, Business.Owner>
	);

	// Determine the ordinal numbers of the owners provided in the fields
	// e.g.: Owner 1, Owner 2, etc.
	const ownersProvided: Set<number> = new Set();
	for (const field of fields) {
		const matches = field.column.match(/owner(\d+)_/);
		if (matches && matches[1]) {
			if (isInteger(matches[1])) {
				ownersProvided.add(matches[1]);
			}
		}
	}

	// closure to parse owner "n" from the fields
	const parseOwner = (ownerNumber: number): Partial<Business.Owner> => {
		const ownerFields = fields.filter(f => f.column.startsWith(`owner${ownerNumber}_`)) ?? [];
		let parsedRecord = inputToOwner(ownerFields, titles ?? []);
		const fingerprint = getOwnerFingerprint(parsedRecord);
		const idField = ownerFields?.find(f => f.column === `owner${ownerNumber}_id` && isUUID(f.value));
		const externalIdField = ownerFields?.find(
			f => f.column === `owner${ownerNumber}_external_id` && f.value != null && f.value !== ""
		);
		// Resolve to an existing owner by internal id (throws if not found) or external_id (creates a new owner if not found).
		// When matched, merge incoming fields on top of the existing record so the downstream upsert treats this as an update.
		if (idField || externalIdField) {
			const currentOwner = idField
				? currentOwners.find(o => o.id === idField.value)
				: currentOwners.find(o => o.external_id === externalIdField!.value);
			if (!currentOwner && idField) {
				throw new MapperError(`Owner ID ${idField.value} is not valid`, idField);
			}
			if (currentOwner) {
				const existingRecord = Object.fromEntries(
					Object.entries(parsedRecord).filter(([key]) => parsedRecord[key] !== undefined)
				);
				parsedRecord = {
					...currentOwner,
					...existingRecord
				};
			}
		} else if (!parsedRecord.first_name || !parsedRecord.last_name) {
			throw new MapperError(
				`First name and last name are required for owner ${ownerNumber}. If updating an existing owner, please provide internal ID to match the existing owner.`,
				fields.find(f => f.column === `owner${ownerNumber}_first_name`) ||
					fields.find(f => f.column === `owner${ownerNumber}_last_name`)
			);
			// coalesce with current owner when mapperfield isn't set
		} else if (currentOwnersFingerprints[fingerprint] && parsedRecord.date_of_birth) {
			// If the user didn't provide an internal owner ID, but provided name + DOB that matches an existing owner,
			// treat this as an update to that owner rather than a duplicate insert.
			logger.info({
				message: "Passed owner data matches existing owner fingerpritn -- updating with new data",
				fingerprint,
				parsedRecord
			});
			const currentOwner = currentOwnersFingerprints[fingerprint];
			const existingRecord = Object.fromEntries(
				Object.entries(parsedRecord).filter(([key, value]) => key !== "id" && value !== undefined)
			);
			parsedRecord = {
				...currentOwner,
				...existingRecord
			};
		}
		return parsedRecord;
	};

	const newOwners: (Partial<Business.Owner> | { id?: string | undefined })[] = [...ownersProvided].map(ownerNumber =>
		parseOwner(ownerNumber)
	);
	mapper.addAdditionalMetadata({ owners: newOwners });
}

export async function updateProcessOwnerFields(mapper: Mapper) {
	const metadata = mapper.getAdditionalMetadata();
	const {
		owners,
		customerID,
		originalState
	}: { owners: Array<Business.Owner | { id?: string | undefined }>; customerID: UUID; originalState: BusinessState } =
		metadata;
	const businessID: UUID = originalState.getState().data_businesses.id as UUID;

	await Owners.addOrUpdateOwners({ owners, customerID }, businessID, {
		user_id: metadata?.userID
	} as UserInfo, { bypassMinPercentageValidation: true });
	const newOwners = await Owners.getBusinessOwners(businessID);
	mapper.addAdditionalMetadata({ owners: newOwners });
}

function getOwnerFingerprint(
	owner: Partial<Business.Owner>,
	fields: (keyof Business.Owner)[] = ["first_name", "last_name", "date_of_birth"]
): string {
	return (
		fields
			.map(field => (String(safeDecrypt(String(owner[field]), decryptEin)) ?? "").trim() ?? "")
			.join("::")
			?.toLowerCase() ?? ""
	);
}

// Helper to conver mapper fields to an owner record
// Field will be send as 'owner1_xxx', 'owner2_xxx', etc. We need to clean the column name to get the actual field name
function inputToOwner(fields: MapperField[], titles: Array<{ id: number; title: string }>): Partial<Business.Owner> {
	// turn to a record
	const input = fields.reduce(
		(acc, field) => {
			const cleanedColumn = field.column.replace(/^owner\d+_/, "");
			acc[cleanedColumn] = field.value;
			return acc;
		},
		{} as Record<string, any>
	);

	const title = titles?.find(t => t?.title?.toLowerCase() == ("" + input.title)?.toLowerCase());

	return {
		id: input.id,
		external_id: input.external_id,
		title: title,
		first_name: input.first_name,
		last_name: input.last_name,
		email: input.email,
		mobile: input.mobile,
		ssn: input.ssn,
		date_of_birth: input.dob,
		address_line_1: input.address_line_1,
		address_line_2: input.address_line_2,
		address_city: input.address_city,
		address_state: input.address_state,
		address_postal_code: input.address_postal,
		address_country: input.address_country,
		ownership_percentage: input.ownership_percentage ?? 0,
		owner_type: input.owner_type ?? OWNER_TYPES.BENEFICIARY
	};
}
