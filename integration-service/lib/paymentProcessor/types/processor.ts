import { UUID } from "crypto";

// Payment Processor Status
export const PaymentProcessorStatus = {
	ACTIVE: 1,
	INACTIVE: 0,
	ERROR: 99
} as const;

export type PaymentProcessorStatus = (typeof PaymentProcessorStatus)[keyof typeof PaymentProcessorStatus];

export type PaymentProcessorOnboardOutcome = {
	failure_reason?: string;
	profile_id?: UUID;
	business_id?: UUID;
	account_id?: UUID;
}
