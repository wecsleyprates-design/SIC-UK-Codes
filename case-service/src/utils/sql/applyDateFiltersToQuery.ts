import { Knex } from "knex";

interface DateFilters {
	[columnName: string]: string[] | string | undefined;
}

/**
 * Applies a WHERE BETWEEN clause to the query for each date filter provided.
 * The date filter should be an array with two elements: [startDate, endDate].
 * Alternatively, it can be a comma-separated string of two dates: "startDate,endDate".
 */
export const applyDateFiltersToQuery = (query: Pick<Knex.QueryBuilder, "whereBetween">, dateFilters: DateFilters) => {
	Object.keys(dateFilters).forEach(column => {
		if (!dateFilters[column]) return;
		const value = typeof dateFilters[column] === "string" ? dateFilters[column].split(",") : dateFilters[column];
		const [startDate, endDate] = value;
		if (!startDate || !endDate) return;
		query.whereBetween(column, [startDate, endDate]);
	});
};
