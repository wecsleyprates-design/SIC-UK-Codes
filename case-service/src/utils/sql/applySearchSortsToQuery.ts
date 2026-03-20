import { Knex } from "knex";
import { escapeColumn } from "#utils/escapeColumn";
import { iterateOverSearch } from "./iterateOverSearch";

interface Search {
	[columnName: string | `${string}::${string}`]: string | string[] | undefined;
}

/**
 * Applies sorting to the query based on the search input.
 * This is useful for prioritizing results that match the search terms exactly over those that match only partially.
 */
export const applySearchSortsToQuery = (query: Pick<Knex.QueryBuilder, "orderByRaw">, search: Search) => {
	iterateOverSearch(search, (columnName, escapedValue) => {
		query.orderByRaw(`CASE WHEN ${escapeColumn(columnName)} ILIKE ? THEN 0 ELSE 1 END`, [`%${escapedValue}%`]);
	});
};
