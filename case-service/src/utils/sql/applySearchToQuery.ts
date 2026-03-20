import { Knex } from "knex";
import { escapeColumn } from "#utils/escapeColumn";
import { iterateOverSearch } from "./iterateOverSearch";

interface Search {
	[columnName: string | `${string}::${string}`]: string | string[] | undefined;
}

/**
 * Given search input like this:
 * {
 *   column1::text: "value1",
 *   column2::text: ["value2", "value3"]
 * }
 *
 * Generates SQL like this:
 *
 * OR (
 *   column1::text ILIKE '%value1%'
 *   OR column2::text ILIKE '%value2%'
 *   OR column2::text ILIKE '%value3%'
 * )
 */
export const applySearchToQuery = (query: Pick<Knex.QueryBuilder, "orWhereRaw">, search: Search) => {
	iterateOverSearch(search, (columnName, escapedValue) => {
		/**
		 * First, for the exact value in the column.
		 */
		query.orWhereRaw(`${escapeColumn(columnName)} ILIKE ?`, `%${escapedValue}%`);

		/**
		 * Second, search for each word individually.
		 */
		const words = escapedValue.split(/\s+/);
		/**
		 * If there was only a single word, we already handled it above.
		 * In this case, we can skip the additional word search.
		 */
		if (words.length < 2) return;

		words.forEach(word => {
			query.orWhereRaw(`${escapeColumn(columnName)} ILIKE ?`, `%${word.trim()}%`);
		});
	});
};
