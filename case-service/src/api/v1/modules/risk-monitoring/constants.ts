/**
 * Dummy customer ID seeded in DB by migration 20260212184753.
 * Init copies templates and risk alerts from this customer to the target customer when they have none.
 */
export const SEED_CUSTOMER_ID = "00000000-0000-0000-0000-000000000000";
export const MONITORING_RUN_STATUS_VALUES = ["PENDING", "RUNNING", "COMPLETED", "FAILED"] as const;
export const CADENCE_VALUES: Record<string, number> = {
	DAILY: 1,
	WEEKLY: 7,
	BIWEEKLY: 14,
	MONTHLY: 30,
	QUARTERLY: 90,
	BIANNUAL: 180,
	ANNUAL: 365
} as const;
export const MONITORING_ASSOCIATION_VALUES = ["RULE", "MANUAL"] as const;
