import { envConfig } from "#configs/env.config";
import knex, { Knex } from "knex";
import { logger } from "./logger";
import { isKnexRaw } from "#utils/typeguards";

type WhereConditionValue = string | number | boolean;
type WhereConditionOperator = "=" | ">" | ">=" | "<" | "<=" | "<>";
//Must have one and only one of operator; in; notIn
export type WhereCondition<T> = {
	column: keyof T;
} & (
	| { value: WhereConditionValue; operator: WhereConditionOperator; in?: never; notIn?: never; isNull?: never }
	| { in: any[]; value?: never; operator?: never; notIn?: never; isNull?: never }
	| { notIn: any[]; value?: never; operator?: never; in?: never; isNull?: never }
	| { isNull: boolean; value?: never; operator?: never; in?: never; notIn?: never }
);
type GenerateWhereClauses<T> = {
	filter: string;
	validColumns?: T extends object ? Array<keyof T> : string[];
	queryBuilder: T extends object ? Knex.QueryBuilder<T> : Knex.QueryBuilder;
	columnToActualMap?: T extends object ? Partial<{ [K in keyof T]: any }> : { [key: string]: string };
};

type FilterCriterion<T> = {
	column: T extends object ? keyof T : string;
	operator: string;
	value: string;
	logicalOperand?: string;
};
type AggregationActionValue = object | string | number | Array<object | string | number> | Function;
type AggregationAction = {
	[K in "select" | "from" | "where" | "groupBy" | "orderBy" | "having" | "andWhere" | "with"]: AggregationActionValue;
};

export type AggregationRubric = {
	[keyof: string]: { [innerKey: string]: Partial<AggregationAction> };
};
const db = knex({
	client: "pg",
	connection: {
		host: envConfig.DB_HOST,
		port: parseInt(envConfig.DB_PORT ?? "5432"),
		user: envConfig.DB_USER,
		password: envConfig.DB_PASSWORD,
		database: envConfig.DB_NAME,
		idle_in_transaction_session_timeout: 30000,
		connectionTimeout: 0,
		ssl: envConfig.ENV === "production" ? { rejectUnauthorized: false } : false
	},
	pool: {
		max: parseInt(envConfig.DB_MAX_CONNECTIONS ?? "10")
	},
	searchPath: ["integrations"]
});
db.on("query", ({ sql, bindings }) => {
	logger.debug(`SQL: ${sql} | data: ${JSON.stringify(bindings)}`);
});

function parseFilter<T>(filter: string): FilterCriterion<T>[] {
	const criteria: FilterCriterion<T>[] = [];

	const individualCriteria = filter.split(/\b(AND|OR|and|or)\b/);
	// Iterate over each individual criterion -- jump by two because the logical operand is at every other index
	for (let i = 0; i < individualCriteria.length; i = i + 2) {
		const criterion = individualCriteria[i].trim();
		const [column, operator, value] = criterion.split(/\s+/, 3);
		let logicalOperand = "AND";
		if (individualCriteria[i - 1] !== undefined) {
			logicalOperand = individualCriteria[i - 1];
		}
		const anyColumn = column as any;
		criteria.push({ column: anyColumn, operator, value, logicalOperand });
	}
	return criteria;
}

/**
 *Parses a filter string and generates a Knex QueryBuilder with the where clauses added
 * @param filter: Natural-ish language filter string to parse
 * @param validColumns: Optional list of valid column names to filter on
 * @param queryBuilder: Optional existing queryBuilder to add where clauses to
 * @returns A Knex QueryBuilder with the where clauses added
 *
 * TODO: Add parenthesis support for grouping criteria
 */
export const applyWhereClausesFromFilter = <T extends Object>({
	filter,
	validColumns,
	queryBuilder,
	columnToActualMap
}: GenerateWhereClauses<T>): Knex.QueryBuilder<T> => {
	const criteria: FilterCriterion<T>[] = parseFilter<T>(filter);
	criteria.forEach(({ column, operator, value, logicalOperand }) => {
		let providedColumn = column as string;
		if (columnToActualMap) {
			providedColumn = columnToActualMap[providedColumn] || providedColumn;
		}
		if (!validColumns || (validColumns && validColumns.includes(column as any))) {
			/* Handle or/and operands with a dynamic function name that changes based on the logical operand
				When "AND" it stays as "where" but switches to "orWhere" if "OR"
				In addition, "IN" and "BETWEEN" operators are suffixes to the function name, so we can execute a "not between"
				with `${operator}NotBetween(args)`
			*/
			let fn: string = "where";
			if (logicalOperand && logicalOperand?.toUpperCase() == "OR") {
				fn = "orWhere";
			}
			switch (operator.toUpperCase()) {
				case "=":
				case "EQUALS":
					queryBuilder[fn](providedColumn, "=", value);
					break;
				case "!=":
				case "NOT_EQUALS":
					queryBuilder[fn](providedColumn, "!=", value);
					break;
				case ">":
				case "GREATER_THAN":
					queryBuilder[fn](providedColumn, ">", value);
					break;
				case "<":
				case "LESS_THAN":
					queryBuilder[fn](providedColumn, "<", value);
					break;
				case ">=":
				case "GREATER_THAN_OR_EQUAL":
					queryBuilder[fn](providedColumn, ">=", value);
					break;
				case "<=":
				case "LESS_THAN_OR_EQUAL":
					queryBuilder[fn](providedColumn, "<=", value);
					break;
				case "LIKE":
				case "~":
					queryBuilder[fn](providedColumn, "like", `${value}%`);
					break;
				case "IN":
					queryBuilder[fn + "In"](providedColumn, value.split(","));
					break;
				case "NOTIN":
				case "NOT_IN":
					queryBuilder[fn + "NotIn"](providedColumn, value.split(","));
					break;
				case "BETWEEN":
				case "..":
					queryBuilder[fn + "Between"](providedColumn, value.split(",", 2));
					break;
				case "NOTBETWEEN":
				case "NOT_BETWEEN":
				case "!..":
					queryBuilder[fn + "NotBetween"](providedColumn, value.split(",", 2));
					break;

				// Add more cases as needed for other operators
			}
		} else {
			logger.warn("Ignoring invalid column in filter criteria " + providedColumn + " " + column);
		}
	});

	return queryBuilder;
};

/* Helper to handle adding a single condition to a query */
export const applyConditionToQuery = <T extends Object>({
	query,
	condition,
	validColumns,
	columnToActualMap
}: {
	query: Knex.QueryBuilder<T>;
	condition: WhereCondition<T> | Knex.Raw<T>;
	validColumns?;
	columnToActualMap?;
}): Knex.QueryBuilder<T> => {
	if (isKnexRaw(condition)) {
		query.where(condition);
	} else if (validColumns && !validColumns.includes(condition.column as any)) {
		logger.warn(`Invalid column ${condition.column as any} in filter criteria`);
	} else {
		let providedColumn = condition.column as string;
		const column = columnToActualMap ? columnToActualMap[providedColumn] || providedColumn : providedColumn;
		if (condition.in) {
			query.whereIn(column, condition.in);
		} else if (condition.notIn) {
			query.whereNotIn(column, condition.notIn);
		} else if (condition.isNull) {
			query.whereNull(column);
		} else if (condition.isNull === false) {
			query.whereNotNull(column);
		} else if (condition.operator) {
			query.where(column, condition.operator || "=", condition.value);
		}
	}

	return query;
};

export const applyConditionsToQuery = <T extends Object>({
	query,
	conditions,
	validColumns,
	columnToActualMap
}: {
	query: Knex.QueryBuilder<T>;
	conditions: (WhereCondition<T> | Knex.Raw)[];
	validColumns?;
	columnToActualMap?;
}): Knex.QueryBuilder<T> => {
	conditions.forEach(condition => {
		query = applyConditionToQuery({ query, condition, validColumns, columnToActualMap });
	});
	return query;
};

/**
 * Helper to handle getting the total record count for a query without any limits or offsets
 * @param query
 * @returns number of records
 */
export const getTotalRecordCount = async <T extends Object>(query: Knex.QueryBuilder<T>): Promise<number> => {
	const count = await query
		.clone()
		.clearSelect()
		.clearOrder()
		.clearGroup()
		.clearHaving()
		.offset(0, { skipBinding: true })
		.count()
		.first();
	return +count.count || 0;
};

export const applyGroupBy = (queryBuilder: Knex.QueryBuilder, rubric: Partial<AggregationAction>) => {
	queryBuilder.clearSelect().clearOrder().offset(0, { skipBinding: true });

	const keys = ["select", "groupBy", "having", "orderBy", "from", "where", "andWhere", "with"];
	for (const key of keys) {
		if (rubric[key]) {
			queryBuilder["worthAggregation"] = true;
			if (typeof rubric[key] === "function") {
				const computedValue = rubric[key](queryBuilder);
				queryBuilder[key](computedValue);
			} else {
				queryBuilder[key](rubric[key]);
			}
		}
	}
	return queryBuilder;
};

export const hasAggregation = queryBuilder => {
	return (
		queryBuilder["worthAggregation"] ||
		queryBuilder["_statements"].some(statement => {
			return statement.grouping === "group";
		})
	);
};

export { db };
