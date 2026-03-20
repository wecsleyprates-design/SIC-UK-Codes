import { WatchlistValueMetadatum } from "#lib/facts/kyb/types";

export type GroupedKybWatchlistHits = Record<string, WatchlistValueMetadatum[]>;

/**
 * Combine and group watchlist hits by business name (case insensitive).
 * The names in the names submitted array and the names in the hits will not necessarily be equivalent;
 * if a name does not appear in the hits, it indicates that there were no watchlist hits for that business name.
 */
export const groupWatchlistHits = (namesSubmitted: { name: string }[], peopleNames: { name: string }[], hits: WatchlistValueMetadatum[]) => {
	const groupedHits: GroupedKybWatchlistHits = {};

	// Pre-populate with all scanned entities (business names + people names)
	// This ensures entities with no hits still appear in the report
	const allScannedEntities = [...namesSubmitted, ...peopleNames];
	allScannedEntities.forEach(entity => {
		groupedHits[entity.name.toUpperCase()] = [];
	});

	hits.forEach(hit => {
		const name = hit.metadata.entity_name.toUpperCase();
		if (!groupedHits[name]) groupedHits[name] = [];
		groupedHits[name].push(hit);
	});

	return groupedHits;
};
