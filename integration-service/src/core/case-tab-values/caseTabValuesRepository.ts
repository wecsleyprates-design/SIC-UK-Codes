/**
 * Data access for case tab values. DB queries only; no business logic.
 * @see cursor/feature_docs/decisioning-results-on-case/02-case-tab-values-single-endpoint-architecture.md
 */

import { sqlQuery } from "#helpers";

export interface PublicRecordsSummaryRow {
	number_of_bankruptcies: string | null;
	number_of_judgement_fillings: string | null;
	number_of_business_liens: string | null;
	count_of_complaints_all_time?: string | number | null;
}

/**
 * Fetches public records summary (bankruptcies, judgements, liens) by Verdata task ID.
 * Does not resolve task ID from business/case; caller must provide it.
 */
export async function getPublicRecordsSummaryByTaskId(
	taskId: string
): Promise<PublicRecordsSummaryRow | null> {
	const sql = `SELECT pr.number_of_bankruptcies, pr.number_of_judgement_fillings, pr.number_of_business_liens
		FROM integration_data.public_records pr
		WHERE pr.business_integration_task_id = $1
		LIMIT 1`;
	const result = await sqlQuery<PublicRecordsSummaryRow>({
		sql,
		values: [taskId],
	});
	const row = result?.rows?.[0];
	return row ?? null;
}

/**
 * Returns adverse media article count for the given task IDs (light query, no full payload).
 */
export async function getAdverseMediaCountByTaskIds(
	taskIds: string[]
): Promise<number> {
	if (taskIds.length === 0) return 0;
	const placeholders = taskIds.map((_, i) => `$${i + 1}`).join(",");
	const sql = `SELECT COUNT(*) AS cnt
		FROM integration_data.adverse_media am
		WHERE am.business_integration_task_id IN (${placeholders})`;
	const result = await sqlQuery<{ cnt: string }>({
		sql,
		values: taskIds,
	});
	const row = result?.rows?.[0];
	return row ? parseInt(String(row.cnt), 10) : 0;
}

/** Risk counts from adverse_media (summed across given task IDs) for failed/passed status. */
export interface AdverseMediaRiskCounts {
	high_risk_count: number;
	medium_risk_count: number;
	low_risk_count: number;
}

export async function getAdverseMediaRiskCountsByTaskIds(
	taskIds: string[]
): Promise<AdverseMediaRiskCounts | null> {
	if (taskIds.length === 0) return null;
	const placeholders = taskIds.map((_, i) => `$${i + 1}`).join(",");
	const sql = `SELECT
		COALESCE(SUM(am.high_risk_count), 0)::int AS high_risk_count,
		COALESCE(SUM(am.medium_risk_count), 0)::int AS medium_risk_count,
		COALESCE(SUM(am.low_risk_count), 0)::int AS low_risk_count
		FROM integration_data.adverse_media am
		WHERE am.business_integration_task_id IN (${placeholders})`;
	const result = await sqlQuery<{ high_risk_count: string; medium_risk_count: string; low_risk_count: string }>({
		sql,
		values: taskIds,
	});
	const row = result?.rows?.[0];
	if (!row) return null;
	return {
		high_risk_count: parseInt(String(row.high_risk_count), 10) || 0,
		medium_risk_count: parseInt(String(row.medium_risk_count), 10) || 0,
		low_risk_count: parseInt(String(row.low_risk_count), 10) || 0,
	};
}

/**
 * Source timestamps for "x update(s) made" detection. All use existing columns; no new schema.
 * @see cursor/feature_docs/decisioning-results-on-case/04-values-change-detection.md
 */

/** Case baseline: when the case was created (used as created_at when no acknowledge baseline). */
export async function getCaseCreatedAtForValues(
	caseId: string
): Promise<Date | null> {
	const sql = `SELECT created_at FROM public.data_cases WHERE id = $1 LIMIT 1`;
	const result = await sqlQuery<{ created_at: Date }>({ sql, values: [caseId] });
	const row = result?.rows?.[0];
	return row?.created_at ?? null;
}

/** created_at and updated_at from integration_data.case_results_executions (baseline for change detection). */
export interface CaseResultsExecutionTimestamps {
	created_at: Date | null;
	updated_at: Date | null;
}

export async function getCaseResultsExecutionTimestamps(
	caseId: string
): Promise<CaseResultsExecutionTimestamps> {
	const sql = `SELECT created_at, updated_at FROM integration_data.case_results_executions WHERE case_id = $1 LIMIT 1`;
	const result = await sqlQuery<{ created_at: Date | null; updated_at: Date | null }>({
		sql,
		values: [caseId],
	});
	const row = result?.rows?.[0];
	return {
		created_at: row?.created_at ?? null,
		updated_at: row?.updated_at ?? null,
	};
}

/**
 * Sets only updated_at to now for this case in integration_data.case_results_executions.
 * Call when re-run completes so GET /values returns updated_at and isRegenerated shows "Regenerated on".
 * created_at is left unchanged on existing rows (only set on INSERT for new rows).
 */
export async function updateCaseResultsExecutionTimestamps(caseId: string): Promise<Date> {
	const now = new Date();
	const sql = `
		INSERT INTO integration_data.case_results_executions (case_id, created_at, updated_at)
		VALUES ($1, $2, $2)
		ON CONFLICT (case_id) DO UPDATE SET updated_at = now()
	`;
	await sqlQuery({ sql, values: [caseId, now] });
	return now;
}

/** Last time any fact override was saved for this business (request_response row). */
export async function getFactOverrideLatestTimestamp(
	businessId: string
): Promise<Date | null> {
	const sql = `SELECT requested_at, request_received
		FROM integration_data.request_response
		WHERE business_id = $1 AND request_type = 'fact_override'
		ORDER BY requested_at DESC NULLS LAST
		LIMIT 1`;
	const result = await sqlQuery<{
		requested_at: Date | null;
		request_received: Date | null;
	}>({ sql, values: [businessId] });
	const row = result?.rows?.[0];
	if (!row) return null;
	const a = row.request_received ?? row.requested_at;
	const b = row.requested_at ?? row.request_received;
	if (!a && !b) return null;
	if (!a) return b ?? null;
	if (!b) return a;
	return a > b ? a : b;
}

/**
 * Fact override response shape: { [factName]: { timestamp?: string, ... } }.
 * Counts how many fact keys have an override with timestamp after baseline (for "x update(s) made").
 */
export async function getFactOverrideUpdatesCount(
	businessId: string,
	baseline: Date
): Promise<number> {
	const sql = `SELECT response
		FROM integration_data.request_response
		WHERE business_id = $1 AND request_type = 'fact_override'
		ORDER BY requested_at DESC NULLS LAST
		LIMIT 1`;
	const result = await sqlQuery<{ response: Record<string, { timestamp?: string }> | null }>({
		sql,
		values: [businessId],
	});
	const row = result?.rows?.[0];
	const response = row?.response;
	if (!response || typeof response !== "object") return 0;
	const baselineTime = baseline.getTime();
	let count = 0;
	for (const value of Object.values(response)) {
		if (value && typeof value === "object" && value.timestamp != null) {
			const ts = typeof value.timestamp === "string" ? new Date(value.timestamp).getTime() : Number(value.timestamp);
			if (!Number.isNaN(ts) && ts > baselineTime) count += 1;
		}
	}
	return count;
}

/** Public records row updated_at for the given task (bankruptcies, judgements, liens). */
export async function getPublicRecordsUpdatedAt(
	taskId: string
): Promise<Date | null> {
	const sql = `SELECT updated_at FROM integration_data.public_records
		WHERE business_integration_task_id = $1 AND updated_at IS NOT NULL
		LIMIT 1`;
	const result = await sqlQuery<{ updated_at: Date }>({ sql, values: [taskId] });
	const row = result?.rows?.[0];
	return row?.updated_at ?? null;
}

/** Latest identity_verification.updated_at for this business (IDV). */
export async function getIdentityVerificationLatestUpdatedAt(
	businessId: string
): Promise<Date | null> {
	const sql = `SELECT MAX(updated_at) AS latest FROM integration_data.identity_verification
		WHERE business_id = $1 AND updated_at IS NOT NULL`;
	const result = await sqlQuery<{ latest: Date | null }>({ sql, values: [businessId] });
	const row = result?.rows?.[0];
	return row?.latest ?? null;
}

/**
 * GIACT verification row for a case: gVerify and gAuthenticate response_code (from core_giact_response_codes).
 * Used to build the three GIACT case-tab-values rows. Latest verification per case (by created_at).
 */
export interface GiactVerificationForCaseRow {
	verify_response_code: number | null;
	auth_response_code: number | null;
}

/**
 * Fetches the latest banking verification for the case and returns the response_code values
 * for gVerify (Account Status) and gAuthenticate (Account Name / Contact Verification).
 */
export async function getGiactVerificationByCaseId(
	caseId: string
): Promise<GiactVerificationForCaseRow | null> {
	const sql = `
		SELECT
			verify_codes.response_code AS verify_response_code,
			auth_codes.response_code AS auth_response_code
		FROM integration_data.rel_banking_verifications rbv
		LEFT JOIN integrations.core_giact_response_codes verify_codes
			ON verify_codes.id = rbv.giact_verify_response_code_id
		LEFT JOIN integrations.core_giact_response_codes auth_codes
			ON auth_codes.id = rbv.giact_authenticate_response_code_id
		WHERE rbv.case_id = $1
		ORDER BY rbv.created_at DESC
		LIMIT 1`;
	const result = await sqlQuery<GiactVerificationForCaseRow>({ sql, values: [caseId] });
	const row = result?.rows?.[0];
	return row ?? null;
}
