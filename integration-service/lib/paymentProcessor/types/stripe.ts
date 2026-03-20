import { IntegrationPlatformId } from "#constants";
import { UUID } from "crypto";
import { Stripe } from "stripe";
import type { PaymentProcessorAccountStatus } from "../paymentProcessorAccount.constants";

export type AccountInfo = {
	id?: UUID;
	customerId: UUID;
	accountId: string;
	businessId: UUID;
	profileId: UUID;
	platformId: IntegrationPlatformId;
	data: Stripe.Response<Stripe.Account>;
	processorId?: UUID;
	status?: PaymentProcessorAccountStatus;
	manualSyncAt?: Date;
	webhookReceivedAt?: Date;
};
export type PersonInfo = {
	personId: string;
	accountId: string;
	businessId: UUID;
	platformId: IntegrationPlatformId;
	data: Stripe.Response<Stripe.Person>;
};

export type AccountUpdateParams = Stripe.AccountUpdateParams;

export type CreateAccountContext = {
	profileId: UUID;
	customerId: UUID;
	businessId: UUID;
	payload: Partial<Stripe.AccountCreateParams>;
};

export type CreatePersonContext = Stripe.AccountCreatePersonParams;

export type OutstandingRequirements = Stripe.Account.Requirements;

export const StripeProcessorStatusFlag = {
	ACTIVE: "ACTIVE",
	NEEDS_REQUIREMENTS: "NEEDS_REQUIREMENTS",
	LIMITED: "LIMITED",
	RESTRICTED: "RESTRICTED",
	DISABLED: "DISABLED",
	UNKNOWN: "UNKNOWN"
} as const;

/**
 * Worth's unified processor status - used for API responses
 * These statuses align with PaymentProcessorAccountStatus for consistency.
 * The string values match the numeric enum keys for easy mapping.
 */
export const WorthProcessorStatus = {
	/** Initial/undetermined state */
	UNKNOWN: "UNKNOWN",
	/** Account is fully operational - charges and payouts enabled, all capabilities active */
	ACTIVE: "ACTIVE",
	/** Stripe is verifying submitted information */
	PENDING: "PENDING",
	/** Account has restrictions - charges or payouts disabled, or capabilities inactive */
	RESTRICTED: "RESTRICTED",
	/** Additional information is required from the user (currently_due, past_due, or external account issues) */
	INFO_REQUIRED: "INFO_REQUIRED",
	/** Account has been rejected by Stripe */
	REJECTED: "REJECTED"
} as const;

export type WorthProcessorStatus = (typeof WorthProcessorStatus)[keyof typeof WorthProcessorStatus];

/**
 * Pre-processor statuses for accounts that haven't been submitted to Stripe yet
 * These represent states before a Stripe account is created.
 */
export const WorthPreProcessorStatus = {
	/** Merchant profile exists but no Stripe account has been created */
	NOT_SUBMITTED: "NOT_SUBMITTED"
} as const;

export type WorthPreProcessorStatus = (typeof WorthPreProcessorStatus)[keyof typeof WorthPreProcessorStatus];

export type StripeProcessorStatusFlag = (typeof StripeProcessorStatusFlag)[keyof typeof StripeProcessorStatusFlag];

export type StripeCapabilityStatus = {
	name: keyof Stripe.Account.Capabilities;
	status: "active" | "inactive" | "pending";
};

export type StripeProcessorStatusSummary = {
	status: StripeProcessorStatusFlag;
	missingRequirements: string[];
	upcomingRequirements: string[];
	capabilities: StripeCapabilityStatus[];
	disabledReason: string | null;
	chargesEnabled: boolean;
	payoutsEnabled: boolean;
	reasons: string[];
};

export type StripeWebhookPayload = Stripe.Event | Stripe.Account | Record<string, unknown>;

export type CreateExternalAccountContext = Stripe.AccountCreateExternalAccountParams.BankAccount;

export type StripeTermsOfService = Stripe.Account.TosAcceptance;
