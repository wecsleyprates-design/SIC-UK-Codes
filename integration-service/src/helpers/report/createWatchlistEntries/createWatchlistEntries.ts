import { Fact } from "#lib/facts/types";
import { WatchlistValue } from "#lib/facts/kyb/types";
import { INTEGRATION_ID } from "#constants";

import { getMiddeskNamesSubmitted } from "./getMiddeskNamesSubmitted";
import { getMiddeskPeopleNames } from "./getMiddeskPeopleNames";
import { groupWatchlistHits } from "./groupWatchlistHits";

type WatchlistEntry = {
	entity_name: string;
	hits: { list: string; agency: string; country?: string | null; url?: string | null }[];
};

/**
 * Extracts business names from Trulioo source when Middesk is not available.
 * Falls back to legal_name fact or watchlist metadata entity_name.
 */
function getTruliooBusinessNames(
	watchlist: Partial<Fact<WatchlistValue>>,
	legal_name?: Partial<Fact<string>>
): { name: string }[] {
	const names: { name: string }[] = [];

	// Try to get business name from legal_name fact (Trulioo source)
	if (legal_name?.value && typeof legal_name.value === "string") {
		names.push({ name: legal_name.value });
	}

	// Extract unique business names from watchlist hits metadata
	const allHits = watchlist?.value?.metadata ?? [];
	const businessNames = new Set<string>();
	allHits.forEach(hit => {
		const entityName = hit.metadata?.entity_name;
		if (entityName && !businessNames.has(entityName.toUpperCase())) {
			businessNames.add(entityName.toUpperCase());
			names.push({ name: entityName });
		}
	});

	return names;
}

/**
 * Extracts people names from Trulioo source when Middesk is not available
 */
function getTruliooPeopleNames(people: Partial<Fact<{ name: string }[]>>): { name: string }[] {
	if (!people) return [];

	// Check if source is Trulioo
	const platformId = Number(people["source.platformId"]);
	if (platformId === INTEGRATION_ID.TRULIOO) {
		return people.value?.map(p => ({ name: p.name })) ?? [];
	}

	// Check alternatives for Trulioo source
	const truliooAlternative = people.alternatives?.find(
		alternative => Number(alternative.source) === INTEGRATION_ID.TRULIOO
	);
	if (truliooAlternative?.value) {
		return truliooAlternative.value.map(p => ({ name: p.name }));
	}

	return [];
}

export const createWatchlistEntries = (
	watchlist: Partial<Fact<WatchlistValue>>,
	names_submitted: Partial<Fact<{ name: string }[]>>,
	people: Partial<Fact<{ name: string }[]>>,
	legal_name?: Partial<Fact<string>>
) => {
	const middeskNamesSubmitted = getMiddeskNamesSubmitted(names_submitted);
	const middeskPeopleNames = getMiddeskPeopleNames(people);

	// Fallback to Trulioo names if Middesk names are empty (for non-US businesses)
	const businessNames = middeskNamesSubmitted.length > 0
		? middeskNamesSubmitted
		: getTruliooBusinessNames(watchlist, legal_name);
	const peopleNames = middeskPeopleNames.length > 0
		? middeskPeopleNames
		: getTruliooPeopleNames(people);

	const allHits = watchlist?.value?.metadata ?? [];

	// Group hits by entity_name, pre-populating with all scanned entities
	// This ensures entities with no hits still appear in the report
	const groupedWatchlistHits = groupWatchlistHits(businessNames, peopleNames, allHits);

	const watchlistEntries: WatchlistEntry[] = [];

	Object.entries(groupedWatchlistHits).forEach(([entityName, hits]) => {
		const entry: WatchlistEntry = {
			entity_name: entityName,
			hits: hits.map(hit => {
				return {
					list: hit.metadata?.title || "",
					agency: hit.metadata?.agency || "",
					country: hit.list_country || null,
					url: hit.url || hit.list_url || hit.agency_information_url || hit.agency_list_url || null
				};
			})
		};
		watchlistEntries.push(entry);
	});

	return watchlistEntries;
};
