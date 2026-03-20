/**
 * Consolidated Watchlist Fact
 *
 * Synthetic fact that merges business-level watchlist hits (from watchlist_raw)
 * with person-level hits (from screened_people) into a single deduplicated result.
 *
 * This replaces the controller-level post-processing that previously overwrote
 * watchlist.value with trulioo_advanced_watchlist_results, ensuring both the
 * synchronous /facts route and the /proxy/facts (warehouse) route return
 * consistent consolidated data.
 */

import type { FactEngine } from "../factEngine";
import type { WatchlistValue, WatchlistValueMetadatum } from "./types";
import type { TruliooScreenedPersonData } from "#lib/trulioo/common/types";
import {
	extractWatchlistHitsFromScreenedPeople,
	createWatchlistDedupKey,
	filterOutAdverseMedia
} from "./watchlistHelpers";

export async function calculateConsolidatedWatchlist(
	engine: FactEngine
): Promise<WatchlistValue | undefined> {
	const watchlistRaw = engine.getResolvedFact("watchlist_raw");
	const screenedPeopleFact = engine.getResolvedFact("screened_people");

	const allMetadata: WatchlistValueMetadatum[] = [];
	const deduplicationSet = new Set<string>();

	if (watchlistRaw?.value && typeof watchlistRaw.value === "object" && "metadata" in watchlistRaw.value) {
		const watchlistValue = watchlistRaw.value as WatchlistValue;
		if (Array.isArray(watchlistValue.metadata)) {
			watchlistValue.metadata.forEach((hit) => {
				const key = createWatchlistDedupKey(hit);
				if (!deduplicationSet.has(key)) {
					deduplicationSet.add(key);
					allMetadata.push(hit);
				}
			});
		}
	}

	if (screenedPeopleFact?.value && Array.isArray(screenedPeopleFact.value)) {
		const screenedPeople = screenedPeopleFact.value as TruliooScreenedPersonData[];
		const personHits = extractWatchlistHitsFromScreenedPeople(screenedPeople);

		personHits.forEach((hit) => {
			const key = createWatchlistDedupKey(hit);
			if (!deduplicationSet.has(key)) {
				deduplicationSet.add(key);
				allMetadata.push(hit);
			}
		});
	}

	const filteredMetadata = filterOutAdverseMedia(allMetadata);

	return {
		metadata: filteredMetadata,
		message: filteredMetadata.length > 0
			? `Found ${filteredMetadata.length} consolidated watchlist hit(s)`
			: "No Watchlist hits were identified"
	};
}
