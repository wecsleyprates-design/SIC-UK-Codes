import { type PeopleResponse, type WatchlistPersonResult } from "#api/v1/modules/verification/types";

export type GroupedPeopleWatchlistHits = Record<string, WatchlistPersonResult[]>;

/**
 * Combine and group watchlist hits by person name (case insensitive).
 * The names in the people names array and the names in the hits will not necessarily be equivalent;
 * if a name does not appear in the hits, it indicates that there were no watchlist hits for that person.
 */
export const groupPeopleWatchlistHits = (peopleNames: { name: string }[], hits: PeopleResponse[]) => {
	const groupedHits: GroupedPeopleWatchlistHits = {};

	peopleNames.forEach(name => {
		groupedHits[name.name.toUpperCase()] = [];
	});

	hits.forEach(hit => {
		const name = hit.name.toUpperCase();
		if (!groupedHits[name]) groupedHits[name] = [];
		if (hit.watchlist_results) groupedHits[name] = groupedHits[name].concat(hit.watchlist_results);
	});

	return groupedHits;
};
