import { Knex } from "knex";

interface Sorts {
	[columnName: string]: "ASC" | "DESC" | undefined;
}

/**
 * Given input like this:
 * {
 *  "column1": "asc",
 *  "column2": "desc"
 * }, "combine"
 *
 * Generates SQL like this:
 * ORDER BY column1 ASC, column2 DESC
 *
 * i.e. if the strategy is "combine", it will combine all the sorts
 *
 * Given input like this:
 * {
 *  "column1": "asc",
 *  "column2": "desc"
 * }, "override"
 *
 * Generates SQL like this:
 * ORDER BY column2 DESC
 *
 * i.e. if the strategy is "override", it will prefer the last given sort
 */
export const applySortsToQuery = (
	query: Pick<Knex.QueryBuilder, "orderBy" | "clearOrder">,
	sorts: Sorts,
	strategy: "combine" | "override" = "combine"
) => {
	Object.keys(sorts).forEach(column => {
		const value = sorts[column];
		if (value === undefined) return;
		if (strategy === "override") query.clearOrder();

		const sortOrder = value === "ASC" ? "asc" : "desc";
		query.orderBy(column, sortOrder);
	});
};
