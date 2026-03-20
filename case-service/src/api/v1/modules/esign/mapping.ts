import { DepositAccountInfo } from "#helpers";
import { Business } from "#types";
import { CustomFields, ProcessingHistoryData } from "../businesses/types";
import { type Applicant } from "./types";
import { type MappingFields } from "./constants";

export class Mapping {
	static getBusinessMapping = (
		body: Business.WithSubscription & Business.WithBusinessNames & Business.WithBusinessAddresses & Business.WithOwners
	): Partial<Record<MappingFields, any>> => {
		const mappedJson: Partial<Record<MappingFields, any>> = {
			company_name: body.name,
			tin: body.tin ? body.tin : null,
			dba1_name: body.business_names
				? (body.business_names.find(nameObj => nameObj.is_primary === false)?.name ?? body.name)
				: body.name,
			location_address: body.address_line_1 ?? null,
			address_city: body.address_city ?? null,
			address_state: body.address_state ?? null,
			address_postal_code: body.address_postal_code ?? null,
			mobile: body.mobile ?? null,
			official_website: body.official_website ? body.official_website : null,
			mcc_code: body.mcc_id ? body.mcc_id : null
		};

		if (body.business_addresses && Array.isArray(body.business_addresses) && body.business_addresses.length > 0) {
			const secondaryAddress = body.business_addresses.find(address => address.is_primary === false);
			mappedJson.address1_line1 = secondaryAddress?.line_1 ?? null;
			mappedJson.address1_city = secondaryAddress?.city ?? null;
			mappedJson.address1_state = secondaryAddress?.state ?? null;
			mappedJson.address1_postal_code = secondaryAddress?.postal_code ?? null;
		}

		if (body.owners && Array.isArray(body.owners) && body.owners.length > 0) {
			// Find the control owner and map as owner1
			const controlOwner = body.owners.find(owner => owner.owner_type === "CONTROL");
			const remainingOwners = body.owners.filter(owner => owner.owner_type !== "CONTROL");

			if (controlOwner) {
				// Map control owner as owner1
				mappedJson.owner1_first_name = controlOwner.first_name ?? null;
				mappedJson.owner1_last_name = controlOwner.last_name ?? null;
				mappedJson.owner1_ownership_percentage = controlOwner.ownership_percentage?.toString() ?? null;
				mappedJson.owner1_title = controlOwner.title?.title ?? null;
				mappedJson.owner1_dob = controlOwner.date_of_birth ?? null;
				mappedJson.owner1_ssn = controlOwner.ssn ?? null;
				mappedJson.owner1_address_line_1 = controlOwner.address_line_1 ?? null;
				mappedJson.owner1_address_city = controlOwner.address_city ?? null;
				mappedJson.owner1_address_state = controlOwner.address_state ?? null;
				mappedJson.owner1_address_postal_code = controlOwner.address_postal_code ?? null;
				// FSA MPA owner1 uses _address_postal suffix
				mappedJson.owner1_address_postal = controlOwner.address_postal_code ?? null;
				mappedJson.owner1_owner_type = "YES";
				mappedJson.controlling_owner_home_phone = controlOwner.mobile ?? null;
				mappedJson.owner1_mobile = controlOwner.mobile ?? null;
				mappedJson.owner1_email = controlOwner.email ?? null;
			}

			// Map non-control owners starting from owner2
			for (let i = 0; i < remainingOwners.length; i++) {
				const ownerIndex = i + 2; // Start from owner2
				const owner = remainingOwners[i];

				mappedJson["owner" + ownerIndex + "_first_name"] = owner?.first_name ?? null;
				mappedJson["owner" + ownerIndex + "_last_name"] = owner?.last_name ?? null;
				mappedJson["owner" + ownerIndex + "_ownership_percentage"] = owner?.ownership_percentage?.toString() ?? null;
				mappedJson["owner" + ownerIndex + "_title"] = owner?.title?.title ?? null;
				mappedJson["owner" + ownerIndex + "_mobile"] = owner?.mobile ?? null;
				mappedJson["owner" + ownerIndex + "_email"] = owner?.email ?? null;
				mappedJson["owner" + ownerIndex + "_dob"] = owner?.date_of_birth ?? null;
				mappedJson["owner" + ownerIndex + "_ssn"] = owner?.ssn ?? null;
				mappedJson["owner" + ownerIndex + "_address_line_1"] = owner?.address_line_1 ?? null;
				mappedJson["owner" + ownerIndex + "_address_city"] = owner?.address_city ?? null;
				mappedJson["owner" + ownerIndex + "_address_state"] = owner?.address_state ?? null;
				mappedJson["owner" + ownerIndex + "_address_postal_code"] = owner?.address_postal_code ?? null;
			}
		}

		return mappedJson;
	};

	static getApplicantMapping = (applicantData: Applicant[]): Partial<Record<MappingFields, any>> => {
		const mappedJson: Record<string, string | null> = {
			applicant_name: applicantData[0].first_name ?? null,
			applicant_email: applicantData[0].email ?? null,
			applicant_mobile: applicantData[0].mobile ?? null
		};

		return mappedJson;
	};

	static getCustomFieldsMapping = (customFieldsData: CustomFields[]): Partial<Record<MappingFields, any>> => {
		const customFieldsMapping: Record<string, string | null> = {};

		customFieldsData.forEach(fieldObject => {
			customFieldsMapping[fieldObject.field] = fieldObject.value;
		});

		return { custom_fields: customFieldsMapping };
	};

	static getDepositAccountMapping = (depositAccounts: DepositAccountInfo): Partial<Record<MappingFields, any>> => {
		const depositAccountMapping: Record<string, string | null> = {};

		if (depositAccounts && Array.isArray(depositAccounts.accounts) && depositAccounts.accounts.length > 0) {
			depositAccountMapping.bank_account_type = depositAccounts.accounts[0].subtype ?? null;
			depositAccountMapping.bank_name = depositAccounts.accounts[0].name ?? null;
		}

		if (depositAccounts && Array.isArray(depositAccounts.numbers.ach) && depositAccounts.numbers.ach.length > 0) {
			// need the raw routing and account numbers, not the encrypted ones
			depositAccountMapping.bank_routing_number = depositAccounts.numbers.ach[0].routing ?? null;
			depositAccountMapping.bank_account_number = depositAccounts.numbers.ach[0].account ?? null;
		}

		return depositAccountMapping;
	};

	static getBusinessDataProcessingHistoryMapping = (
		dataProcessingHistoryData: ProcessingHistoryData[]
	): Partial<Record<MappingFields, any>> => {
		if (!dataProcessingHistoryData || dataProcessingHistoryData.length === 0) {
			return {};
		}

		const dataProcessingHistory = dataProcessingHistoryData[0];
		const mappedJson: Record<string, string | number | null> = {
			annual_v_mc_dis_volume: dataProcessingHistory.card_data?.annual_volume ?? null,
			annual_amex_volume: dataProcessingHistory.american_express_data?.annual_volume ?? null,
			avg_ticket: dataProcessingHistory.general_data?.average_ticket_size ?? null,
			high_ticket: dataProcessingHistory.general_data?.high_ticket_size ?? null,
			occurance_of_high_ticket: dataProcessingHistory.general_data?.monthly_occurrence_of_high_ticket ?? null,
			explanation_of_high_ticket: dataProcessingHistory.general_data?.explanation_of_high_ticket ?? null,
			high_volume_months: dataProcessingHistory.seasonal_data?.high_volume_months ?? null,
			explanation_of_high_months: dataProcessingHistory.seasonal_data?.explanation_of_high_volume_months ?? null
		};
		return mappedJson;
	};

	static getKybFactsMapping = (factsData): Partial<Record<MappingFields, any>> => {
		const kybFactsMapping: Record<string, string | null> = {
			formation_state: factsData?.formation_state?.value ?? null
		};

		return kybFactsMapping;
	};
}
