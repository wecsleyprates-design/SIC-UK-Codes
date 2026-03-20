import { Knex } from "knex";

interface Filters {
	[columnName: string]: string | string[] | undefined;
}

/**
 * Given input like this:
 * {
 *  "column": "value",
 *  "column": ["value1", "value2"]
 * }
 *
 * Generates SQL like this:
 * WHERE column IN ('value')
 * AND column IN ('value1', 'value2')
 */
export const applyFiltersToQuery = (query: Pick<Knex.QueryBuilder, "whereIn">, filters: Filters) => {
	Object.keys(filters).forEach(column => {
		const value = filters[column];
		if (value === undefined) return;
		const values = Array.isArray(value) ? value : [value];
		query.whereIn(column, values);
	});
};
