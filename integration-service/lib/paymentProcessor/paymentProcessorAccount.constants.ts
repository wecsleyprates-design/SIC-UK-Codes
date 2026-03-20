/**
 * Payment processor account status stored in the database.
 * These numeric values are persisted and used for querying.
 *
 * Status flow:
 * - UNKNOWN (0): Initial/undetermined state
 * - ACTIVE (1): Fully operational - charges and payouts enabled
 * - DISABLED (2): Account has been disabled (legacy, use REJECTED for new)
 * - PENDING (3): Pending verification from Stripe
 * - RESTRICTED (4): Account has restrictions - charges/payouts disabled or capabilities inactive
 * - INFO_REQUIRED (5): Additional information required from user
 * - REJECTED (6): Account was rejected by Stripe
 */
export const PaymentProcessorAccountStatus = {
	UNKNOWN: 0,
	ACTIVE: 1,
	DISABLED: 2,
	PENDING: 3,
	RESTRICTED: 4,
	INFO_REQUIRED: 5,
	REJECTED: 6
} as const;

export type PaymentProcessorAccountStatus =
	(typeof PaymentProcessorAccountStatus)[keyof typeof PaymentProcessorAccountStatus];

/**
 * Reverse mapping from numeric status to string key
 * Useful for logging and API responses
 */
export const PaymentProcessorAccountStatusLabel: Record<PaymentProcessorAccountStatus, string> = {
	[PaymentProcessorAccountStatus.UNKNOWN]: "UNKNOWN",
	[PaymentProcessorAccountStatus.ACTIVE]: "ACTIVE",
	[PaymentProcessorAccountStatus.DISABLED]: "DISABLED",
	[PaymentProcessorAccountStatus.PENDING]: "PENDING",
	[PaymentProcessorAccountStatus.RESTRICTED]: "RESTRICTED",
	[PaymentProcessorAccountStatus.INFO_REQUIRED]: "INFO_REQUIRED",
	[PaymentProcessorAccountStatus.REJECTED]: "REJECTED"
};
