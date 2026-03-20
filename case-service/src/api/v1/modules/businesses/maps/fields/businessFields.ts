import {
	CASE_STATUS,
	CASE_TYPE,
	ERROR_CODES,
	FEATURE_FLAGS,
	GLOBAL_TAX_ID_FALLBACK_REGEX,
	kafkaEvents,
	TAX_ID_VALIDATION_RULES,
	UK_REGISTRATION_REGEX
} from "#constants";
import { db, getFlagValue, logger, redis } from "#helpers";
import type { Business, Case, MapperField } from "#types";
import { AddressUtil } from "#utils";
import Fuse from "fuse.js";
import { AdditionalPropertyMapperError, MapperError, type Mapper } from "../../mapper";
import { assertTruthy, parseBool, sanitizePhoneNumber, sanitizePositiveInteger } from "../utils";
import type { UUID } from "crypto";
import { envConfig } from "#configs";
import { addIndustryAndNaicsPlatform } from "#common";
import { businesses } from "../../businesses";
import { BusinessValidationError, validateBusiness } from "../../validateBusiness";
import { BusinessApiError, InternationalBusinessError } from "../../error";
import { StatusCodes } from "http-status-codes";
import { onboarding } from "../../../onboarding/onboarding";
import { caseManagementService } from "../../../case-management/case-management";
import { businessLookupHelper } from "#helpers/businessLookupHelper";

export async function validateBusinessFields(mapper: Mapper) {
	const fields = mapper.getMappedFields();
	const metadata = mapper.getAdditionalMetadata();
	const externalIDField = fields.find(
		f => f.column === "external_id" && f.table === "rel_business_customer_monitoring"
	);

	if (!metadata.customerID) {
		throw new Error("The customer ID is required to create a business");
	}
	const applicantID = mapper.getMappedValueForColumn<UUID>(
		"applicant_id",
		"applicant",
		envConfig.ENTERPRISE_APPLICANT_ID as UUID
	);
	if (!applicantID) {
		throw new MapperError("Could not determine an applicant to associate with this business");
	}
	mapper.addAdditionalMetadata({ applicantID });

	// Validate external_id being unique (only if external_id is provided)
	if (externalIDField?.value) {
		try {
			const existingBusinesses = await businessLookupHelper({
				customerID: metadata.customerID,
				externalID: externalIDField.value as string
			});
			// If business is found, store the business ID in metadata
			const existingBusinessId = existingBusinesses[0]?.id;
			if (existingBusinessId) {
				mapper.addAdditionalMetadata({ existingBusinessId });
				throw new AdditionalPropertyMapperError(
					`The business external ID already exists for this customer (business ID: ${existingBusinessId})`,
					externalIDField,
					{ existing_business_id: existingBusinessId }
				);
			}
			throw new MapperError("The business external ID already exists for this customer", externalIDField);
		} catch (ex) {
			// This is an odd use case but we WANT to throw an error if the business **is** found -- BusinessLookupHelper throws just "Error" if it can't complete a lookup
			if (ex instanceof MapperError) {
				throw ex;
			}
		}
	}
}

export async function processBusinessFields(mapper: Mapper, fields: MapperField[]) {
	const metadata: {
		async?: boolean;
		mailing_addresses?: Business.BusinessAddress[];
		customerID: UUID;
		userID: UUID;
		dba_names?: { name: string }[];
		businessValidationResponse?: string;
		businessID?: UUID;
	} = mapper.getAdditionalMetadata();
	const authorization = mapper.getAuth();

	const applicantID = 
		mapper.getInputValue<UUID>("applicant_id") ||
		mapper.getInputValue<UUID>("applicantid") ||
		envConfig.ENTERPRISE_APPLICANT_ID as UUID;
	if (!applicantID) {
		throw new MapperError("Could not determine an applicant to associate with this business");
	}
	// Persist resolved applicantID to metadata
	mapper.addAdditionalMetadata({ applicantID });

	// Fields that are native to the business table and thus can be seen by the mapper
	const extraBusinessFields: string[] = ["is_corporate_entity", "quick_add", "skip_credit_check", "bypass_ssn"];
	const getFieldValue = (column: (typeof extraBusinessFields)[number], defaultValue?: any) => {
		return fields.find(field => field.column === column && field.table === "data_businesses")?.value ?? defaultValue;
	};

	const isQuickAdd = getFieldValue("quick_add", false);
	const skipCreditCheck = getFieldValue("skip_credit_check", false);
	const bypassSsn = getFieldValue("bypass_ssn", false);
	const isCorporateEntity = getFieldValue("is_corporate_entity", undefined);
	const isAsync: boolean = metadata.async || false;
	const businessEgg = fields.reduce((acc, field) => {
		if (field.table === "data_businesses" && !extraBusinessFields.includes(field.column)) {
			acc[field.column] = field.value;
		}
		return acc;
	}, {} as Business.Egg);

	//Check if the business has a mailing_addresses array
	if (
		metadata.mailing_addresses &&
		Array.isArray(metadata.mailing_addresses) &&
		metadata.mailing_addresses.length > 0
	) {
		// If we don't have any address fields, use the first address in the mailing_addresses array as the business address
		if (
			!businessEgg.address_line_1 &&
			!businessEgg.address_city &&
			!businessEgg.address_postal_code &&
			!businessEgg.address_state
		) {
			const mailingAddress = metadata.mailing_addresses[0] as Business.BusinessAddress;
			businessEgg.address_line_1 = mailingAddress.line_1;
			businessEgg.address_line_2 = mailingAddress.apartment ?? undefined;
			businessEgg.address_postal_code = mailingAddress.postal_code;
			businessEgg.address_city = mailingAddress.city;
			businessEgg.address_state = mailingAddress.state;
			businessEgg.address_country = businessEgg.address_country ?? mailingAddress.country;
		}
		// If we don't have a mobile number, find first mobile number in the mailing_addresses array
		if (!businessEgg.mobile) {
			businessEgg.mobile = metadata.mailing_addresses.find(address => address.mobile)?.mobile ?? undefined;
		}
	}

	// Unset the tin when creating the record (validate will link it)
	let business = await businesses.createBusinessFromEgg({ ...businessEgg, tin: undefined });
	let { id: businessID } = business;

	await addIndustryAndNaicsPlatform(businessID, "manual", {
		naics: business.naics_id,
		industry: business.industry
	});

	const validationRequest = {
		tin: businessEgg.tin as UUID,
		address_line_1: businessEgg.address_line_1,
		address_line_2: businessEgg.address_line_2,
		address_postal_code: businessEgg.address_postal_code,
		address_city: businessEgg.address_city,
		address_state: businessEgg.address_state,
		address_country: businessEgg.address_country,
		mobile: businessEgg.mobile,
		name: businessEgg.name,
		customer_id: metadata.customerID,
		official_website: businessEgg.official_website,
		dba_names: metadata.dba_names,
		mailing_addresses: metadata.mailing_addresses,
		case_type: CASE_TYPE.ONBOARDING
	};

	try {
		const validationResponse = await validateBusiness(businessID as UUID, validationRequest, applicantID, {
			shouldRunSerpSearch: true,
			authorization,
			isBulk: true,
			isAsync,
			userInfo: { user_id: metadata.userID ?? applicantID }
		});
		logger.debug({ validationResponse, businessID, message: "bulkCreateBusinessMap validation response" });
		mapper.addAdditionalMetadata({ businessValidationResponse: validationResponse?.message });
		if (
			isQuickAdd &&
			validationResponse?.data &&
			validationResponse.data.existing_business_found &&
			!validationResponse.data.is_business_applicant
		) {
			throw new BusinessApiError(
				"TIN already exists, Authentication required",
				StatusCodes.BAD_REQUEST,
				ERROR_CODES.INVALID,
				validationResponse.data
			);
		}
		if (validationResponse.data.business_merge) {
			mapper.addWarning(
				"The provided business data matches an existing business. The existing business record has been returned instead.  If changes are required, the UPDATE endpoint should be used."
			);
		}
		businessID = validationResponse.data.business_id ?? businessID;
	} catch (ex) {
		if (ex instanceof BusinessValidationError) {
			if (validationRequest.tin) {
				mapper.addWarning(`The provided TIN could not be verified: ${ex.message} `);
			} else {
				mapper.addWarning("A TIN was not specified: the business is UNVERIFIED");
			}
		}
		if (ex instanceof InternationalBusinessError) {
			throw ex;
		}
		logger.warn(
			`businessId=${businessID}; Unable to validate business data: ${
				ex instanceof Error ? ex.message : JSON.stringify(ex)
			}`
		);
	} finally {
		business = await businesses.getBusinessByID({ businessID });
	}

	try {
		await redis.sadd(`{customer}:${metadata.customerID}:businesses`, businessID);

		if (skipCreditCheck) {
			await onboarding.addOrUpdateCustomerBusinessConfigs(
				{ customerID: metadata.customerID, businessID },
				{ skip_credit_check: true },
				{ user_id: metadata.userID }
			);
		}

		if (bypassSsn) {
			await onboarding.addOrUpdateCustomerBusinessConfigs(
				{ customerID: metadata.customerID, businessID },
				{ bypass_ssn: true },
				{ user_id: metadata.userID }
			);
		}
	} catch (ex: unknown) {
		logger.error({
			ex,
			businessID,
			customerID: metadata.customerID,
			message: "Unable to add customer permission into redis"
		});
	}

	let newCase;
	const newCases = await caseManagementService.getCasesByBusinessId(business.id, {
		caseType: CASE_TYPE.ONBOARDING,
		customerId: metadata.customerID
	});
	const standaloneCases = await caseManagementService.getCasesByBusinessId(business.id, {
		caseType: CASE_TYPE.ONBOARDING,
		customerId: null
	});
	if (newCases.length > 0) {
		newCase = newCases[0];
	} else {
		const shouldPauseTransition = await getFlagValue(FEATURE_FLAGS.PAT_926_PAUSE_DECISIONING, {
			key: "customer",
			kind: "customer",
			customer_id: metadata.customerID
		});
		logger.warn(`businessId=${business.id}; Manually creating case`);
		const caseEgg: Case.Egg = {
			business_id: business.id,
			applicant_id: applicantID,
			customer_id: metadata.customerID,
			status: shouldPauseTransition ? CASE_STATUS.CREATED : CASE_STATUS.ONBOARDING,
			case_type: CASE_TYPE.ONBOARDING,
			created_by: metadata.userID,
			updated_by: metadata.userID,
			customer_initiated: true
		};
		const externalID = mapper
			.getMappedFields()
			.find(f => f.column === "external_id" && f.table === "rel_business_customer_monitoring")?.value;
		newCase = await caseManagementService.createCaseFromEgg(caseEgg);
		// send event only if the new case created
		await businesses
			.sendBusinessInvited(
				{
					businessID: business.id,
					applicantID: newCase.applicant_id,
					customerID: metadata.customerID,
					userID: metadata.userID,
					caseID: newCase.id
				},
				kafkaEvents.BUSINESS_INVITE_ACCEPTED,
				externalID
			)
			.catch(ex => logger.error({ error: ex }, "Exception sending business invite"));
	}
	const dataCases: any[] = [];
	if (newCase) {
		await businesses.updateBusinessDetails(
			{ address_country: businessEgg.address_country },
			{ case_id: newCase.id, businessID: business.id },
			{ user_id: metadata.userID }
		);
		dataCases.push(newCase);
	}
	// this Send functionality will send after all integrations done on integration_data table
	if (standaloneCases && standaloneCases.length > 0) {
		dataCases.push(standaloneCases[0]);
	}
	mapper.addAdditionalMetadata({ data_businesses: business, data_cases: dataCases, businessID: business.id });

	// Temporary hacky thing
	// @TODO: Cleanup: see PAT-995
	if (isCorporateEntity !== undefined) {
		await db("data_business_names")
			.where({ business_id: business.id })
			.update({ is_corporate_entity: isCorporateEntity });
	}
}
async function sanitizeTIN(mapper: Mapper, str: string): Promise<string | undefined> {
	if (!str) {
		return undefined;
	}

	const raw = str.toString().trim();

	// UK registration numbers - keep as-is
	if (
		UK_REGISTRATION_REGEX.UK_NINO.test(raw) ||
		UK_REGISTRATION_REGEX.UK_UTR.test(raw) ||
		UK_REGISTRATION_REGEX.UK_CRN.test(raw) ||
		UK_REGISTRATION_REGEX.UK_VAT.test(raw)
	) {
		return raw;
	}

	// Check if it's a US-style 9-digit TIN (with or without formatting)
	const digitsOnly = raw.replace(/\D/g, "");
	if (TAX_ID_VALIDATION_RULES.US.regex.test(digitsOnly)) {
		return digitsOnly.padStart(9, "0");
	}

	// For other countries, normalize to uppercase alphanumeric (1-22 chars)
	const alphanumeric = raw.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
	if (GLOBAL_TAX_ID_FALLBACK_REGEX.test(alphanumeric)) {
		return alphanumeric;
	}

	// Fallback: return digits-only padded to 9 (legacy behavior for edge cases)
	return digitsOnly.padStart(9, "0");
}
async function validateTIN(mapper: Mapper, field: MapperField<string>): Promise<void> {
	const value = field?.value?.toString().trim() ?? "";

	// UK registration numbers are valid
	if (
		UK_REGISTRATION_REGEX.UK_NINO.test(value) ||
		UK_REGISTRATION_REGEX.UK_UTR.test(value) ||
		UK_REGISTRATION_REGEX.UK_CRN.test(value) ||
		UK_REGISTRATION_REGEX.UK_VAT.test(value)
	) {
		return;
	}

	// US-style 9-digit TIN
	const digitsOnly = value.replace(/\D/g, "");
	if (TAX_ID_VALIDATION_RULES.US.regex.test(digitsOnly)) {
		return;
	}

	// Global fallback: 1-22 alphanumeric characters for non-US/non-UK countries
	const alphanumeric = value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
	assertTruthy(GLOBAL_TAX_ID_FALLBACK_REGEX.test(alphanumeric), field);
}

export function getBusinessFields(): MapperField[] {
	return [
		{
			column: "id",
			description: "The unique identifier of the business",
			alternate: ["business_id", "businessid"],
			table: "data_businesses",
			isReadonly: false
		},
		{ column: "updated_at", table: "data_businesses", private: true },
		{ column: "created_at", table: "data_businesses", private: true },
		{ column: "updated_by", table: "data_businesses", private: true },
		{ column: "created_by", table: "data_businesses", private: true },
		{ column: "status", description: "The status of the business", table: "data_businesses", private: true },
		{
			column: "name",
			alternate: ["company_name", "business_name"],
			description: "The name of the business",
			table: "data_businesses",
			required: true,
			sanitize: async (_, str) => str.toString().substring(0, 100).trim(),
			validate: async (_, field) =>
				assertTruthy(typeof field.value === "string" && field.value.length <= 100 && field.value.length > 2, field)
		} as MapperField<string>,
		{
			column: "tin",
			isSensitive: true,
			description: "The Tax Identification Number of the business",
			table: "data_businesses",
			alternate: ["tax_id"],
			dataType: "number",
			sanitize: sanitizeTIN,
			validate: validateTIN
		},
		{
			column: "address_line_1",
			description: "The first line of the business address",
			table: "data_businesses",
			alternate: [
				"address1",
				"business_street_address",
				"business_address_1",
				"business_address1",
				"business_address_line_1"
			],
			sanitize: async (_, str) => (str as string).toString().substring(0, 100).trim()
		},
		{
			column: "address_line_2",
			description: "The second line of the business address",
			table: "data_businesses",
			alternate: [
				"address2",
				"business_street_address_2",
				"business_street_address2",
				"businesss_address_2",
				"business_address2",
				"business_address_line2",
				"address_apartment"
			],
			sanitize: async (_, str) => (str as string).toString().substring(0, 100).trim()
		},
		{
			column: "address_city",
			description: "The city of the business address",
			table: "data_businesses",
			alternate: ["business_city"],
			sanitize: async (_, str) => (str as string).toString().substring(0, 25).trim()
		},
		{
		column: "address_state",
		description: "The state abbreviation of the business address",
		table: "data_businesses",
		alternate: ["business_state"],
		model_field: "state",
		// Accept 2-3 character state codes to support:
		// - US/CA: 2 characters (AL, CA, ON, BC, etc.)
		// - AU/NZ: 3 characters (NSW, VIC, QLD, AUK, BOP, etc.)
		validate: async (_, field) => assertTruthy(typeof field.value === "string" && field.value.length >= 2 && field.value.length <= 3, field),
		sanitize: async (mapper, str) => {
			const country =
				mapper.getMappedValueForColumn<string>("address_country", "data_businesses")
				?? (mapper as any).input?.get?.("address_country");
			return AddressUtil.sanitizeStateToAbbreviation(str, { countryCode: country });
		}
		},
		{
			column: "address_country",
			description: "The country code of the business address",
			table: "data_businesses",
			alternate: ["business_country", "business_country_code"],
			sanitize: async (_, str) => (str as string).toString().substring(0, 15).trim()
		},
		{
			column: "address_postal_code",
			description: "The postal code of the business address",
			table: "data_businesses",
			alternate: [
				"address_zip",
				"business_postal_code",
				"business_zip",
				"business_postal",
				"zip",
				"address_postalcode",
				"postalcode"
			],
			sanitize: async (mapper, str) => {
				// getMappedValueForColumn may be empty during resolve phase, so read from raw input as fallback
				const country =
					mapper.getMappedValueForColumn<string>("address_country", "data_businesses")
					?? (mapper as any).input?.get?.("address_country");
				return AddressUtil.sanitizePostalCode(country, (str as string).toString());
			}
		},
		{
			column: "mobile",
			description: "The phone number of the business",
			table: "data_businesses",
			alternate: ["phone"],
			sanitize: async (_, value: string) => sanitizePhoneNumber(value),
			validate: async (_, field) => {
				const val = field?.value ?? "";
				assertTruthy(field && (val.length === 11 || val.length === 12), field);
			}
		},
		{
			column: "official_website",
			description: "The website of the business",
			table: "data_businesses",
			alternate: ["website_url", "website", "url"],
			sanitize: async (_, str) => (str as string).toString().substring(0, 50).trim()
		},
		{
			column: "naics_code",
			sanitize: sanitizePositiveInteger,
			dataType: "number",
			description: "The North American Industry Classification System code of the business",
			table: "data_businesses"
		},
		{
			column: "naics_title",
			description: "The North American Industry Classification System title of the business",
			table: "data_businesses",
			sanitize: async (_, str) => (typeof str === "string" ? str.substring(0, 100).trim() : str)
		},
		{
			column: "mcc_code",
			description: "mcc code",
			alternate: ["mcc"],
			sanitize: sanitizePositiveInteger,
			table: "data_businesses",
			dataType: "number" as const
		},
		{
			column: "industry",
			description: "The industry of the business",
			table: "data_businesses",
			sanitize: sanitizeIndustryInput
		},
		{
			column: "quick_add",
			description: "Quick add of the business",
			table: "data_businesses",
			required: false,
			sanitize: async (_, value) => parseBool(value),
			validate: async (_, field) =>
				assertTruthy(typeof field.value === "boolean" && [true, false].includes(field.value), field)
		},
		{
			column: "skip_credit_check",
			description: "Skip Credit Checks for the business",
			table: "data_businesses",
			required: false,
			sanitize: async (_, value) => parseBool(value),
			validate: async (_, field) =>
				assertTruthy(typeof field.value === "boolean" && [true, false].includes(field.value), field)
		},
		{
			column: "bypass_ssn",
			description: "Skip Collecting SSNs",
			table: "data_businesses",
			required: false,
			sanitize: async (_, value) => parseBool(value),
			validate: async (_, field) =>
				assertTruthy(typeof field.value === "boolean" && [true, false].includes(field.value), field)
		},
		{
			column: "is_corporate_entity",
			description: "Whether the business is a corporate entity",
			table: "data_businesses",
			required: false,
			sanitize: async (_, value) => parseBool(value),
			validate: async (_, field) =>
				assertTruthy(typeof field.value === "boolean" && [true, false].includes(field.value), field)
		}
	];
}

async function sanitizeIndustryInput(mapper, value: any) {
	// Fetch known industry records from db and attempt to match the provided value
	const industryMap: Map<string, number> = await db("core_business_industries")
		.select("id", "name")
		.then(rows => new Map(rows.map(row => [row.name, row.id])));

	if (typeof value === "number") {
		//Make sure the provided number is a valid one
		const key = [...industryMap.values()].find(v => v === value);
		if (!key) {
			return null;
		}
		return key;
	} else {
		// make sure the provided industry name can be found in the map
		const fuse = new Fuse([...industryMap.keys()]);
		const resultValue = fuse.search(value);
		if (resultValue.length === 0) {
			return null;
		}
		return industryMap.get(resultValue[0].item) || null;
	}
}
