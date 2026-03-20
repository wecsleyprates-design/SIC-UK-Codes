import { sources } from "./sources";
import type { Fact } from "./types";
import type { FactEngine } from "./factEngine";
import type { TruliooScreenedPersonData, TruliooWatchlistHit, TruliooFlowResult } from "#lib/trulioo/common/types";

/** Shape returned by sources.person getter (PSC screening records) */
interface TruliooPersonSourceResponse {
	screenedPersons?: TruliooScreenedPersonData[];
}

/**
 * Trulioo-specific facts for business verification and person screening.
 * Provides integration with Trulioo KYB and PSC flows.
 *
 * Watchlist architecture (single source of truth):
 *   watchlist_raw  ──┐
 *                    ├──► watchlist (consolidated: business + person, deduplicated)
 *   screened_people ─┘        └──► watchlist_hits (number)
 *
 * The consolidated `watchlist` fact (defined in kyb/index.ts) is the canonical
 * source for all watchlist data. `watchlist_hits` (also in kyb/index.ts) derives
 * the count from it. No vendor names are exposed in fact names.
 */

export const truliooFacts: readonly Fact[] = [
	{
		name: "business_verified",
		source: sources.business,
		fn: async (_, truliooResponse: TruliooFlowResult | undefined): Promise<boolean> => {
			return truliooResponse?.clientData?.status === "completed" || truliooResponse?.clientData?.status === "success";
		},
		description: "Whether business is verified"
	},

	{
		name: "screened_people",
		source: sources.person,
		fn: async (_, truliooPersonResponse: TruliooPersonSourceResponse | undefined): Promise<TruliooScreenedPersonData[]> => {
			return truliooPersonResponse?.screenedPersons || [];
		},
		description: "People screened by PSC flow"
	},

	{
		name: "pep_hits",
		source: sources.person,
		fn: async (_, truliooPersonResponse: TruliooPersonSourceResponse | undefined): Promise<TruliooWatchlistHit[]> => {
			const allHits: TruliooWatchlistHit[] = [];
			truliooPersonResponse?.screenedPersons?.forEach((person: TruliooScreenedPersonData) => {
				if (person.screeningResults?.watchlistHits) {
					allHits.push(
						...person.screeningResults.watchlistHits.filter((hit: TruliooWatchlistHit) => hit.listType === "PEP")
					);
				}
			});
			return allHits;
		},
		description: "PEP (Politically Exposed Person) hits from screening"
	},

	{
		name: "sanctions_hits",
		source: sources.person,
		fn: async (_, truliooPersonResponse: TruliooPersonSourceResponse | undefined): Promise<TruliooWatchlistHit[]> => {
			const allHits: TruliooWatchlistHit[] = [];
			truliooPersonResponse?.screenedPersons?.forEach((person: TruliooScreenedPersonData) => {
				if (person.screeningResults?.watchlistHits) {
					allHits.push(
						...person.screeningResults.watchlistHits.filter((hit: TruliooWatchlistHit) => hit.listType === "SANCTIONS")
					);
				}
			});
			return allHits;
		},
		description: "Sanctions hits from screening"
	},

	{
		name: "adverse_media_hits",
		source: sources.person,
		fn: async (_, truliooPersonResponse: TruliooPersonSourceResponse | undefined): Promise<TruliooWatchlistHit[]> => {
			const allHits: TruliooWatchlistHit[] = [];
			truliooPersonResponse?.screenedPersons?.forEach((person: TruliooScreenedPersonData) => {
				if (person.screeningResults?.watchlistHits) {
					allHits.push(
						...person.screeningResults.watchlistHits.filter(
							(hit: TruliooWatchlistHit) => hit.listType === "ADVERSE_MEDIA"
						)
					);
				}
			});
			return allHits;
		},
		description: "Adverse media hits from screening"
	},

	{
		name: "high_risk_people",
		dependencies: ["screened_people"],
		source: sources.calculated,
		fn: async (engine: FactEngine): Promise<TruliooScreenedPersonData[]> => {
			const people = engine.getResolvedFact("screened_people")?.value;
			if (!Array.isArray(people)) return [];

			return people.filter((person: TruliooScreenedPersonData) => {
				const hits = person.screeningResults?.watchlistHits || [];
				return hits.length > 0;
			});
		},
		description: "People with watchlist hits from screening"
	},

	{
		name: "kyb_complete",
		dependencies: ["business_verified", "screened_people"],
		source: sources.calculated,
		fn: async (engine: FactEngine): Promise<boolean> => {
			const businessVerified = engine.getResolvedFact("business_verified")?.value;
			const peopleScreened = engine.getResolvedFact("screened_people")?.value;

			return businessVerified === true && Array.isArray(peopleScreened) && peopleScreened.length > 0;
		},
		description: "Whether KYB process is complete (business verified + people screened)"
	},

	{
		name: "risk_score",
		dependencies: ["watchlist_hits", "high_risk_people"],
		source: sources.calculated,
		fn: async (engine: FactEngine): Promise<number> => {
			const watchlistHits = (engine.getResolvedFact("watchlist_hits")?.value as number) || 0;
			const highRiskPeople = (engine.getResolvedFact("high_risk_people")?.value as TruliooScreenedPersonData[]) || [];

			let riskScore = 0;
			riskScore += watchlistHits * 10;
			riskScore += highRiskPeople.length * 20;

			return Math.min(riskScore, 100);
		},
		description: "Risk score based on watchlist hits and high-risk people (0-100)"
	},

	{
		name: "compliance_status",
		dependencies: ["business_verified", "risk_score"],
		source: sources.calculated,
		fn: async (engine: FactEngine): Promise<string> => {
			const businessVerified = engine.getResolvedFact("business_verified")?.value as boolean;
			const riskScore = (engine.getResolvedFact("risk_score")?.value as number) || 0;

			if (!businessVerified) return "pending";
			if (riskScore >= 80) return "high_risk";
			if (riskScore >= 50) return "medium_risk";
			return "low_risk";
		},
		description: "Compliance status based on verification and risk assessment"
	},

	// Document facts
	{
		name: "shareholder_document",
		dependencies: ["business_verified"], // Ensure this fact is resolved after business verification
		source: sources.calculated,
		fn: async (engine: FactEngine) => {
			const { logger } = await import("#helpers/logger");
			logger.debug(`[shareholder_document] Fact function called - starting resolution`);
			const businessId = engine.getScopeValue("business");
			logger.debug(`[shareholder_document] Business ID from scope: ${businessId}`);
			if (!businessId) {
				logger.warn(`[shareholder_document] No business ID found in scope, returning undefined`);
				return undefined;
			}

			try {
				const { db } = await import("#helpers/knex");
				const { getCachedSignedUrlFromS3 } = await import("#common/common");

				const fileName = "shareholder-document.pdf";
				const upload = await db("integration_data.business_entity_verification_uploads")
					.select("*")
					.where({ business_id: businessId, file_name: fileName })
					.first();

				logger.debug(`[shareholder_document] Found Trulioo document upload for business: ${businessId}, file: ${fileName}, exists: ${!!upload}`);
				if (!upload) {
					return undefined;
				}

				// Get signed S3 URL
				const signedUrl = await getCachedSignedUrlFromS3(upload.file_name, upload.file_path);
				logger.debug(`[shareholder_document] Fetched signed URL for Trulioo document: ${upload.file_name} for business: ${businessId}`);
				if (!signedUrl || !signedUrl.signedRequest) {
					logger.warn(`[shareholder_document] Could not get signed URL for Trulioo document: ${upload.file_name}`);
					return undefined;
				}

				return {
					url: signedUrl.signedRequest,
					file_name: upload.file_name,
					id: upload.id
				};
			} catch (error) {
				logger.error(error, `[shareholder_document] Error fetching Trulioo shareholder document for business: ${businessId}`);
				return undefined;
			}
		},
		description: "Shareholder document PDF from KYB verification (signed S3 URL)"
	}
];
