/**
 * Business logic for case tab values (18 properties). Orchestrates FactEngine and Repository.
 * Does not call full tab endpoints; uses minimal fact sets and DB queries.
 * @see cursor/feature_docs/decisioning-results-on-case/02-case-tab-values-single-endpoint-architecture.md
 */

import { businessFacts } from "#lib/facts/businessDetails";
import { kybFacts } from "#lib/facts/kyb";
import { bjlFacts } from "#lib/facts/bjl";
import { reviewFacts } from "#lib/facts/reviews";
import { kycFacts } from "#lib/facts/kyc";
import { FactEngine } from "#lib/facts/factEngine";
import { FactUtils } from "#lib/facts";
import { combineFacts, factWithHighestConfidence, combineWatchlistMetadata } from "#lib/facts/rules";
import type { Fact } from "#lib/facts/types";
import {
	getPublicRecordsSummaryByTaskId,
	getAdverseMediaCountByTaskIds,
	getAdverseMediaRiskCountsByTaskIds,
	getCaseCreatedAtForValues,
	getCaseResultsExecutionTimestamps,
	updateCaseResultsExecutionTimestamps,
	getFactOverrideUpdatesCount,
	getPublicRecordsUpdatedAt,
	getIdentityVerificationLatestUpdatedAt,
	getGiactVerificationByCaseId,
	type PublicRecordsSummaryRow,
} from "./caseTabValuesRepository";
import { getGiactDisplay } from "./giactDisplayMapper";
import type { CaseTabValues, CaseTabValueItem, CaseTabValuesResult } from "./types";

const MISSING = "Not available.";

/** Three-way IDV state for case results (frontend copy table is keyed by this). */
const IDV_STATE = {
	NOT_RUN: "not_run",
	FAILED: "failed",
	VERIFIED: "verified",
} as const;

/**
 * Derives the three-way IDV state from idv_status counts (from FactEngine).
 * Same table source: integration_data.identity_verification; counts by status (SUCCESS, PENDING, FAILED, etc.).
 */
function deriveIdvThreeWayState(
	idvStatusCounts: Record<string, number> | undefined
): { status: string; description: string } {
	if (!idvStatusCounts || typeof idvStatusCounts !== "object") {
		return { status: IDV_STATE.NOT_RUN, description: "Identity Verification (IDV) was not run." };
	}
	const total = Object.values(idvStatusCounts).reduce((s, n) => s + Number(n), 0);
	if (total === 0) {
		return { status: IDV_STATE.NOT_RUN, description: "Identity Verification (IDV) was not run." };
	}
	const success = Number(idvStatusCounts.SUCCESS ?? 0);
	if (success >= 1) {
		return { status: IDV_STATE.VERIFIED, description: "IDV has passed on all associated owners." };
	}
	// Ran but no success (pending, failed, canceled, expired)
	return {
		status: IDV_STATE.FAILED,
		description:
			"One or more owners have not been verified or have failed identity verification.",
	};
}

export interface GetCaseTabValuesParams {
	businessId: string;
	caseId: string;
	/** Verdata task ID for public records (bankruptcies, judgements, liens). Resolved by API layer. */
	verdataTaskId?: string | null;
	/** Adverse media task IDs for count. Resolved by API layer. */
	adverseMediaTaskIds?: string[] | null;
}

function toItem(
	value: string | number | boolean | null,
	description?: string | null,
	status?: "missing" | "passed" | "failed" | null
): CaseTabValueItem {
	const item: CaseTabValueItem = { value, description: description ?? null };
	if (status != null) item.status = status;
	return item;
}

/** Fact names we read for case tab values; filter fact sets to these + dependencies to reduce work. */
const KYB_NEEDED_FACT_NAMES = [
	"tin", "addresses", "addresses_found", "legal_name", "website_found",
	"total_watchlist_hits", "watchlist", "watchlist_hits", "watchlist_raw", "screened_people",
	"trulioo_advanced_watchlist_results", "idv_status",
	"address_verification", "advanced_watchlist_results", // KYB Contact Information: submitted address Google profile Verified (Trulioo)
];
const BUSINESS_NEEDED_FACT_NAMES = ["tin", "business_name", "website", "google_place_id"];
const BJL_NEEDED_FACT_NAMES = ["num_bankruptcies", "bankruptcies", "num_judgements", "judgements", "num_liens", "liens"];
const REVIEW_NEEDED_FACT_NAMES = [
	"primary_address_string", "primary_address", "google_place_id", "review_rating", "count_of_complaints_all_time",
];
const KYC_NEEDED_FACT_NAMES = ["idv_status", "owner_verification"];

function filterFactsToNeeded(neededNames: string[], facts: readonly Fact[]): Fact[] {
	const namesWithDeps = FactUtils.getAllFactsThatDependOnFacts(neededNames, [...facts]);
	const set = new Set(namesWithDeps);
	return facts.filter((f): f is Fact => set.has(f.name));
}

/**
 * Builds CaseTabValues from FactEngine results, repository data, and task-derived summaries.
 * Fact engines and DB queries run in parallel to reduce cold latency (target 5–10s).
 * Uses filtered fact sets (needed names + dependencies) so only required sources are resolved.
 */
export async function getCaseTabValues(params: GetCaseTabValuesParams): Promise<CaseTabValuesResult> {
	const { businessId, caseId, verdataTaskId, adverseMediaTaskIds } = params;
	const values: CaseTabValues = {};

	const kybFactsFiltered = filterFactsToNeeded(KYB_NEEDED_FACT_NAMES, kybFacts);
	const businessFactsFiltered = filterFactsToNeeded(BUSINESS_NEEDED_FACT_NAMES, businessFacts);
	const bjlFactsFiltered = filterFactsToNeeded(BJL_NEEDED_FACT_NAMES, bjlFacts);
	const reviewFactsFiltered = filterFactsToNeeded(REVIEW_NEEDED_FACT_NAMES, reviewFacts);
	const kycFactsFiltered = filterFactsToNeeded(KYC_NEEDED_FACT_NAMES, kycFacts);

	// Run all FactEngine runs and DB queries in parallel (independent per businessId/taskIds)
	const runKyb = async () => {
		const engine = new FactEngine(kybFactsFiltered, { business: businessId });
		engine.addRuleOverride(
			["addresses", "addresses_found", "dba_found", "names_found", "phone_found", "website_found"],
			combineFacts
		);
		engine.addRuleOverride("watchlist", combineWatchlistMetadata);
		await engine.applyRules(factWithHighestConfidence);
		return engine.getResults([]);
	};

	const runDetails = async () => {
		const engine = new FactEngine(businessFactsFiltered, { business: businessId });
		engine.addRuleOverride("names", combineFacts);
		await engine.applyRules(factWithHighestConfidence);
		return engine.getResults([]);
	};

	const runBjl = async () => {
		const engine = new FactEngine(bjlFactsFiltered, { business: businessId });
		await engine.applyRules(factWithHighestConfidence);
		return engine.getResults([]);
	};

	const runReviews = async (): Promise<Record<string, { value?: unknown }>> => {
		try {
			const engine = new FactEngine(reviewFactsFiltered, { business: businessId });
			await engine.applyRules(factWithHighestConfidence);
			return (await engine.getResults([])) as Record<string, { value?: unknown }>;
		} catch {
			return {};
		}
	};

	const runKyc = async (): Promise<Record<string, { value?: unknown }>> => {
		try {
			const engine = new FactEngine(kycFactsFiltered, { business: businessId });
			await engine.applyRules(factWithHighestConfidence);
			return (await engine.getResults([])) as Record<string, { value?: unknown }>;
		} catch {
			return {};
		}
	};

	const [
		kybData,
		detailsData,
		bjlData,
		reviewData,
		kycData,
		prSummary,
		adverseMediaCount,
		adverseMediaRiskCounts,
	] = await Promise.all([
		runKyb(),
		runDetails(),
		runBjl(),
		runReviews(),
		runKyc(),
		verdataTaskId ? getPublicRecordsSummaryByTaskId(verdataTaskId) : Promise.resolve(null),
		adverseMediaTaskIds && adverseMediaTaskIds.length > 0
			? getAdverseMediaCountByTaskIds(adverseMediaTaskIds)
			: Promise.resolve(0),
		adverseMediaTaskIds && adverseMediaTaskIds.length > 0
			? getAdverseMediaRiskCountsByTaskIds(adverseMediaTaskIds)
			: Promise.resolve(null),
	]);

	// Map to 20 row IDs (registration_filings removed; 3 new rows added below)
	const tinVal = kybData?.tin?.value ?? detailsData?.tin?.value;
	values.tin_business_registration = toItem(
		tinVal != null ? String(tinVal) : null,
		tinVal != null ? "TIN from business registration." : MISSING
	);

	const addrVal = kybData?.addresses?.value ?? kybData?.addresses_found?.value;
	const addrStr = Array.isArray(addrVal) ? addrVal[0] : addrVal;
	values.business_address_business_registration = toItem(
		addrStr != null ? String(addrStr) : null,
		addrStr != null ? "Business address (registration)." : MISSING
	);

	// Business Address (Google Profile): passed = Verified in KYB Contact Information; missing = not verified; failed = no address.
	const googleAddr = reviewData?.primary_address_string?.value ?? reviewData?.primary_address?.value;
	const hasAddress = googleAddr != null || addrStr != null;
	const addrVerValue = kybData?.address_verification?.value;
	const addrVerObj = typeof addrVerValue === "object" && addrVerValue !== null ? addrVerValue as { sublabel?: string; status?: string } : null;
	const verified =
		addrVerValue === "Verified" ||
		addrVerValue === true ||
		(addrVerObj?.sublabel === "Verified" || addrVerObj?.status === "success");
	let googleProfileStatus: "passed" | "missing" | "failed";
	let googleProfileDesc: string;
	if (verified) {
		googleProfileStatus = "passed";
		googleProfileDesc = "Business address (Google) verified.";
	} else if (hasAddress) {
		googleProfileStatus = "missing";
		googleProfileDesc = "Address present but not verified.";
	} else {
		googleProfileStatus = "failed";
		googleProfileDesc = MISSING;
	}
	values.business_address_google_profile = toItem(
		googleAddr != null ? String(googleAddr) : addrStr != null ? String(addrStr) : null,
		googleProfileDesc,
		googleProfileStatus
	);

	const legalName = kybData?.legal_name?.value ?? detailsData?.business_name?.value;
	values.business_name = toItem(
		legalName != null ? String(legalName) : null,
		legalName != null ? "Legal business name." : MISSING
	);

	const website = detailsData?.website?.value ?? kybData?.website_found?.value;
	values.website_parked_domain = toItem(
		website != null ? String(website) : null,
		website != null ? "Website on file." : MISSING
	);
	values.website_status = toItem(
		website != null,
		website != null ? "Website present." : MISSING
	);

	const kybDataByKey = kybData as Record<string, { value?: unknown }> | undefined;
	const watchlistVal = kybDataByKey?.["total_watchlist_hits"]?.value ?? kybDataByKey?.watchlist?.value ?? kybDataByKey?.["trulioo_advanced_watchlist_results"]?.value;
	let watchlistCount: number | null = null;
	if (typeof watchlistVal === "number") watchlistCount = watchlistVal;
	else if (Array.isArray(watchlistVal)) watchlistCount = watchlistVal.length;
	else if (watchlistVal && typeof watchlistVal === "object" && "metadata" in watchlistVal && Array.isArray((watchlistVal as { metadata: unknown[] }).metadata))
		watchlistCount = (watchlistVal as { metadata: unknown[] }).metadata.length;
	values.watchlist_hits = toItem(
		watchlistCount,
		watchlistCount !== null && watchlistCount !== undefined ? (watchlistCount === 0 ? "No watchlist hits." : `${watchlistCount} hit(s).`) : MISSING
	);

	// IDV: three-way state (not_run | failed | verified) from idv_status counts for frontend copy table
	const idvStatusCounts = (kycData?.idv_status?.value ?? kybData?.idv_status?.value) as
		| Record<string, number>
		| undefined;
	const idvState = deriveIdvThreeWayState(idvStatusCounts);
	values.idv_verification = toItem(idvState.status, idvState.description);

	const googlePlaceId = reviewData?.google_place_id?.value ?? detailsData?.google_place_id?.value;
	const reviewRating = reviewData?.review_rating?.value;
	values.google_profile = toItem(
		googlePlaceId ?? reviewRating ?? null,
		(googlePlaceId != null || reviewRating != null) ? "Google profile data." : MISSING
	);

	// Bankruptcies, judgements, liens: prefer public records summary from DB, else BJL facts
	const numBankruptcies = prSummary?.number_of_bankruptcies != null
		? parseInt(String(prSummary.number_of_bankruptcies), 10)
		: (bjlData?.num_bankruptcies?.value ?? bjlData?.bankruptcies?.value?.count);
	values.bankruptcies = toItem(
		numBankruptcies !== undefined && !Number.isNaN(numBankruptcies) ? numBankruptcies : null,
		numBankruptcies !== undefined && !Number.isNaN(numBankruptcies) ? (numBankruptcies === 0 ? "No bankruptcies." : `${numBankruptcies} found.`) : MISSING
	);

	const numJudgements = prSummary?.number_of_judgement_fillings != null
		? parseInt(String(prSummary.number_of_judgement_fillings), 10)
		: (bjlData?.num_judgements?.value ?? bjlData?.judgements?.value?.count);
	values.judgements = toItem(
		numJudgements !== undefined && !Number.isNaN(numJudgements) ? numJudgements : null,
		numJudgements !== undefined && !Number.isNaN(numJudgements) ? (numJudgements === 0 ? "No judgements." : `${numJudgements} found.`) : MISSING
	);

	const numLiens = prSummary?.number_of_business_liens != null
		? parseInt(String(prSummary.number_of_business_liens), 10)
		: (bjlData?.num_liens?.value ?? bjlData?.liens?.value?.count);
	values.liens = toItem(
		numLiens !== undefined && !Number.isNaN(numLiens) ? numLiens : null,
		numLiens !== undefined && !Number.isNaN(numLiens) ? (numLiens === 0 ? "No liens." : `${numLiens} found.`) : MISSING
	);

	const complaintsCount = reviewData?.count_of_complaints_all_time?.value;
	values.complaints = toItem(
		complaintsCount !== undefined && complaintsCount !== null ? Number(complaintsCount) : null,
		complaintsCount !== undefined && complaintsCount !== null ? "Complaints count." : MISSING
	);

	// Adverse media: failed if high_risk_count or medium_risk_count > 0; passed if low_risk_count > 0; else missing.
	const high = adverseMediaRiskCounts?.high_risk_count ?? 0;
	const medium = adverseMediaRiskCounts?.medium_risk_count ?? 0;
	const low = adverseMediaRiskCounts?.low_risk_count ?? 0;
	let adverseMediaStatus: "failed" | "passed" | "missing" = "missing";
	let adverseMediaDesc = MISSING;
	if (adverseMediaTaskIds?.length && adverseMediaRiskCounts) {
		if (high > 0 || medium > 0) {
			adverseMediaStatus = "failed";
			adverseMediaDesc = high > 0 && medium > 0
				? "High and medium risk adverse media found."
				: high > 0
					? "High risk adverse media found."
					: "Medium risk adverse media found.";
		} else if (low > 0) {
			adverseMediaStatus = "passed";
			adverseMediaDesc = `${low} low-risk article(s); no high or medium risk.`;
		} else {
			adverseMediaDesc = "No adverse media.";
		}
	}
	values.adverse_media = toItem(
		adverseMediaTaskIds?.length ? adverseMediaCount : null,
		adverseMediaDesc,
		adverseMediaStatus
	);

	// GIACT: three rows from rel_banking_verifications + display mapper
	const giactVerification = await getGiactVerificationByCaseId(caseId);
	const verifyCode = giactVerification?.verify_response_code ?? null;
	const authCode = giactVerification?.auth_response_code ?? null;
	const accountStatusDisplay = getGiactDisplay("giact_account_status", verifyCode);
	const accountNameDisplay = getGiactDisplay("giact_account_name", authCode);
	const contactVerificationDisplay = getGiactDisplay("giact_contact_verification", authCode);
	values.giact_account_status = toItem(null, accountStatusDisplay.tooltip, accountStatusDisplay.status);
	values.giact_account_name = toItem(null, accountNameDisplay.tooltip, accountNameDisplay.status);
	values.giact_contact_verification = toItem(
		null,
		contactVerificationDisplay.tooltip,
		contactVerificationDisplay.status
	);

	// Email breach, fraud report, and KYC risk rows from owner_verification.value[ownerId].{email_report,fraud_report}
	// owner_verification may be { value: { [ownerId]: {...} } } or (if flattened) just { [ownerId]: {...} }; we use first owner.
	const ownerVerificationRaw = kycData?.owner_verification as { value?: Record<string, unknown> } | Record<string, unknown> | undefined;
	const ownerVerificationValue =
		ownerVerificationRaw && typeof ownerVerificationRaw === "object" && "value" in ownerVerificationRaw && typeof ownerVerificationRaw.value === "object"
			? (ownerVerificationRaw.value as Record<string, { email_report?: Record<string, unknown>; fraud_report?: Record<string, unknown> }>)
			: (ownerVerificationRaw as Record<string, { email_report?: Record<string, unknown>; fraud_report?: Record<string, unknown> }> | undefined);
	const firstOwnerData =
		ownerVerificationValue && typeof ownerVerificationValue === "object" && !Array.isArray(ownerVerificationValue)
			? (Object.values(ownerVerificationValue).find(
					(v): v is Record<string, unknown> => typeof v === "object" && v !== null && ("email_report" in v || "fraud_report" in v)
			  ) as { email_report?: Record<string, unknown>; fraud_report?: Record<string, unknown> } | undefined)
			: undefined;
	const emailReport = firstOwnerData?.email_report;
	const fraudReport = firstOwnerData?.fraud_report;

	const breachCount =
		emailReport != null && typeof emailReport.breach_count === "number" ? emailReport.breach_count : null;
	values.email_breach = toItem(
		breachCount,
		breachCount !== null
			? (breachCount === 0 ? "No email breaches." : `${breachCount} breach(es) in email report.`)
			: MISSING
	);

	const fraudReportProps = typeof fraudReport === "object" && fraudReport !== null ? (fraudReport as Record<string, unknown>) : null;
	const prop = (key: string): unknown =>
		fraudReportProps && key in fraudReportProps ? fraudReportProps[key] : undefined;
	// For fraud report rows: treat key as present even when value is null (so we show description, not MISSING).
	const toItemFromFraudProp = (
		descriptionPresent: string,
		...keys: string[]
	): CaseTabValueItem => {
		const v = keys.map(k => prop(k)).find(x => x !== undefined);
		const keyPresent = keys.some(k => fraudReportProps && k in fraudReportProps);
		const displayValue = v !== undefined && v !== null ? (typeof v === "object" ? JSON.stringify(v) : String(v)) : (keyPresent ? "—" : null);
		const description = keyPresent ? descriptionPresent : MISSING;
		return toItem(displayValue, description);
	};
	values.fraud_results = toItemFromFraudProp("Fraud results from fraud report.", "fraud_ring_detected");
	values.bot_presence = toItemFromFraudProp("Bot presence from fraud report.", "bot_detected");
	values.synthetic_identity_risk_score = toItemFromFraudProp(
		"Synthetic identity risk score from fraud report.",
		"synthetic_identity_risk_score"
	);
	values.stolen_identity_risk_score = toItemFromFraudProp(
		"Stolen identity risk score from fraud report.",
		"stolen_identity_risk_score"
	);

	// created_at from case_results_executions.created_at; baseline for updates_count from case_results_executions.updated_at.
	const [executionTimestamps, caseCreatedAt] = await Promise.all([
		getCaseResultsExecutionTimestamps(caseId),
		getCaseCreatedAtForValues(caseId),
	]);
	const createdAtDate = executionTimestamps.created_at ?? caseCreatedAt ?? null;
	const created_at = createdAtDate ? createdAtDate.toISOString() : null;
	const updated_at = executionTimestamps.updated_at
		? executionTimestamps.updated_at.toISOString()
		: null;
	const baseline =
		executionTimestamps.updated_at ?? executionTimestamps.created_at ?? caseCreatedAt ?? null;

	const [factOverrideCount, publicRecordsTs, idvTs] = await Promise.all([
		baseline ? getFactOverrideUpdatesCount(businessId, baseline) : Promise.resolve(0),
		verdataTaskId ? getPublicRecordsUpdatedAt(verdataTaskId) : Promise.resolve(null),
		getIdentityVerificationLatestUpdatedAt(businessId),
	]);
	let updates_count = 0;
	if (baseline) {
		const t = baseline.getTime();
		updates_count =
			factOverrideCount +
			(publicRecordsTs && publicRecordsTs.getTime() > t ? 1 : 0) +
			(idvTs && idvTs.getTime() > t ? 1 : 0);
	}
	const has_updates_since_generated = updates_count > 0;

	return {
		values,
		created_at,
		updated_at,
		has_updates_since_generated,
		updates_count,
	};
}

/**
 * Updates case_results_executions.updated_at to now for this case (created_at unchanged).
 * Call when re-run completes so GET /values returns updated_at and isRegenerated shows "Regenerated on".
 */
export async function recordCaseResultsExecutionCompleted(
	caseId: string
): Promise<{ updated_at: string }> {
	const now = await updateCaseResultsExecutionTimestamps(caseId);
	return { updated_at: now.toISOString() };
}
