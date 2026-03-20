import type { IntegrationFactGetMetadata, IntegrationProcessFunction } from "../types";
import type { UUID } from "crypto";
import { allFacts, FactEngineWithDefaultOverrides, FactRules } from "#lib/facts";
import { FactName } from "#lib/facts/types";
import { createAdapter } from "../shared/createAdapter";
import { getWorthWebsiteScanningService } from "#lib/worthWebsiteScanning/worthWebsiteScanning";
import { WorthWebsiteScanning } from "#lib/worthWebsiteScanning/worthWebsiteScanning";
import { logger } from "#helpers/logger";
import z from "zod-v4";
import { db } from "#helpers/knex";

const FACT_NAMES: FactName[] = ["website"];

interface WorthWebsiteScanningMetadata {
	website: string;
}

/**
 * Adapter that converts the website fact into metadata for Worth Website Scanning.
 *
 * Worth Website Scanning requires:
 * - Website URL (required) - used for scanning and enrichment
 */
const getMetadata: IntegrationFactGetMetadata<WorthWebsiteScanningMetadata> = async businessID => {
	/** 1. Set up fact engine */
	const fact = allFacts.find(fact => fact.name === "website");
	const factEngine = new FactEngineWithDefaultOverrides([fact], { business: businessID });
	await factEngine.applyRules(FactRules.factWithHighestConfidence);

	/** 2. Fetch website fact */
	const website = factEngine.getResolvedFact<string>("website")?.value;

	/** 3. Validate that website exists */
	if (!website) return undefined;

	/** 4. Return metadata */
	return { website };
};

/**
 * Custom validation to ensure website is a non-empty string
 */
const isValidMetadata = (metadata: WorthWebsiteScanningMetadata | undefined): boolean => {
	const schema = z.object({ website: z.url() });
	const result = schema.safeParse(metadata);
	return result.success;
};

/**
 * Executes the website scan directly, bypassing the deferrable task queue.
 *
 * ## Why this skips the deferrable task queue
 *
 * WorthWebsiteScanning normally runs as a "deferrable task" — when created via
 * `createBusinessEntityWebsiteScanRequestTask` + `processTask`, the task enters
 * a Bull queue where a worker evaluates whether it's ready to execute. The
 * readiness check (`evaluateReadyState`) requires two things to be satisfied:
 *
 * 1. **DEPENDENT_FACTS** — the "website" fact must have at least 1 source.
 * 2. **DEPENDENT_TASKS** — upstream integration tasks must have completed:
 *    - `fetch_business_entity_verification` (ZoomInfo, OpenCorporates, Canada Open)
 *    - `fetch_public_records` (Equifax)
 *    - `fetch_business_entity_website_details` (SERP_SCRAPE)
 *
 * These dependencies exist for the **initial onboarding** flow, where the
 * website URL may not yet be known. The upstream tasks run entity verification
 * and Google Maps searches that may *discover* a website URL. The deferrable
 * system waits for them to finish (or time out after 3 minutes each) before
 * WorthWebsiteScanning proceeds.
 *
 * ## Why this doesn't apply to rerun integrations
 *
 * In a rerun context, the website URL is already known — it comes from the
 * "website" fact, which triggered the rerun in the first place. None of the
 * upstream tasks consume the website URL as input (SERP_SCRAPE searches by
 * business name + address, not by URL), so rerunning them would not produce
 * different results.
 *
 * If we used the deferrable queue here, the task would check whether those
 * upstream tasks have completed. If they ran during onboarding, their old
 * results satisfy the check immediately. If they never ran, the task defers
 * repeatedly until the 5-minute task timeout forces execution — a needless
 * delay for a scan that already has everything it needs.
 *
 * By calling `fetchWebsiteDetails` directly, we skip the deferral loop and
 * execute the scan immediately with the provided URL.
 *
 * The scan runs asynchronously — the task ID is returned immediately so the
 * rerun API response is not blocked by the long-running scan.
 */
const process: IntegrationProcessFunction<WorthWebsiteScanningMetadata> = async params => {
	const businessId = params.business_id as UUID;
	const metadata = params.metadata;
	const service = await getWorthWebsiteScanningService(businessId);

	/** Get or create task with metadata */
	const taskId = await service.getOrCreateTaskForCode({
		taskCode: "fetch_business_entity_website_details",
		metadata,
		reference_id: undefined,
		/**
		 * If there is an existing task but it has different metadata, we cannot reuse it.
		 * In that scenario, we need to create a new task with the new metadata to ensure
		 * that the task is run with the correct metadata.
		 */
		conditions: [db.raw("metadata::text = ?", [JSON.stringify(metadata)])]
	});

	/** Run the scan asynchronously */
	(async () => {
		try {
			const websiteUrl = metadata.website;
			const enrichedTask = await WorthWebsiteScanning.getEnrichedTask(taskId);
			logger.info(
				`[worthWebsiteScanningAdapter] Starting direct website scan for business ${businessId}, URL: ${websiteUrl}`
			);

			/** Execute the scan directly — no deferral, no dependency checks */
			await service.fetchWebsiteDetails(enrichedTask, websiteUrl);
		} catch (error) {
			logger.error(
				error,
				`[worthWebsiteScanningAdapter] Website scan failed for business ${businessId}, task ${taskId}`
			);
		}
	})();

	logger.info(
		`[worthWebsiteScanningAdapter] Website scan started for business ${businessId}, task ${taskId}`
	);

	/** Return the task ID immediately without waiting for the scan to complete */
	return [taskId];
};

/** Attach fact dependencies metadata to the adapter */
export const worthWebsiteScanningAdapter = createAdapter<WorthWebsiteScanningMetadata>({
	getMetadata,
	isValidMetadata,
	factNames: FACT_NAMES,
	process
});
