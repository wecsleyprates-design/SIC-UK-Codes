/**
 * Build an INSERT query for inserting rows into a specified table with specified columns.
 *
 * @param {string} table - The name of the table to insert into.
 * @param {Array} columns - An array of column names.
 * @param {Array<Array>} rows - An array of arrays, where each inner array represents a row of values.
 *
 * @returns {string} - The generated INSERT query.
 *
 * @example
 * // Insert rows into 'your_table' with specified columns
 * const query = buildInsertQuery('your_table', ['column1', 'column2'], [[value1, value2], [value3, value4]]);
 */
export const buildInsertQuery = (table, columns, rows) => {
	const columnsString = columns.join(", ");
	const valuesPlaceholder = rows
		.map((row, rowIndex) => {
			const rowValues = row.map((value, colIndex) => `$${rowIndex * columns.length + colIndex + 1}`);
			return `(${rowValues.join(", ")})`;
		})
		.join(", ");

	return `INSERT INTO ${table} (${columnsString}) VALUES ${valuesPlaceholder}`;
};

/**
 * Build a SELECT query with optional additional conditions and specified columns.
 *
 * @param {string} table - The name of the table to query.
 * @param {Array} additionalConditions - An array of column names for additional conditions.
 * @param {Array} columns - An array of column names to select. If not provided, selects all columns.
 *
 * @returns {string} - The generated SELECT query.
 *
 * @example
 * // Select all columns from 'your_table'
 * const query1 = buildSelectQuery('your_table');
 *
 * // Select specific columns with additional conditions
 * const query2 = buildSelectQuery('your_table', ['column1', 'column2'], ['column3', 'column4']);
 *
 * // Select all columns with additional conditions
 * const query3 = buildSelectQuery('your_table', ['column1', 'column2']);
 */
export const buildSelectQuery = (table, columns, additionalConditions) => {
	const columnsString = columns && columns.length ? columns.join(", ") : "*";

	let query = `SELECT ${columnsString} FROM ${table}`;

	if (additionalConditions && additionalConditions.length > 0) {
		const placeholders = additionalConditions.map((column, index) => `${column} = $${index + 1}`).join(" AND ");
		query += ` WHERE ${placeholders}`;
	}

	return query;
};
