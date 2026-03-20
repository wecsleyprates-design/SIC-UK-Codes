import { MerchantProfile } from "#lib/paymentProcessor/merchantProfile";
import { IntegrationPlatformId } from "#constants";
import { BusinessOwner } from "#helpers";
import * as StripeTypes from "#lib/paymentProcessor/types/stripe";
import { WorthPreProcessorStatus, WorthProcessorStatus } from "#lib/paymentProcessor/types/stripe";
import { UUID } from "crypto";

export type Profile = {
	business_name: string;
	business_website: string | null;
	business_phone: string | null;
	address_line_1: string;
	address_line_2?: string | null;
	address_city: string;
	address_state: string;
	address_postal_code: string;
	country: string;
	tin: string | null;
	mcc_code: string | null;
	people: {
		owners: BusinessOwner[];
	};
	banking_info: BankingInfo | null;
	tos_acceptance?: TermsOfService;
	stripe?: MerchantProfileStripeContext;
};

export type BankingInfo = {
	bank_id: UUID;
	account_number: string;
	routing_number: string | null;
	account_type: string;
	subtype: string;
	is_deposit_account: boolean;
	country: "US";
	currency: "USD";
	account_holder_name?: string;
	account_holder_type?: "individual" | "company";
};

export type CreateMerchantProfileParams = {
	customerId: UUID;
	params: {
		businessId: UUID;
		platformId: IntegrationPlatformId;
		banking: {
			bankId: UUID;
			bankType: string;
		};
	};
};

export type MerchantProfileCreateRequest = {
	processorId: UUID;
	capabilities: MerchantProfileStripeContext["capabilities"];
	platformId: IntegrationPlatformId;
	onboardImmediately: boolean;
	paymentGroupId: string;
	businesses: CreateMerchantProfileParams[];
};

export type MerchantProfileApiResponse = {
	profile_id?: UUID;
	business_id: UUID;
	customer_id: UUID;
	platform_id: IntegrationPlatformId | null;
	created_at?: Date;
	updated_at?: Date;
	profile: Profile;
	accounts: MerchantProfileAccounts;
};

export type MerchantProfileStripeContext = {
	capabilities: {
		card_payments: { requested: boolean };
		transfers: { requested: boolean };
		us_bank_account_ach_payments: { requested: boolean };
	};
	groups?: {
		payments_pricing: string;
	};
};

/**
 * Account element with derived processor status for API responses
 */
export type MerchantProfileAccountWithStatus = {
	account_id?: string;
	processor_account_id?: string;
	status?: number;
	account?: Record<string, any> | null;
	/** Human-readable processor account status for display */
	processor_status: WorthProcessorStatus | WorthPreProcessorStatus;
};

export type MerchantProfileAccounts = Array<
	Partial<StripeTypes.AccountInfo> | MerchantProfileAccountWithStatus | Record<string, any>
>;

export type ReadyToOnboardStatus = {
	reason: string | null;
	ready: boolean;
};

export type MerchantProfileOnboardContext = {
	profilesReadyToOnboard: MerchantProfile[];
	profilesNotReadyToOnboard: ProfilesNotReadyToOnboard;
};

export type ProfilesNotReadyToOnboard = {
	profile: MerchantProfile;
	reason: string;
}[];

export type TermsOfService = {
	accepted_at: Date;
	ip_address: string;
	user_agent: string;
	service_agreement: string;
};

export type TermsOfServiceInput = {
	accepted: boolean;
	ip_address: string;
	user_agent: string;
};
