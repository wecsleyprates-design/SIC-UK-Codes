/**
 * Types for the case tab values domain (18 properties for decisioning/onboarding results).
 * @see cursor/feature_docs/decisioning-results-on-case/02-case-tab-values-single-endpoint-architecture.md
 */

/** Canonical row IDs (aligned with OnboardingResultsPlaceholder). GIACT expanded to three rows. */
export const CASE_TAB_VALUES_ROW_IDS = [
	"tin_business_registration",
	"business_address_business_registration",
	"business_address_google_profile",
	"business_name",
	"website_parked_domain",
	"website_status",
	"watchlist_hits",
	"idv_verification",
	"google_profile",
	"bankruptcies",
	"judgements",
	"liens",
	"complaints",
	"adverse_media",
	"giact_account_status",
	"giact_account_name",
	"giact_contact_verification",
	"email_breach",
	"fraud_results",
	"bot_presence",
	"synthetic_identity_risk_score",
	"stolen_identity_risk_score",
] as const;

export type CaseTabValuesRowId = (typeof CASE_TAB_VALUES_ROW_IDS)[number];

/** Three-way status for case results (Missing / Passed / Failed). */
export type CaseTabValueStatus = "missing" | "passed" | "failed";

/** Value for a single row: display value and optional description/status. */
export interface CaseTabValueItem {
	value: string | number | boolean | null;
	/** Optional description or tooltip (e.g. long explanation for GIACT). */
	description?: string | null;
	/** Optional status for section placement (Missing / Passed / Failed). Used by GIACT rows. */
	status?: CaseTabValueStatus | null;
}

/** Domain model: values for the 20 properties keyed by row ID. */
export type CaseTabValues = Partial<Record<CaseTabValuesRowId, CaseTabValueItem>>;

/** API response shape (snake_case). */
export interface CaseTabValuesApiResponse {
	values: Record<
		string,
		{ value: string | number | boolean | null; description?: string | null; status?: CaseTabValueStatus | null }
	>;
	/** When the results baseline was set (e.g. case_results_executions.created_at). ISO8601 or null. */
	created_at?: string | null;
	/** When case_results_executions row was last updated (e.g. after re-run). ISO8601 or null. Used for "Regenerated on" UI. */
	updated_at?: string | null;
	/** True if any source (fact override, public records, IDV, etc.) has changed after baseline (updated_at). */
	has_updates_since_generated?: boolean;
	/** Number of source areas that have a newer timestamp than baseline (for "x update(s) made"). */
	updates_count?: number;
}

/** Domain result: values plus change-detection metadata (existing dates only). */
export interface CaseTabValuesResult {
	values: CaseTabValues;
	created_at: string | null;
	updated_at: string | null;
	has_updates_since_generated: boolean;
	updates_count: number;
}
