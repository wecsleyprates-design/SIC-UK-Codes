import { WatchlistValueMetadatum } from "#lib/facts/kyb/types";

export type GroupedWatchlistHitsByEntity = Record<string, WatchlistValueMetadatum[]>;

/**
 * Group watchlist hits by entity_name (case insensitive).
 * All hits with the same entity_name will be grouped together.
 */
export const groupWatchlistHitsByEntityName = (
	hits: WatchlistValueMetadatum[]
): GroupedWatchlistHitsByEntity => {
	const groupedHits: GroupedWatchlistHitsByEntity = {};

	hits.forEach((hit) => {
		const entityName = hit.metadata?.entity_name?.toUpperCase();
		if (!entityName) return;
		if (!groupedHits[entityName]) {
			groupedHits[entityName] = [];
		}
		groupedHits[entityName].push(hit);
	});

	return groupedHits;
};

