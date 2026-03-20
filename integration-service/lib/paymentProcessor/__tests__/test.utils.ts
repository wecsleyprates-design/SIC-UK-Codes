import { INTEGRATION_ID, type IntegrationPlatformId } from "#constants";
import { BusinessDetails, CaseStatusDetails } from "#helpers/api";
import { TDateISO } from "#types";
import { randomUUID } from "crypto";
import { MerchantProfile } from "../merchantProfile";
import { BankingInfo, Profile } from "../types/merchantProfile";
import { stripeMccCodeSet } from "../stripe.constants";

const StatusCodeLookup = {
	ONBOARDING: 3,
	INVITED: 1,
	CREATED: 20
};

export const generateMerchantProfiles = (
	count: number,
	platformId: IntegrationPlatformId = INTEGRATION_ID.STRIPE,
	withProfileId: boolean = false,
	withTimestamps: boolean = false,
	withStripeContext: boolean = true
): MerchantProfile[] => {
	const profiles: MerchantProfile[] = [];
	for (let i = 0; i < count; i++) {
		const profile = new MerchantProfile(
			randomUUID(),
			randomUUID(),
			platformId,
			{
				business_name: `Test Business ${i}`,
				business_website: `https://www.testbusiness${i}.com`,
				address_line_1: `123 Test St Apt ${i}`,
				address_city: "Test City",
				address_state: "TS",
				address_postal_code: `${i}`.padStart(5, "0"),
				country: "US",
				tin: `12-34567${i}`,
				mcc_code: "5734",
				business_phone: `555-000${i}`,
				people: {
					owners: [
						{
							owner_type: "individual",
							first_name: `Owner ${i}`,
							last_name: "Test",
							address_line_1: `123 Owner St`,
							address_city: "Owner City",
							address_state: "OS",
							address_postal_code: "54321",
							address_country: "US",
							date_of_birth: "1980-01-01",
							ssn: "123345678",
							mobile: `555-555-5555`,
							ownership_percentage: 60,
							email: `owner${i}@testbusiness.com`,
							title: {
								id: 1,
								title: `Owner${i}`
							}
						}
					]
				},
				banking_info: {
					bank_id: randomUUID(),
					account_number: `00012345${i}`,
					routing_number: "110000000",
					country: "US",
					currency: "USD",
					is_deposit_account: true,
					account_holder_name: `Some Guy ${i}`,
					account_holder_type: "individual"
				},
				stripe:
					withStripeContext && platformId === INTEGRATION_ID.STRIPE
						? {
								capabilities: {
									card_payments: { requested: true },
									transfers: { requested: true },
									us_bank_account_ach_payments: { requested: true }
								}
								// TODO: Uncomment when payment groups are implemented
								// groups: {
								// 	payments_pricing: "pricing_group_test"
								// }
							}
						: undefined
			} as Profile,
			withProfileId ? randomUUID() : undefined,
			withTimestamps ? new Date() : undefined,
			withTimestamps ? new Date() : undefined
		);
		profiles.push(profile);
	}
	return profiles;
};

export const generateFacts = (shouldBeEmpty: boolean, shouldBeNull) => {
	if (shouldBeEmpty) {
		return {};
	}

	if (shouldBeNull) {
		return {
			mcc_code: null,
			business_phone: null,
			business_website: null,
			tin: null
		};
	}

	return {
		mcc_code: "5734",
		business_phone: "555-0000",
		business_website: "https://www.testbusiness.com",
		tin: "12-3456789"
	};
};

export const generateCaseStatusDetails = (status: string): CaseStatusDetails => {
	return {
		id: randomUUID(),
		applicant_id: randomUUID(),
		business_name: "Test Business",
		created_at: new Date().toISOString() as TDateISO,
		case_type: 1,
		applicant: {
			first_name: "Test",
			last_name: "User"
		},
		status_label: status,
		status: {
			id: StatusCodeLookup[status as keyof typeof StatusCodeLookup] || -1,
			label: status,
			code: status
		}
	};
};

export const generateBusinessDetails = (): BusinessDetails => {
	return {
		id: randomUUID() as string,
		name: `Test Business ${randomUUID()}`,
		official_website: "https://www.testbusiness.com",
		public_website: "https://www.testbusiness.com",
		social_account: "https://www.twitter.com/testbusiness",
		mcc_id: "1",
		mcc_code: stripeMccCodeSet[0],
		mcc_title: "Computer Software Stores",
		mobile: "555-0000",
		address_line_1: "123 Test St",
		address_line_2: null,
		address_postal_code: "12345",
		address_city: "Test City",
		address_state: "TS",
		address_country: "US",
		tin: "12-3456789",
		status: "active",
		subscription: {
			status: "active",
			created_at: "2024-01-01T00:00:00.000Z",
			updated_at: "2024-01-01T00:00:00.000Z"
		},
		business_names: [
			{ name: `Test Business LLC ${randomUUID()}`, is_primary: true },
			{ name: `Test Business Inc ${randomUUID()}`, is_primary: false }
		],
		business_addresses: [
			{
				line_1: "123 Test St",
				apartment: null,
				postal_code: "12345",
				city: "Test City",
				state: "TS",
				country: "US",
				is_primary: true,
				mobile: "555-0000"
			}
		],
		owners: [
			{
				owner_type: "CONTROL",
				first_name: "Owner",
				last_name: "Test",
				date_of_birth: "1980-01-01",
				ssn: "123345678",
				mobile: "555-555-5555",
				address_line_1: "123 Owner St",
				address_city: "Owner City",
				address_state: "OS",
				address_postal_code: "54321",
				address_country: "US",
				ownership_percentage: 60,
				email: "owner1@someemail.com",
				title: {
					id: 1,
					title: "Owner"
				}
			},
			{
				owner_type: "OTHER",
				first_name: "CoOwner",
				last_name: "Test",
				date_of_birth: "1985-05-05",
				ssn: "987654321",
				mobile: "555-555-5556",
				address_line_1: "456 CoOwner St",
				address_city: "CoOwner City",
				address_state: "CS",
				address_postal_code: "67890",
				address_country: "US",
				ownership_percentage: 40,
				email: "owner2@someemail.com",
				title: {
					id: 2,
					title: "Co-Owner"
				}
			}
		],
		created_at: "2024-01-01T00:00:00.000Z" as TDateISO,
		updated_at: "2024-01-01T00:00:00.000Z" as TDateISO,
		created_by: randomUUID() as string,
		updated_by: randomUUID() as string
	};
};

export const generateBankingInfo = (num: number): BankingInfo[] => {
	let bankInfo = new Array<BankingInfo>();
	for (let i = 0; i < num; i++) {
		const bank: BankingInfo = {
			bank_id: randomUUID(),
			account_number: `00012345${i}`,
			routing_number: "110000000",
			account_type: "depository",
			subtype: "checking",
			is_deposit_account: true,
			country: "US",
			currency: "USD",
			account_holder_name: `Some Guy ${i}`,
			account_holder_type: "individual"
		};
		bankInfo.push(bank);
	}
	return bankInfo;
};
