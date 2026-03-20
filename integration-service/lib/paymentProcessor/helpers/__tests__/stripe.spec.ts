import type Stripe from "stripe";
import { collapseStripeAccountStatus, mapStripeStatusToAccountStatus } from "../stripe";
import { PaymentProcessorAccountStatus } from "../../paymentProcessorAccount.constants";
import { StripeProcessorStatusFlag, type StripeProcessorStatusSummary } from "../../types/stripe";

const buildAccount = (overrides: Partial<Stripe.Account> = {}): Stripe.Account => {
	const baseAccount: Partial<Stripe.Account> = {
		id: "acct_test",
		object: "account",
		country: "US",
		type: "custom",
		charges_enabled: true,
		payouts_enabled: true,
		details_submitted: true,
		capabilities: {
			card_payments: "active",
			transfers: "active"
		},
		requirements: {
			alternatives: [],
			current_deadline: null,
			disabled_reason: null,
			currently_due: [],
			eventually_due: [],
			past_due: [],
			pending_verification: [],
			errors: []
		},
		future_requirements: {
			alternatives: [],
			current_deadline: null,
			disabled_reason: null,
			currently_due: [],
			eventually_due: [],
			past_due: [],
			pending_verification: [],
			errors: []
		},
		business_profile: {} as Stripe.Account.BusinessProfile,
		business_type: "company",
		company: {} as Stripe.Account.Company,
		controller: undefined,
		default_currency: "usd",
		email: null,
		external_accounts: {} as Stripe.ApiList<Stripe.ExternalAccount>,
		metadata: {},
		settings: {} as Stripe.Account.Settings,
		tos_acceptance: {} as Stripe.Account.TosAcceptance
	};

	return {
		...baseAccount,
		...overrides
	} as Stripe.Account;
};

describe("collapseStripeAccountStatus", () => {
	it("returns UNKNOWN when payload does not contain an account", () => {
		const event = {
			id: "evt_123",
			object: "event",
			data: { object: { object: "setup_intent" } }
		} as unknown as Stripe.Event;

		const result = collapseStripeAccountStatus(event);

		expect(result.status).toBe(StripeProcessorStatusFlag.UNKNOWN);
		expect(result.reasons).toContain("account_not_found");
	});

	it("returns ACTIVE when charges and payouts are enabled and no requirements are due", () => {
		const account = buildAccount();

		const result = collapseStripeAccountStatus(account);

		expect(result.status).toBe(StripeProcessorStatusFlag.ACTIVE);
		expect(result.missingRequirements).toHaveLength(0);
		expect(result.reasons).not.toContain("requirements_due");
	});

	it("returns NEEDS_REQUIREMENTS when requirements are currently due", () => {
		const account = buildAccount({
			requirements: {
				alternatives: [],
				current_deadline: null,
				disabled_reason: null,
				currently_due: ["business_profile.mcc"],
				eventually_due: [],
				past_due: [],
				pending_verification: [],
				errors: []
			}
		});

		const result = collapseStripeAccountStatus(account);

		expect(result.status).toBe(StripeProcessorStatusFlag.NEEDS_REQUIREMENTS);
		expect(result.missingRequirements).toContain("business_profile.mcc");
	});

	it("returns LIMITED when capabilities are not fully active", () => {
		const account = buildAccount({
			capabilities: {
				card_payments: "pending",
				transfers: "active"
			}
		});

		const result = collapseStripeAccountStatus(account);

		expect(result.status).toBe(StripeProcessorStatusFlag.LIMITED);
		expect(result.capabilities.find(cap => cap.name === "card_payments")?.status).toBe("pending");
	});

	it("returns RESTRICTED when payouts are disabled without missing requirements", () => {
		const account = buildAccount({
			payouts_enabled: false
		});

		const result = collapseStripeAccountStatus(account);

		expect(result.status).toBe(StripeProcessorStatusFlag.RESTRICTED);
		expect(result.reasons).toContain("payouts_disabled");
	});

	it("returns DISABLED when both charges and payouts are disabled with a disabled reason", () => {
		const account = buildAccount({
			charges_enabled: false,
			payouts_enabled: false,
			requirements: {
				alternatives: [],
				current_deadline: null,
				currently_due: [],
				eventually_due: [],
				past_due: [],
				pending_verification: [],
				errors: [],
				disabled_reason: "rejected.fraud"
			}
		});

		const result: StripeProcessorStatusSummary = collapseStripeAccountStatus(account);

		expect(result.status).toBe(StripeProcessorStatusFlag.DISABLED);
		expect(result.disabledReason).toBe("rejected.fraud");
	});
});

describe("mapStripeStatusToAccountStatus", () => {
	it("maps Stripe flags to repository statuses", () => {
		expect(mapStripeStatusToAccountStatus(StripeProcessorStatusFlag.ACTIVE)).toEqual({
			code: "ACTIVE",
			status: PaymentProcessorAccountStatus.ACTIVE,
			reasons: []
		});
		expect(mapStripeStatusToAccountStatus(StripeProcessorStatusFlag.NEEDS_REQUIREMENTS)).toEqual({
			code: "INFO_REQUIRED",
			status: PaymentProcessorAccountStatus.INFO_REQUIRED,
			reasons: ["info_required"]
		});
		expect(mapStripeStatusToAccountStatus(StripeProcessorStatusFlag.LIMITED)).toEqual({
			code: "RESTRICTED",
			status: PaymentProcessorAccountStatus.RESTRICTED,
			reasons: ["limited"]
		});
		expect(mapStripeStatusToAccountStatus(StripeProcessorStatusFlag.RESTRICTED)).toEqual({
			code: "RESTRICTED",
			status: PaymentProcessorAccountStatus.RESTRICTED,
			reasons: ["restricted"]
		});
		expect(mapStripeStatusToAccountStatus(StripeProcessorStatusFlag.DISABLED)).toEqual({
			code: "REJECTED",
			status: PaymentProcessorAccountStatus.REJECTED,
			reasons: ["rejected"]
		});
		expect(mapStripeStatusToAccountStatus(StripeProcessorStatusFlag.UNKNOWN)).toEqual({
			code: "UNKNOWN",
			status: PaymentProcessorAccountStatus.UNKNOWN,
			reasons: ["unknown"]
		});
	});
});
