/**
 * Watchlist Helper Functions
 *
 * Contains utility functions for transforming and processing watchlist data
 * across different sources (business KYB and person PSC screenings).
 */

import { v4 as uuid } from "uuid";
import type { WatchlistValueMetadatum, WatchlistEntityType } from "./types";
import { WATCHLIST_ENTITY_TYPE, WATCHLIST_HIT_TYPE } from "./types";
import type {
	TruliooWatchlistHit,
	TruliooScreenedPersonData
} from "#lib/trulioo/common/types";

/**
 * Creates a deduplication key for watchlist hits based on list title, agency, and entity name.
 * Including entity_name is critical: a single watchlist (e.g. OFAC SDN) can contain many
 * different entities, and each entity is a distinct hit that must be preserved.
 * @param hit - The watchlist hit metadata
 * @returns A unique key for deduplication
 */
export function createWatchlistDedupKey(hit: WatchlistValueMetadatum): string {
	const title = hit.metadata?.title?.toLowerCase().trim() || "";
	const agency = hit.metadata?.agency?.toLowerCase().trim() || "";
	const entityName = hit.metadata?.entity_name?.toLowerCase().trim() || "";
	return `${title}::${agency}::${entityName}`;
}

/**
 * Transforms a TruliooWatchlistHit to WatchlistValueMetadatum format
 * @param hit - The Trulioo watchlist hit
 * @param entityName - The name of the entity (person or business) associated with this hit
 * @param entityType - The type of entity: WATCHLIST_ENTITY_TYPE.BUSINESS for KYB hits, WATCHLIST_ENTITY_TYPE.PERSON for PSC hits
 * @returns WatchlistValueMetadatum object
 */
export function transformTruliooHitToWatchlistMetadata(
	hit: TruliooWatchlistHit,
	entityName: string,
	entityType: WatchlistEntityType = WATCHLIST_ENTITY_TYPE.BUSINESS
): WatchlistValueMetadatum {
	const agencyAbbr = hit.sourceAgencyName
		?.split(" ")
		.map((w: string) => w[0])
		.join("")
		.toUpperCase()
		.substring(0, 10) || hit.listName
			?.split(" ")
			.map((w: string) => w[0])
			.join("")
			.toUpperCase()
			.substring(0, 10) || "";

	return {
		id: uuid(),
		type: hit.listType.toLowerCase(),
		entity_type: entityType,
		metadata: {
			abbr: agencyAbbr,
			title: hit.listName || hit.listType || "",
			agency: hit.sourceAgencyName || hit.listName || "",
			agency_abbr: agencyAbbr,
			entity_name: entityName
		},
		url: hit.url || null,
		list_country: hit.listCountry || null,
		list_region: hit.sourceRegion || null
	};
}

/**
 * Extracts watchlist hits from screened people and transforms them to WatchlistValueMetadatum
 * @param screenedPeople - Array of screened person data
 * @returns Array of watchlist metadata entries with entity_type: "person"
 */
export function extractWatchlistHitsFromScreenedPeople(
	screenedPeople: TruliooScreenedPersonData[]
): WatchlistValueMetadatum[] {
	const metadata: WatchlistValueMetadatum[] = [];

	screenedPeople.forEach((person) => {
		const personName = person.fullName || `${person.firstName || ""} ${person.lastName || ""}`.trim();
		if (!personName) return;

		const watchlistHits = person.screeningResults?.watchlistHits;
		if (!Array.isArray(watchlistHits) || watchlistHits.length === 0) return;

		watchlistHits.forEach((hit: TruliooWatchlistHit) => {
			metadata.push(transformTruliooHitToWatchlistMetadata(hit, personName, WATCHLIST_ENTITY_TYPE.PERSON));
		});
	});

	return metadata;
}

/**
 * Deduplicates watchlist hits based on list title, agency, and entity name
 * @param hits - Array of watchlist metadata hits
 * @returns Deduplicated array of hits
 */
export function deduplicateWatchlistHits(hits: WatchlistValueMetadatum[]): WatchlistValueMetadatum[] {
	const deduplicationSet = new Set<string>();
	const deduplicatedHits: WatchlistValueMetadatum[] = [];

	hits.forEach((hit) => {
		const key = createWatchlistDedupKey(hit);
		if (!deduplicationSet.has(key)) {
			deduplicationSet.add(key);
			deduplicatedHits.push(hit);
		}
	});

	return deduplicatedHits;
}

/**
 * Ensures all watchlist hits have entity_type: BUSINESS (for KYB hits)
 * Handles legacy data that may not have entity_type set
 * Note: New data should already have entity_type set at creation time (in truliooWatchlist.ts and businessEntityVerification.ts)
 * @param hits - Array of watchlist metadata hits (may be undefined or not an array)
 * @returns Array of hits with entity_type: BUSINESS guaranteed
 */
export function ensureBusinessEntityType(
	hits: WatchlistValueMetadatum[] | undefined | null
): WatchlistValueMetadatum[] {
	if (!Array.isArray(hits)) {
		return [];
	}

	return hits.map((hit: WatchlistValueMetadatum) => ({
		...hit,
		// Only set if missing (for legacy data compatibility)
		// New data should already have entity_type set correctly at creation time
		entity_type: hit.entity_type || WATCHLIST_ENTITY_TYPE.BUSINESS
	}));
}

/**
 * Filters out adverse media hits from watchlist metadata.
 * Adverse media hits are handled separately via the adverse media pipeline
 * (scored by OpenAI and persisted in adverse_media_articles table).
 * The watchlist fact should only contain PEP and SANCTIONS hits.
 */
export function filterOutAdverseMedia(
	hits: WatchlistValueMetadatum[]
): WatchlistValueMetadatum[] {
	return hits.filter(hit => hit.type !== WATCHLIST_HIT_TYPE.ADVERSE_MEDIA);
}

/**
 * Type for raw Trulioo watchlist hit (may have optional fields or come from different sources)
 * This type accommodates variations in Trulioo API responses
 */
export type TruliooRawWatchlistHit = Partial<TruliooWatchlistHit> & {
	id?: string;
	listType?: string;
	listName?: string;
	matchDetails?: string;
	sourceAgencyName?: string;
	sourceListType?: string;
	listCountry?: string;
	sourceRegion?: string;
	url?: string;
	[key: string]: unknown; // Allow additional properties from Trulioo responses
};

/**
 * Transforms raw Trulioo watchlist results to WatchlistValueMetadatum format
 * All hits are marked as entity_type: "business" (KYB hits)
 * @param watchlistResults - Raw watchlist results from Trulioo
 * @returns Array of transformed watchlist metadata
 */
export function transformTruliooBusinessWatchlistResults(
	watchlistResults: TruliooRawWatchlistHit[]
): WatchlistValueMetadatum[] {
	return watchlistResults.map((hit: TruliooRawWatchlistHit): WatchlistValueMetadatum => {
		const agencyAbbr =
			hit.sourceAgencyName
				?.split(" ")
				.map((w: string) => w[0])
				.join("")
				.toUpperCase() || "";

		return {
			id: hit.id || `${hit.listType || "unknown"}-${hit.listName || "unknown"}-${Date.now()}-${Math.random()}`,
			type: hit.listType?.toLowerCase() || "sanctions",
			entity_type: WATCHLIST_ENTITY_TYPE.BUSINESS, // All hits from business source are business (KYB) hits
			metadata: {
				abbr: agencyAbbr,
				title: hit.listName || hit.sourceListType || "",
				agency: hit.sourceAgencyName || "",
				agency_abbr: agencyAbbr,
				entity_name: hit.matchDetails || ""
			},
			url: hit.url || null,
			list_country: hit.listCountry || null,
			list_region: hit.sourceRegion || null
		};
	});
}
