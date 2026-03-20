/**
 * @fileoverview
 * This file contains the stripe helper functions for the payment processor.
 */
import type Stripe from "stripe";
import { PaymentProcessorAccountStatus } from "../paymentProcessorAccount.constants";
import {
	StripeProcessorStatusFlag,
	WorthPreProcessorStatus,
	WorthProcessorStatus,
	type StripeCapabilityStatus,
	type StripeProcessorStatusSummary,
	type StripeWebhookPayload
} from "../types/stripe";

/**
 * Maps processor status string to PaymentProcessorAccountStatus numeric value
 * Used when saving status to the database
 */
export const processorStatusToNumeric = (
	status: WorthProcessorStatus | WorthPreProcessorStatus
): PaymentProcessorAccountStatus => {
	switch (status) {
		case WorthProcessorStatus.ACTIVE:
			return PaymentProcessorAccountStatus.ACTIVE;
		case WorthProcessorStatus.PENDING:
			return PaymentProcessorAccountStatus.PENDING;
		case WorthProcessorStatus.RESTRICTED:
			return PaymentProcessorAccountStatus.RESTRICTED;
		case WorthProcessorStatus.INFO_REQUIRED:
			return PaymentProcessorAccountStatus.INFO_REQUIRED;
		case WorthProcessorStatus.REJECTED:
			return PaymentProcessorAccountStatus.REJECTED;
		case WorthPreProcessorStatus.NOT_SUBMITTED:
		case WorthProcessorStatus.UNKNOWN:
		default:
			return PaymentProcessorAccountStatus.UNKNOWN;
	}
};

/**
 * Maps PaymentProcessorAccountStatus numeric value to processor status string
 * Used when reading status from the database for API responses
 */
export const numericToProcessorStatus = (
	status: PaymentProcessorAccountStatus | number | undefined
): WorthProcessorStatus | WorthPreProcessorStatus => {
	switch (status) {
		case PaymentProcessorAccountStatus.ACTIVE:
			return WorthProcessorStatus.ACTIVE;
		case PaymentProcessorAccountStatus.PENDING:
			return WorthProcessorStatus.PENDING;
		case PaymentProcessorAccountStatus.RESTRICTED:
			return WorthProcessorStatus.RESTRICTED;
		case PaymentProcessorAccountStatus.INFO_REQUIRED:
			return WorthProcessorStatus.INFO_REQUIRED;
		case PaymentProcessorAccountStatus.REJECTED:
			return WorthProcessorStatus.REJECTED;
		case PaymentProcessorAccountStatus.DISABLED:
			return WorthProcessorStatus.REJECTED; // Legacy mapping
		case PaymentProcessorAccountStatus.UNKNOWN:
		default:
			return WorthProcessorStatus.UNKNOWN;
	}
};

/**
 * Maps Stripe's internal status flag to our PaymentProcessorAccountStatus
 * This is used when syncing account status from Stripe webhooks/API
 */
export const mapStripeStatusToAccountStatus = (
	stripeStatus: StripeProcessorStatusFlag,
	reasons: string[] = []
): { status: PaymentProcessorAccountStatus; reasons: string[]; code: keyof typeof PaymentProcessorAccountStatus } => {
	const reasonSet = new Set(reasons);

	switch (stripeStatus) {
		case StripeProcessorStatusFlag.ACTIVE:
			return { status: PaymentProcessorAccountStatus.ACTIVE, reasons: Array.from(reasonSet), code: "ACTIVE" };
		case StripeProcessorStatusFlag.NEEDS_REQUIREMENTS:
			reasonSet.add("info_required");
			return { status: PaymentProcessorAccountStatus.INFO_REQUIRED, reasons: Array.from(reasonSet), code: "INFO_REQUIRED" };
		case StripeProcessorStatusFlag.LIMITED:
			reasonSet.add("limited");
			return { status: PaymentProcessorAccountStatus.RESTRICTED, reasons: Array.from(reasonSet), code: "RESTRICTED" };
		case StripeProcessorStatusFlag.RESTRICTED:
			reasonSet.add("restricted");
			return { status: PaymentProcessorAccountStatus.RESTRICTED, reasons: Array.from(reasonSet), code: "RESTRICTED" };
		case StripeProcessorStatusFlag.DISABLED:
			reasonSet.add("rejected");
			return { status: PaymentProcessorAccountStatus.REJECTED, reasons: Array.from(reasonSet), code: "REJECTED" };
		case StripeProcessorStatusFlag.UNKNOWN:
		default:
			reasonSet.add("unknown");
			return { status: PaymentProcessorAccountStatus.UNKNOWN, reasons: Array.from(reasonSet), code: "UNKNOWN" };
	}
};

export const collapseStripeAccountStatus = (payload: StripeWebhookPayload): StripeProcessorStatusSummary => {
	const account = extractAccount(payload);

	if (!account) {
		return {
			status: StripeProcessorStatusFlag.UNKNOWN,
			missingRequirements: [],
			upcomingRequirements: [],
			capabilities: [],
			disabledReason: null,
			chargesEnabled: false,
			payoutsEnabled: false,
			reasons: ["account_not_found"]
		};
	}

	const missingRequirements = collectRequirementCodes(account.requirements);
	const upcomingRequirements = collectRequirementCodes(account.future_requirements);
	const capabilities = collectCapabilityStatuses(account.capabilities);
	const nonActiveCapabilities = capabilities.filter(cap => cap.status !== "active");

	const disabledReason = account.requirements?.disabled_reason ?? account.future_requirements?.disabled_reason ?? null;
	const chargesEnabled = Boolean(account.charges_enabled);
	const payoutsEnabled = Boolean(account.payouts_enabled);

	const reasons: string[] = [];
	if (missingRequirements.length > 0) {
		reasons.push("requirements_due");
		reasons.push(`requirements_due:${missingRequirements.join(",")}`);
	}
	if (upcomingRequirements.length > 0) {
		reasons.push("future_requirements_due");
		reasons.push(`future_requirements_due:${upcomingRequirements.join(",")}`);
	}
	if (!chargesEnabled) {
		reasons.push("charges_disabled");
	}
	if (!payoutsEnabled) {
		reasons.push("payouts_disabled");
	}
	if (disabledReason) {
		reasons.push(`disabled_reason:${disabledReason}`);
	}
	if (nonActiveCapabilities.length > 0) {
		reasons.push("capabilities_not_active");
		nonActiveCapabilities.forEach(cap => reasons.push(`capability:${cap.name}:${cap.status}`));
	}

	let status: StripeProcessorStatusFlag = StripeProcessorStatusFlag.ACTIVE;
	if (missingRequirements.length > 0) {
		status = StripeProcessorStatusFlag.NEEDS_REQUIREMENTS;
	} else if (!chargesEnabled && !payoutsEnabled && disabledReason) {
		status = StripeProcessorStatusFlag.DISABLED;
	} else if (!chargesEnabled || !payoutsEnabled || disabledReason) {
		status = StripeProcessorStatusFlag.RESTRICTED;
	} else if (nonActiveCapabilities.length > 0 || upcomingRequirements.length > 0) {
		status = StripeProcessorStatusFlag.LIMITED;
	}

	return {
		status,
		missingRequirements,
		upcomingRequirements,
		capabilities,
		disabledReason,
		chargesEnabled,
		payoutsEnabled,
		reasons
	};
};

const extractAccount = (payload: StripeWebhookPayload): Stripe.Account | null => {
	if (isStripeAccount(payload)) {
		return payload;
	}

	if (typeof payload !== "object" || payload === null) {
		return null;
	}

	const candidateEvent = payload as Partial<Stripe.Event>;
	const dataObject = candidateEvent.data && typeof candidateEvent.data === "object" ? candidateEvent.data.object : null;

	if (isStripeAccount(dataObject)) {
		return dataObject;
	}

	if (isStripeAccount((payload as { account?: Stripe.Account }).account)) {
		return (payload as { account?: Stripe.Account }).account as Stripe.Account;
	}

	return null;
};

const collectRequirementCodes = (
	requirements?: Stripe.Account.Requirements | Stripe.Account.FutureRequirements | null
): string[] => {
	if (!requirements) {
		return [];
	}

	const normalized = requirements as Partial<Stripe.Account.Requirements>;
	const currentlyDue: string[] = Array.isArray(normalized.currently_due) ? normalized.currently_due : [];
	const pastDue: string[] = Array.isArray(normalized.past_due) ? normalized.past_due : [];
	const pendingVerification: string[] = Array.isArray(normalized.pending_verification)
		? normalized.pending_verification
		: [];
	const futureRequirements = requirements as Partial<Stripe.Account.FutureRequirements>;
	const eventuallyDue: string[] = Array.isArray(futureRequirements.eventually_due)
		? futureRequirements.eventually_due
		: [];

	return [...new Set([...currentlyDue, ...pastDue, ...pendingVerification, ...eventuallyDue])].filter(Boolean);
};

const collectCapabilityStatuses = (
	capabilities: Stripe.Account.Capabilities | null | undefined
): StripeCapabilityStatus[] => {
	if (!capabilities) {
		return [];
	}

	return Object.entries(capabilities).reduce((acc, [name, status]) => {
		if (!["active", "inactive"].includes(status)) {
			status = "pending";
		}
		acc.push({
			name: name as keyof Stripe.Account.Capabilities,
			status
		});
		return acc;
	}, [] as StripeCapabilityStatus[]);
};

export const isStripeAccount = (candidate: unknown): candidate is Stripe.Account => {
	return Boolean(candidate && typeof candidate === "object" && (candidate as Stripe.Account).object === "account");
};

export const isStripeBankAccount = (candidate: unknown): candidate is Stripe.BankAccount => {
	return Boolean(
		candidate && typeof candidate === "object" && (candidate as Stripe.BankAccount).object === "bank_account"
	);
};

/**
 * Merchant profile account element structure matching the type
 */
export type MerchantProfileAccountElement = {
	account_id?: string;
	processor_account_id?: string;
	status?: number;
	account?: Stripe.Account | Record<string, any> | null;
} | null;

/**
 * Account enriched with processor_status for API responses
 */
export type AccountWithProcessorStatus<T extends Record<string, any>> = T & {
	processor_status: WorthProcessorStatus | WorthPreProcessorStatus;
};

/**
 * Converts Stripe account data to Worth processor status enum value
 * Based on Stripe account requirements, capabilities, and enabled flags
 *
 * Status priority (evaluated in order):
 * 1. NOT_SUBMITTED - No account data
 * 2. INFO_REQUIRED - Missing requirements data
 * 3. REJECTED - Account rejected by Stripe
 * 4. INFO_REQUIRED - Has currently_due, past_due, or external account issues
 * 5. PENDING - Pending verification or pending capabilities
 * 6. RESTRICTED - Charges/payouts disabled or inactive capabilities
 * 7. ACTIVE - Fully operational
 *
 * @param accountElement - The merchant profile account element containing Stripe account data
 * @returns The Worth processor status enum value based on Stripe account state
 */
export const getWorthProcessorStatus = (
	accountElement: MerchantProfileAccountElement
): WorthProcessorStatus | WorthPreProcessorStatus => {
	// If account data is missing, no Stripe account has been created yet
	if (!accountElement?.account) {
		return WorthPreProcessorStatus.NOT_SUBMITTED;
	}

	const account = accountElement.account;
	const requirements = account.requirements;
	const capabilities = account.capabilities;
	const externalAccounts = account.external_accounts;

	// If requirements data is missing, we cannot accurately determine status
	if (!requirements) {
		return WorthProcessorStatus.INFO_REQUIRED;
	}

	// Check if account was rejected by Stripe
	if (requirements.disabled_reason?.startsWith("rejected.")) {
		return WorthProcessorStatus.REJECTED;
	}

	const hasCurrentlyDue = requirements.currently_due && requirements.currently_due.length > 0;
	const hasPastDue = requirements.past_due && requirements.past_due.length > 0;

	// Check external accounts for issues
	const externalAccountsData =
		externalAccounts && "data" in externalAccounts ? (externalAccounts.data as Stripe.BankAccount[]) : [];

	const hasExternalAccountIssues = externalAccountsData.some(externalAccount => {
		const extRequirements = (externalAccount as any).requirements;
		return (extRequirements?.currently_due?.length ?? 0) > 0 || (extRequirements?.past_due?.length ?? 0) > 0;
	});

	// Check if payouts are disabled because no valid external account exists
	const payoutsDisabledDueToExternalAccount =
		!account.payouts_enabled &&
		!externalAccountsData.some(
			externalAccount => externalAccount.default_for_currency && externalAccount.status === "verified"
		);

	if (hasCurrentlyDue || hasPastDue || hasExternalAccountIssues || payoutsDisabledDueToExternalAccount) {
		return WorthProcessorStatus.INFO_REQUIRED;
	}

	// Check for pending verifications
	const hasPendingVerification = requirements.pending_verification && requirements.pending_verification.length > 0;
	const hasExternalAccountPendingVerification = externalAccountsData.some(externalAccount => {
		const extRequirements = (externalAccount as any).requirements;
		return (extRequirements?.pending_verification?.length ?? 0) > 0;
	});
	const capabilityValues = capabilities ? (Object.values(capabilities) as string[]) : [];
	const hasPendingCapability = capabilityValues.some(status => status === "pending");

	if (hasPendingVerification || hasExternalAccountPendingVerification || hasPendingCapability) {
		return WorthProcessorStatus.PENDING;
	}

	// Check for restrictions
	const chargesDisabled = !account.charges_enabled;
	const payoutsDisabled = !account.payouts_enabled;
	const hasDisabledReason = (requirements.disabled_reason?.length ?? 0) > 0;
	const hasInactiveCapability = capabilityValues.some(status => status === "inactive");

	if (chargesDisabled || payoutsDisabled || hasDisabledReason || hasInactiveCapability) {
		return WorthProcessorStatus.RESTRICTED;
	}

	// Account is ACTIVE only if charges/payouts enabled and all capabilities active
	if (
		account.charges_enabled &&
		account.payouts_enabled &&
		capabilities &&
		capabilityValues.every(status => status === "active")
	) {
		return WorthProcessorStatus.ACTIVE;
	}

	// Fallback to RESTRICTED
	return WorthProcessorStatus.RESTRICTED;
};

/**
 * Enriches a single account object with processor_status
 * @param account - Account object containing Stripe account data
 * @returns Account object with processor_status field added
 */
export const enrichAccountWithProcessorStatus = <T extends Record<string, any>>(
	account: T
): AccountWithProcessorStatus<T> => {
	const processorStatus = getWorthProcessorStatus({
		account: account?.account ?? null
	});
	return {
		...account,
		processor_status: processorStatus
	};
};

/**
 * Enriches multiple account objects with processor_status
 * @param accounts - Array of account objects containing Stripe account data
 * @returns Array of account objects with processor_status field added
 */
export const enrichAccountsWithProcessorStatus = <T extends Record<string, any>>(
	accounts: T[]
): AccountWithProcessorStatus<T>[] => {
	return accounts.map(enrichAccountWithProcessorStatus);
};
