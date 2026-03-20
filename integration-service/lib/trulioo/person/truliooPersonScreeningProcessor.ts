import { TruliooBase } from "../common/truliooBase";
import { TruliooUBOPersonData, TruliooWatchlistHit, TruliooFlowResult } from "../common/types";
import { logger } from "#helpers/logger";

/**
 * Trulioo Person Screening Processor
 * Handles processing of screening results from Trulioo PSC flow response
 */
export class TruliooPersonScreeningProcessor {
	private truliooBase: TruliooBase;

	constructor(truliooBase: TruliooBase) {
		this.truliooBase = truliooBase;
	}

	/**
	 * Process screening results from Trulioo PSC flow response
	 */
	async processScreeningResults(personData: TruliooUBOPersonData, flowResult: TruliooFlowResult) {
		try {
			const clientData = flowResult.clientData || {};
			const watchlistHits: TruliooWatchlistHit[] = [];
			let status: "PENDING" | "COMPLETED" | "FAILED" = "PENDING";

			// Process watchlist hits from Trulioo response
			if (clientData.watchlistResults && Array.isArray(clientData.watchlistResults)) {
				for (const hit of clientData.watchlistResults) {
					// Validate required hit data
					if (!hit.listType) {
						logger.warn(`Watchlist hit missing listType, skipping: ${JSON.stringify(hit)}`);
						continue;
					}

					const watchlistHit: TruliooWatchlistHit = {
						listType: this.mapListType(hit.listType),
						listName: hit.listName || "",
						confidence: typeof hit.confidence === "number" ? hit.confidence : 0,
						matchDetails: hit.matchDetails || ""
						// Risk level calculation removed - pending business definition
					};
					watchlistHits.push(watchlistHit);
				}
			}

			// Determine final status
			if (
				clientData.status === "completed" ||
				clientData.status === "COMPLETED" ||
				clientData.status === "success" ||
				clientData.status === "SUCCESS"
			) {
				status = "COMPLETED";
			} else if (
				clientData.status === "failed" ||
				clientData.status === "FAILED" ||
				clientData.status === "error" ||
				clientData.status === "ERROR"
			) {
				status = "FAILED";
			} else if (watchlistHits.length > 0) {
				status = "COMPLETED"; // If we have watchlist hits, consider it completed
			}

			return {
				person: personData,
				status,
				watchlistHits,
				// riskScore removed - pending business definition
				provider: "trulioo",
				screenedAt: new Date().toISOString(),
				metadata: {
					hfSession: flowResult.hfSession,
					flowId:
						typeof flowResult.flowData === "object" && flowResult.flowData && "id" in flowResult.flowData
							? String(flowResult.flowData.id)
							: undefined,
					rawResponse: clientData
				}
			};
		} catch (error: unknown) {
			logger.error(error, "Error processing screening results:");
			return {
				person: personData,
				status: "FAILED" as const,
				watchlistHits: [],
				// riskScore removed - pending business definition
				provider: "trulioo",
				screenedAt: new Date().toISOString(),
				metadata: { error: error instanceof Error ? error.message : "Unknown error" }
			};
		}
	}

	/**
	 * Map Trulioo list type to our internal format
	 * Simple mapping without risk calculation
	 */
	private mapListType(truliooListType: string): "PEP" | "SANCTIONS" | "ADVERSE_MEDIA" | "OTHER" {
		const normalizedType = truliooListType?.toLowerCase() || "";

		if (normalizedType.includes("pep") || normalizedType.includes("politically")) {
			return "PEP";
		}
		if (normalizedType.includes("sanction") || normalizedType.includes("ofac")) {
			return "SANCTIONS";
		}
		if (normalizedType.includes("adverse") || normalizedType.includes("media")) {
			return "ADVERSE_MEDIA";
		}

		return "OTHER";
	}
}
