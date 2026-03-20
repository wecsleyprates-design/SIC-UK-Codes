import { db } from "#helpers/knex";
import { logger } from "#helpers/logger";
import type { UUID } from "crypto";
import type { IBusinessEntityReviewTask } from "#types/db";
import { TruliooWatchlistHit, TruliooFlowResult, TruliooBusinessData, TruliooFlows } from "../common/types";
import { WatchlistValueMetadatum, WATCHLIST_ENTITY_TYPE } from "#lib/facts/kyb/types";
import { v4 as uuid } from "uuid";
import { TruliooUBOExtractor } from "./truliooUBOExtractor";
import { TruliooBase } from "../common/truliooBase";
import { INTEGRATION_ID } from "#constants";

function mapWatchlistHit(hit: TruliooWatchlistHit, entityName: string): WatchlistValueMetadatum {
	const { agency, agencyAbbr } = mapAgencyFromListType(hit.listType, hit.listName);

	// Use sourceAgencyName if available, otherwise use mapped agency
	const finalAgency = hit.sourceAgencyName || agency;
	const finalAgencyAbbr = hit.sourceAgencyName
		? hit.sourceAgencyName
				.split(" ")
				.map((w: string) => w[0])
				.join("")
				.toUpperCase()
				.substring(0, 10)
		: agencyAbbr;

	return {
		id: uuid(),
		type: hit.listType.toLowerCase(),
		entity_type: WATCHLIST_ENTITY_TYPE.BUSINESS, // Business watchlist hits are always BUSINESS (KYB)
		metadata: {
			abbr: finalAgencyAbbr,
			title: hit.listName,
			agency: finalAgency,
			agency_abbr: finalAgencyAbbr,
			entity_name: entityName
		},
		url: hit.url || null,
		list_country: hit.listCountry || null,
		list_region: hit.sourceRegion || null
	};
}

export function mapWatchlistHits(hits: TruliooWatchlistHit[], entityName: string): WatchlistValueMetadatum[] {
    return hits.map(hit => mapWatchlistHit(hit, entityName));
}

function mapAgencyFromListType(listType: TruliooWatchlistHit["listType"], listName: string): { agency: string; agencyAbbr: string } {
    const n = listName.toLowerCase();
    const patterns: Record<string, { agency: string; agencyAbbr: string }> = {
        PEP: { agency: "Politically Exposed Persons", agencyAbbr: "PEP" },
        ADVERSE_MEDIA: { agency: "Adverse Media", agencyAbbr: "ADVERSE" },
        SANCTIONS: { agency: "Sanctions List", agencyAbbr: "SANCTIONS" },
        ofac: { agency: "Office of Foreign Assets Control", agencyAbbr: "OFAC" },
        bis: { agency: "Bureau of Industry and Security", agencyAbbr: "BIS" },
        dos: { agency: "State Department", agencyAbbr: "DOS" }
    };
    if (listType === "PEP" || listType === "ADVERSE_MEDIA") return patterns[listType];
    if (["ofac", "office of foreign assets control", "specially designated nationals", "sdn", "sectoral sanctions", "non-sdn"].some(p => n.includes(p))) return patterns.ofac;
    if (["bis", "bureau of industry and security", "entity list", "denied persons", "unverified list"].some(p => n.includes(p))) return patterns.bis;
    if (["state department", "itar", "nonproliferation"].some(p => n.includes(p))) return patterns.dos;
    if (n.includes("pep") || n.includes("politically exposed")) return patterns.PEP;
    if (n.includes("adverse") || n.includes("media")) return patterns.ADVERSE_MEDIA;
    if (listType === "SANCTIONS" || n.includes("sanction")) return patterns.SANCTIONS;
    logger.warn(`Unknown watchlist agency for listType: ${listType}, listName: ${listName}`);
    return { agency: "Unknown Agency", agencyAbbr: "UNKNOWN" };
}

export async function storeBusinessWatchlistResults(businessEntityVerificationId: UUID, businessName: string, watchlistHits: TruliooWatchlistHit[]): Promise<void> {
    try {
        const hasHits = watchlistHits && watchlistHits.length > 0;
        const metadataArray = hasHits ? mapWatchlistHits(watchlistHits, businessName) : [];
        // Serialize metadata to JSON string for PostgreSQL JSON column
        const metadataJson = JSON.stringify(metadataArray);
        
        // Total hits is now the number of individual entries (each entry represents one hit)
        const totalHits = hasHits ? watchlistHits.length : 0;
        
        await db<IBusinessEntityReviewTask>("integration_data.business_entity_review_task")
            .insert({
                business_entity_verification_id: businessEntityVerificationId,
                category: "compliance",
                key: "watchlist" as const,
                status: hasHits ? "warning" : "success",
                message: hasHits ? `Found ${totalHits} watchlist hit(s) for ${businessName}` : "No watchlist hits found",
                label: "Watchlist Screening",
                sublabel: hasHits ? `${totalHits} hit(s) found` : "No hits found",
                metadata: db.raw("?::jsonb", [metadataJson]) // Use db.raw to explicitly cast to jsonb
            })
            .onConflict(["business_entity_verification_id", "key"])
            .merge({ status: db.raw("EXCLUDED.status"), message: db.raw("EXCLUDED.message"), label: db.raw("EXCLUDED.label"), sublabel: db.raw("EXCLUDED.sublabel"), metadata: db.raw("EXCLUDED.metadata") });
        logger.info(`Watchlist results stored for business entity verification: ${businessEntityVerificationId} (${totalHits} individual hits)`);
    } catch (error: unknown) {
        logger.error(error, `Error storing watchlist results for business entity verification: ${businessEntityVerificationId}`);
        throw error;
    }
}

export async function hasWatchlistHits(businessEntityVerificationId: UUID): Promise<boolean> {
    try {
        const reviewTask = await db<IBusinessEntityReviewTask>("integration_data.business_entity_review_task")
            .where({ business_entity_verification_id: businessEntityVerificationId, key: "watchlist" })
            .first();
        if (!reviewTask) return false;
        const metadata = typeof reviewTask.metadata === "string" ? JSON.parse(reviewTask.metadata) : reviewTask.metadata;
        return Array.isArray(metadata) && metadata.length > 0;
    } catch (error: unknown) {
        logger.error(error, `Error checking watchlist hits for business entity verification: ${businessEntityVerificationId}`);
        return false;
    }
}

export async function conditionallyScreenUBOs(businessEntityVerificationId: UUID, businessId: string, businessData: TruliooBusinessData, flowResult: TruliooFlowResult): Promise<void> {
    try {
        if (!(await hasWatchlistHits(businessEntityVerificationId))) {
            logger.info(`No watchlist hits found for business ${businessId}. Skipping UBO screening.`);
            return;
        }
        logger.info(`Watchlist hits found for business ${businessId}. Proceeding with UBO/Director screening.`);
        const truliooBase = new (class extends TruliooBase {
            getIntegrationId(): number { return INTEGRATION_ID.TRULIOO; }
            getFlowType(): string { return TruliooFlows.KYB; }
        })(businessId);
        const screenedPeople = await new TruliooUBOExtractor(truliooBase).extractAndScreenUBOsDirectors(businessEntityVerificationId, businessData, flowResult);
        logger.info(`UBO screening completed for business ${businessId}. ${screenedPeople.length} person(s) screened.`);
    } catch (error: unknown) {
        logger.error(error, `Error in conditional UBO screening for business entity verification: ${businessEntityVerificationId}`);
    }
}

