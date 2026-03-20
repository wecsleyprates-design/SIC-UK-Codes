import { Banking } from "#api/v1/modules/banking/banking";
import { INTEGRATION_ID, type IntegrationPlatformId } from "#constants";
import {
	BusinessDetails,
	BusinessOwner,
	CaseStatusDetails,
	getBusinessDetails,
	getBusinessFactsByKeys,
	getInternalCaseByBusinessId,
	logger
} from "#helpers";
import { enrichAccountsWithProcessorStatus } from "#lib/paymentProcessor/helpers/stripe";
import {
	stripeCapabilitiesSettings,
	stripeControllerSettings,
	stripeMccCodeSet,
	stripeSandboxBankAccount
} from "#lib/paymentProcessor/stripe.constants";
import * as MerchantProfileTypes from "#lib/paymentProcessor/types/merchantProfile";
import type * as StripeTypes from "#lib/paymentProcessor/types/stripe";
import { decryptData, encryptData } from "#utils/encryption";
import { UUID } from "crypto";
import _ from "lodash";
import { MerchantProfile } from "./merchantProfile";

const NOT_READY_TO_ONBOARD_STATUSES = ["INVITED", "ONBOARDING", "CREATED"];

export class MerchantProfileConverter {
	public customerId: UUID;
	public static MERCHANT_PROFILE_FACTS = ["mcc_code", "business_website", "business_phone", "tin"];

	constructor(customerId: UUID) {
		this.customerId = customerId;
	}

	async createMerchantProfile(
		params: MerchantProfileTypes.CreateMerchantProfileParams["params"],
		stripeContext: MerchantProfileTypes.MerchantProfileStripeContext | undefined
	): Promise<MerchantProfile> {
		// Fetch all necessary data in parallel
		// These can individually fail without impacting each other but failing
		// means we won't have that data in the final profile from that resource.
		const [bankingInfo, businessFacts, businessDetails] = await Promise.all([
			this.getBankingAccounts(params.businessId, params.banking.bankId, params.banking.bankType),
			this.getBusinessFacts(params.businessId),
			this.getBusinessDetails(params.businessId)
		]);

		const merchantProfileDetail = {
			banking_info: bankingInfo,
			facts: businessFacts,
			details: businessDetails
		};

		return new MerchantProfile(this.customerId, merchantProfileDetail.details.id as UUID, params.platformId, {
			business_name: merchantProfileDetail.details.name,
			business_website: merchantProfileDetail.facts["business_website"] || null,
			address_line_1: merchantProfileDetail.details.address_line_1,
			address_line_2: merchantProfileDetail.details.address_line_2 || null,
			address_city: merchantProfileDetail.details.address_city,
			address_state: merchantProfileDetail.details.address_state,
			address_postal_code: merchantProfileDetail.details.address_postal_code,
			country: "US",
			tin: merchantProfileDetail.details.tin || merchantProfileDetail.facts["tin"] || null,
			mcc_code: MerchantProfileConverter.validateMccCode(merchantProfileDetail.facts["mcc_code"]),
			business_phone: merchantProfileDetail.facts["business_phone"] || null,
			banking_info: merchantProfileDetail.banking_info,
			people: { owners: merchantProfileDetail.details.owners || [] },
			// If we are creating a Stripe profile, we prepare the Stripe context
			// otherwise, stripe will be undefined
			stripe: stripeContext
		});
	}

	public toStripeCreateAccountFormat(
		merchantProfile: MerchantProfile,
		stripeTestMode: boolean = false
	): StripeTypes.CreateAccountContext {
		if (!merchantProfile.profile.stripe) {
			// This should never happen as this method should only be called for Stripe profiles
			// we want to throw an exception given the unexpected state.
			throw new Error(
				"Cannot convert to Stripe CreateAccountContext when MerchantProfile does not have Stripe context."
			);
		}

		return {
			profileId: merchantProfile.profileId,
			customerId: this.customerId,
			businessId: merchantProfile.businessId,
			payload: {
				business_profile: {
					name: merchantProfile.profile.business_name,
					url: merchantProfile.profile.business_website,
					mcc: merchantProfile.profile.mcc_code || undefined,
					support_phone: merchantProfile.profile.business_phone || undefined
				},
				company: {
					name: merchantProfile.profile.business_name,
					address: {
						line1: merchantProfile.profile.address_line_1,
						line2: merchantProfile.profile.address_line_2 || undefined,
						city: merchantProfile.profile.address_city,
						state: merchantProfile.profile.address_state,
						postal_code: merchantProfile.profile.address_postal_code,
						country: merchantProfile.profile.country
					},
					tax_id: merchantProfile.profile.tin
				},
				// This sets the default external account (Bank Account) during account creation
				external_account:
					this.toStripeExternalAccountFormat(merchantProfile.profile.banking_info, stripeTestMode) || undefined,
				business_type: "company",
				tos_acceptance: this.toStripeTermsOfService(merchantProfile.profile.tos_acceptance),
				country: merchantProfile.profile.country,
				...merchantProfile.profile.stripe,
				...stripeControllerSettings,
				...merchantProfile.profile.stripe.groups
			}
		} as StripeTypes.CreateAccountContext;
	}

	public toStripePersonsContext(businessOwners: BusinessOwner[]): StripeTypes.CreatePersonContext[] {
		const representativeIndex = this.findRepresentativeIndex(businessOwners);

		return businessOwners.map((owner, index) => {
			const dob = owner.date_of_birth ? new Date(owner.date_of_birth) : null;

			return {
				first_name: owner.first_name ?? undefined,
				last_name: owner.last_name ?? undefined,
				address: {
					line1: owner.address_line_1 ?? undefined,
					city: owner.address_city ?? undefined,
					state: owner.address_state ?? undefined,
					postal_code: owner.address_postal_code ?? undefined,
					country: "US"
				},
				dob: dob
					? {
							day: dob.getUTCDate(),
							month: dob.getUTCMonth() + 1,
							year: dob.getUTCFullYear()
						}
					: undefined,
				phone: owner.mobile ?? undefined,
				relationship: {
					owner: true,
					percent_ownership: owner?.ownership_percentage ?? undefined,
					title: owner?.title?.title ?? undefined,
					representative: index === representativeIndex
				},
				ssn_last_4: owner.ssn?.slice(-4),
				email: owner?.email ?? undefined
			};
		});
	}

	toStripeExternalAccountFormat(
		bankInfo: MerchantProfileTypes.BankingInfo | null,
		stripeTestMode: boolean = false
	): StripeTypes.CreateExternalAccountContext | null {
		if (!bankInfo) {
			return null;
		}

		if (!bankInfo?.account_number) {
			return null;
		}

		// In non-production environments, we use a mock bank account to avoid using real bank details
		// Stripe will also reject Bank accounts without the Test Bank Account numbers with Sandbox Keys.
		if (stripeTestMode) {
			return stripeSandboxBankAccount;
		}

		return {
			object: "bank_account",
			country: "US",
			currency: "USD",
			routing_number: bankInfo?.routing_number === null ? undefined : bankInfo?.routing_number,
			account_number: bankInfo?.account_number as string
			// TODO: We currently don't store account_holder_name and account_holder_type in our banking accounts.
			// account_holder_name: profile.business_name,
			// account_holder_type: "company"
		};
	}
	private async getBusinessDetailsList(businessIds: UUID[]): Promise<BusinessDetails[]> {
		return _.map(businessIds, async (business_id: UUID) => {
			try {
				const businessDetailsResponse = await getBusinessDetails(business_id);
				if (businessDetailsResponse.status === "success") {
					return businessDetailsResponse.data;
				}
			} catch (error) {
				logger.error({ error }, `Error fetching business details for ID ${business_id}`);
			}
		});
	}

	private async getCaseStatusDetails(businessId: UUID): Promise<CaseStatusDetails | null> {
		try {
			const caseStatusDetails: CaseStatusDetails[] = (await getInternalCaseByBusinessId(businessId)).filter(
				caseItem => caseItem.case_type === 1
			);

			if (caseStatusDetails.length > 1) {
				return caseStatusDetails.reduce((latest, current) =>
					new Date(current.created_at) > new Date(latest.created_at) ? current : latest
				);
			}
			return caseStatusDetails.pop() || null;
		} catch (error) {
			logger.error({ error: error }, `Error fetching case status details for business ID ${businessId}`);
			return null;
		}
	}

	private async getBusinessDetails(businessId: UUID): Promise<BusinessDetails> {
		const businessDetailsResponse = await getBusinessDetails(businessId);
		if (businessDetailsResponse.status === "success") {
			return businessDetailsResponse.data;
		}
		throw new Error(`Failed to fetch business details for ID ${businessId}`);
	}

	private async getBankingAccounts(
		businessId: UUID,
		bankId: UUID,
		bankType: string
	): Promise<MerchantProfileTypes.BankingInfo | null> {
		const banking = new Banking();
		const bankingInfo = await banking.getAllBankingAccounts({ businessID: businessId }, { case_id: undefined });

		if (!bankingInfo.accounts) {
			return null;
		}

		const [primaryBank] = bankingInfo.accounts.filter(account => account.id === bankId);

		if (!primaryBank) {
			return null;
		}

		return {
			bank_id: primaryBank.id,
			account_number: primaryBank.bank_account,
			routing_number: primaryBank.routing_number,
			country: "US",
			currency: "USD",
			account_type: primaryBank.type,
			subtype: primaryBank.subtype,
			is_deposit_account: primaryBank.is_deposit_account
			// TODO: We currently don't store account_holder_name and account_holder_type in our banking accounts.
		};
	}

	async getBusinessFacts(businessId: UUID): Promise<Record<string, any>> {
		try {
			return await getBusinessFactsByKeys(businessId, MerchantProfileConverter.MERCHANT_PROFILE_FACTS);
		} catch (error) {
			logger.error({ error }, `Error fetching business facts for ID ${businessId}`);
			return {};
		}
	}

	private findRepresentativeIndex(owners: BusinessOwner[]): number {
		// 1. Prefer CONTROL owner
		const controlIndex = owners.findIndex(o => o.owner_type === "CONTROL");
		if (controlIndex !== -1) {
			return controlIndex;
		}

		// 2. Single owner
		if (owners.length === 1) {
			return 0;
		}

		// 3. Fallback: last owner
		return owners.length - 1;
	}

	static toApiResponse(merchantProfile: MerchantProfile): MerchantProfileTypes.MerchantProfileApiResponse {
		if (!merchantProfile.profileId) {
			throw new Error("Cannot convert to GetMerchantProfileResponse it has not been persisted yet.");
		}

		const protectedProfile = MerchantProfileConverter.toProtectedProfile(merchantProfile.profile);

		// Enrich accounts with processor_status using the centralized helper
		// Empty accounts array indicates NOT_SUBMITTED state (no Stripe account created yet)
		const accountsWithStatus = enrichAccountsWithProcessorStatus(merchantProfile.accounts as Record<string, any>[]);

		return {
			profile_id: merchantProfile.profileId as UUID, // profileId is guaranteed to be present here
			business_id: merchantProfile.businessId,
			customer_id: merchantProfile.customerId,
			platform_id: merchantProfile.platformId,
			created_at: merchantProfile.createdAt,
			updated_at: merchantProfile.updatedAt,
			profile: protectedProfile,
			accounts: accountsWithStatus
		};
	}

	static fromProtectedProfile(profile: MerchantProfileTypes.Profile): MerchantProfileTypes.Profile {
		if (profile.banking_info?.account_number) {
			profile.banking_info.account_number = decryptData(profile.banking_info.account_number);
		}

		if (profile.banking_info?.routing_number) {
			profile.banking_info.routing_number = decryptData(profile.banking_info.routing_number);
		}

		if (profile.people.owners.length > 0) {
			profile.people.owners = profile.people.owners.map((owner: BusinessOwner) => {
				if (owner.ssn) {
					owner.ssn = decryptData(owner.ssn);
				}
				return owner;
			});
		}

		return profile;
	}

	static toProtectedProfile(profile: MerchantProfileTypes.Profile): MerchantProfileTypes.Profile {
		if (profile.banking_info?.account_number) {
			profile.banking_info.account_number = encryptData(profile.banking_info.account_number);
		}

		if (profile.banking_info?.routing_number) {
			profile.banking_info.routing_number = encryptData(profile.banking_info.routing_number);
		}

		if (profile.people.owners.length > 0) {
			profile.people.owners = profile.people.owners.map(owner => {
				if (owner.ssn) {
					owner.ssn = encryptData(owner.ssn);
				}
				return owner;
			});
		}

		return profile;
	}
	static prepareStripeContext(
		platformId: IntegrationPlatformId,
		capabilities: MerchantProfileTypes.MerchantProfileStripeContext["capabilities"] = stripeCapabilitiesSettings.capabilities,
		paymentGroupId: string
	): MerchantProfileTypes.MerchantProfileStripeContext | undefined {
		// If the platform is not Stripe, we do not prepare the Stripe context
		if (platformId !== INTEGRATION_ID.STRIPE) {
			return undefined;
		}

		const stripeContext: MerchantProfileTypes.MerchantProfileStripeContext = {
			capabilities: capabilities
			//TODO: Uncomment when we have payment groups implemented and preview feature
			// enabled in Stripe account
			// groups: {
			// 	payments_pricing: paymentGroupId
			// }
		};
		return stripeContext;
	}

	static validateMccCode(mccCode: string | null | undefined): string | null {
		// TODO: Add a method that validates MCC codes against different payment processor accepted codes
		// Currently only validating against Stripe MCC codes
		if (!mccCode) {
			return null;
		}
		return stripeMccCodeSet.has(mccCode) ? mccCode : null;
	}

	public async isReadyToOnboard(profile: MerchantProfile): Promise<MerchantProfileTypes.ReadyToOnboardStatus> {
		const caseStatusDetails = await this.getCaseStatusDetails(profile.businessId);

		if (!caseStatusDetails) {
			return { reason: "No case found for business", ready: false };
		}

		if (NOT_READY_TO_ONBOARD_STATUSES.includes(caseStatusDetails.status.label)) {
			return { reason: `${caseStatusDetails.status.label}`, ready: false };
		}
		return { reason: null, ready: true };
	}

	public static async generateMerchantProfileOnboardContext(
		profiles: MerchantProfile[],
		force: boolean = false
	): Promise<MerchantProfileTypes.MerchantProfileOnboardContext> {
		if (force) {
			return {
				profilesReadyToOnboard: profiles,
				profilesNotReadyToOnboard: []
			};
		}

		const readyToOnboardStatuses = await Promise.all(
			profiles.map(async profile => {
				return {
					profile: profile,
					status: await profile.isReadyToOnboard()
				};
			})
		);

		const profilesReadyToOnboardContext = {
			profilesReadyToOnboard: [],
			profilesNotReadyToOnboard: []
		} as MerchantProfileTypes.MerchantProfileOnboardContext;
		for (const item of readyToOnboardStatuses) {
			if (item.status.ready) {
				profilesReadyToOnboardContext.profilesReadyToOnboard.push(item.profile);
			} else {
				profilesReadyToOnboardContext.profilesNotReadyToOnboard.push({
					profile: item.profile,
					reason: item.status.reason || "Undeterminable Case Status"
				});
			}
		}

		return profilesReadyToOnboardContext;
	}

	public toTermsOfService(input: MerchantProfileTypes.TermsOfServiceInput): MerchantProfileTypes.TermsOfService {
		return {
			accepted_at: new Date(),
			ip_address: input.ip_address,
			user_agent: input.user_agent,
			service_agreement: "full"
		};
	}

	private toStripeTermsOfService(
		tos: MerchantProfileTypes.TermsOfService | undefined
	): StripeTypes.StripeTermsOfService | undefined {
		if (!tos) {
			return undefined;
		}
		return {
			date: Math.floor(tos.accepted_at.getTime() / 1000), // Stripe expects this as a Unix timestamp in seconds
			ip: tos.ip_address,
			service_agreement: tos.service_agreement,
			user_agent: tos.user_agent
		};
	}
}
