import { BusinessDetails, getBusinessDetails, logger } from "#helpers/index";
import { FactEngine } from "#lib/facts";
import type { FactName, Fact } from "#lib/facts/types";
import { businessFacts } from "#lib/facts/businessDetails";
import { factWithHighestConfidence } from "#lib/facts/rules";
import { parseICAs, normalizeMatchErrors } from "#api/v1/modules/match-pro/utils";
import { matchConnection } from "#api/v1/modules/match-pro/matchConnection";
import { Secrets, ExecutionResult, ICAObject, MatchPreviousReview, TerminationInquiryResponse, MatchTaskMetadata, MatchBusinessResponse } from "./types";
import { Match } from "./match";
import { IBusinessIntegrationTaskEnriched } from "#types/db";

/** Resolved business facts from FactEngine.getResults. */
type AllBusinessFacts = Record<FactName, Partial<Fact>>;

/** Per-ICA result in AggregatedMatchRecord (normalized response or error). */
type AggregatedIcaResult = NonNullable<ExecutionResult["result"]> | { error: string };

/**
 * Resolves which ICAs to execute against by validating requested ICAs
 * against the customer's allowed list, or falling back to defaults.
 */
export function resolveTargetIcas(
	metadataIcas: string[] | undefined,
	customerKeys: Secrets
): { targetIcas: string[]; icaObjects: ICAObject[]; error?: string } {
	const icaObjects = parseICAs(customerKeys.icas);
	const allowedIcas = icaObjects.map(k => k.ica);

	if (metadataIcas && Array.isArray(metadataIcas) && metadataIcas.length > 0) {
		const invalidIcas = metadataIcas.filter(ica => !allowedIcas.includes(ica));
		if (invalidIcas.length > 0) {
			return { targetIcas: [], icaObjects, error: `Unauthorized ICAs are not authorized for customer` };
		}
		return { targetIcas: metadataIcas, icaObjects };
	}

	// Fallback to default ICA(s) configured for the customer.
	// If no ICA is explicitly marked as default, use the first configured ICA (backwards compatible).
	const defaultIcaObjects = icaObjects.filter(ica => ica.isDefault);
	if (defaultIcaObjects.length > 0) {
		return { targetIcas: defaultIcaObjects.map(ica => ica.ica), icaObjects };
	}
	if (icaObjects.length > 0) {
		return { targetIcas: [icaObjects[0].ica], icaObjects };
	}
	return { targetIcas: [], icaObjects };
}

/**
 * Fetches business details and resolves business facts (including MCC code).
 * Returns a result-or-error object so the caller controls error handling.
 */
export async function prepareBusinessData(
	businessId: string
): Promise<{ businessData: BusinessDetails; allBusinessFacts: AllBusinessFacts } | { error: string }> {
	const businessData = await getBusinessDetails(businessId);

	if (businessData.status === "fail") {
		return { error: `Failed to get business details: ${businessData.message}` };
	}

	const factEngine = new FactEngine(businessFacts, { business: businessId });
	await factEngine.applyRules(factWithHighestConfidence);
	const allBusinessFacts = await Match.waitForCompleteFacts(factEngine);

	return {
		businessData: businessData.data,
		allBusinessFacts: allBusinessFacts ?? ({} as AllBusinessFacts)
	};
}

/**
 * Looks up the previous result for a specific ICA from the latest stored record.
 * Handles both multi-ICA aggregated and legacy single-ICA formats.
 */
function findPreviousResultForIca(latestRecord: MatchBusinessResponse, ica: string): MatchPreviousReview {
	if (!latestRecord || Object.keys(latestRecord).length === 0) {
		return {} as MatchPreviousReview;
	}

	if ("multi_ica" in latestRecord && latestRecord.multi_ica && latestRecord.results) {
		return (latestRecord.results[ica] as MatchPreviousReview) ?? ({} as MatchPreviousReview);
	}

	if (!("multi_ica" in latestRecord) || !latestRecord.multi_ica) {
		const legacy = latestRecord as MatchPreviousReview;
		const prevIca =
			legacy.terminationInquiryRequest?.acquirerId || legacy.response?.terminationInquiryRequest?.acquirerId;
		if (prevIca === ica) {
			return latestRecord as MatchPreviousReview;
		}
	}

	return {} as MatchPreviousReview;
}

/**
 * Splits an array into chunks of the given size.
 */
function chunk<T>(arr: T[], size: number): T[][] {
	const chunks: T[][] = [];
	for (let i = 0; i < arr.length; i += size) {
		chunks.push(arr.slice(i, i + size));
	}
	return chunks;
}

/**
 * Processes ICAs in batches against the Match API.
 * Each ICA is checked against cached results before making an API call.
 */
export async function executeIcaBatches(
	targetIcas: string[],
	task: IBusinessIntegrationTaskEnriched<MatchTaskMetadata | null>,
	businessData: BusinessDetails,
	allBusinessFacts: AllBusinessFacts,
	customerKeys: Secrets,
	latestRecord: MatchBusinessResponse
): Promise<ExecutionResult[]> {
	const BATCH_SIZE = 5;

	const processIca = async (ica: string): Promise<ExecutionResult> => {
		try {
			const bodyPayload = await Match.createMatchInquiryPayload(task, ica, { data: businessData }, allBusinessFacts);
			const previousResultForIca = findPreviousResultForIca(latestRecord, ica);

			const isCached = await Match.validatePreviousRequest(bodyPayload, previousResultForIca);
			if (isCached) {
				return { ica, result: previousResultForIca as ExecutionResult["result"], cached: true };
			}

			const record = await matchConnection.makeAuthenticatedRequest(task, JSON.stringify(bodyPayload), customerKeys);
			return { ica, result: { ...record, ...bodyPayload } as ExecutionResult["result"], cached: false };
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : "Unknown error";
			logger.error({ error: err, ica, taskId: task.id }, "Error processing Match ICA");
			return { ica, error: errorMessage, cached: false };
		}
	};

	const executionResults: ExecutionResult[] = [];
	for (const batch of chunk(targetIcas, BATCH_SIZE)) {
		const batchResults = await Promise.all(batch.map(processIca));
		executionResults.push(...batchResults);
	}
	return executionResults;
}

export interface AggregatedMatchRecord {
	multi_ica: true;
	icas: ICAObject[];
	results: Record<string, AggregatedIcaResult>;
	execution_metadata: Record<string, { cached: boolean; timestamp: string }>;
	summary: { total: number; success: number; failed: number };
	timestamp: string;
}

/**
 * Builds the aggregated multi-ICA record from individual execution results.
 */
export function aggregateResults(executionResults: ExecutionResult[], icaObjects: ICAObject[]): AggregatedMatchRecord {
	const resultsMap: Record<string, AggregatedIcaResult> = {};
	const executionMetadata: Record<string, { cached: boolean; timestamp: string }> = {};
	const summary = { total: executionResults.length, success: 0, failed: 0 };
	const timestamp = new Date().toISOString();

	for (const item of executionResults) {
		executionMetadata[item.ica] = { cached: item.cached, timestamp };

		if (item.error) {
			summary.failed++;
			resultsMap[item.ica] = { error: item.error };
		} else {
			summary.success++;
			resultsMap[item.ica] = normalizeMatchErrors(item.result);
		}
	}

	return {
		multi_ica: true,
		icas: icaObjects,
		results: resultsMap,
		execution_metadata: executionMetadata,
		summary,
		timestamp
	};
}
