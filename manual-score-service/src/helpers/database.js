import { Pool } from "pg";
import { envConfig } from "#configs/index";
import { logger } from "#helpers/index";

class DatabaseError extends Error {
	constructor(message) {
		super(message);
		this.name = "DatabaseError";
	}
}

const pool = new Pool({
	host: envConfig.DB_HOST,
	port: envConfig.DB_PORT,
	user: envConfig.DB_USER,
	password: envConfig.DB_PASSWORD,
	database: envConfig.DB_NAME,
	max: envConfig.DB_MAX_CONNECTIONS,
	idleTimeoutMillis: 30000,
	connectionTimeoutMillis: 0,
	ssl: envConfig.ENV === "production" ? { rejectUnauthorized: false } : false
});

pool.on("error", (err, _client) => {
	logger.error({ error: err }, `idle client error`);
});

// tests connection and returns done, if successful;
// or else rejects with connection error:
export const connectDb = () => {
	return new Promise((resolve, reject) => {
		// try to connect
		pool.connect((err, client, done) => {
			if (err) {
				return reject(new DatabaseError(`Error connecting to database: ${err.message}`));
			}
			logger.info("Successfully connected to database !!");
			return resolve(done());
		});
	});
};

// Single Query to Postgres
// @param sql: the query for store data
// @param values: the data to be stored
// @return result
export const sqlQuery = async ({ sql, values }) => {
	logger.debug(`sqlQuery() sql: ${sql} | data: ${values}`);
	try {
		const result = await pool.query(sql, values);
		return result.rows;
	} catch (error) {
		throw error;
	}
};

// Retrieve a SQL client with transaction from connection pool. If the client is valid, either
// COMMMIT or ROALLBACK needs to be called at the end before releasing the connection back to pool.
const beginTransaction = async () => {
	const client = await pool.connect();
	try {
		await client.query("BEGIN");
		return client;
	} catch (error) {
		throw error;
	}
};

// Rollback transaction
const rollbackTransaction = async ({ client }) => {
	if (typeof client !== "undefined" && client) {
		try {
			await client.query("ROLLBACK");
		} catch (error) {
			throw error;
		} finally {
			client.release();
		}
	} else {
		logger.warn(`rollback not executed. client is not set`);
	}
};

// Commit transaction
const commitTransaction = async ({ client }) => {
	if (typeof client !== "undefined" && client) {
		try {
			await client.query("COMMIT");
		} catch (error) {
			throw error;
		} finally {
			client.release();
		}
	} else {
		logger.warn(`commit not excuted. client is not set`);
	}
};

// Execute multiple sql statments as a transaction in NO particular order
// @param queries: multiple sql queries
// @param queryValues: values associated with queries
// @return results
export const sqlTransaction = async (queries, queryValues) => {
	if (queries.length !== queryValues.length) {
		throw new DatabaseError("Number of provided queries did not match the number of provided query values arrays");
	}
	const client = await beginTransaction();

	try {
		const queryPromises = [];
		queries.forEach((query, index) => {
			queryPromises.push(client.query(query, queryValues[index]));
		});
		const results = await Promise.all(queryPromises);

		await commitTransaction({ client });
		return results;
	} catch (err) {
		await rollbackTransaction({ client });
		throw err;
	}
};

// Execute multiple sql statments as a transaction in sequential manner
// @param queries: multiple sql queries
// @param queryValues: values associated with queries
// @return results
export const sqlSequencedTransaction = async (queries, queryValues) => {
	if (queries.length !== queryValues.length) {
		throw new DatabaseError("Number of provided queries did not match the number of provided query values arrays");
	}
	const client = await beginTransaction();

	try {
		const results = await queries.reduce(async (promise, query, index) => {
			await promise;
			return client.query(query, queryValues[index]);
		}, true);

		await commitTransaction({ client });
		return results;
	} catch (err) {
		await rollbackTransaction({ client });
		throw err;
	}
};

// Execute a sql statment with a single row of data
// @param sql: the query for store data
// @param data: the data to be stored
// @return result
export const sqlExecSingleRow = async ({ client, sql, values }) => {
	logger.debug(`sqlExecSingleRow() sql: ${sql} | data: ${values}`);
	try {
		const result = await client.query(sql, values);
		logger.debug(`sqlExecSingleRow(): ${result.command} | ${result.rowCount}`);
		return result;
	} catch (error) {
		logger.error({ error }, `sqlExecSingleRow() error | sql: ${sql} | data: ${values}`);
		throw error;
	}
};

// Execute a sql statement with multiple rows of parameter data.
// @param sql: the query for store data
// @param data: the data to be stored
// @return result
export const sqlExecMultipleRows = async ({ client, sql, values }) => {
	logger.debug(`inside sqlExecMultipleRows()`);
	if (values.length !== 0) {
		for (const item of values) {
			try {
				logger.debug(`sqlExecMultipleRows() item: ${item}`);
				logger.debug(`sqlExecMultipleRows() sql: ${sql}`);
				await client.query(sql, item);
			} catch (error) {
				logger.error({ error }, `sqlExecMultipleRows() error`);
				throw new Error(error.message);
			}
		}
	} else {
		logger.error(`sqlExecMultipleRows(): No data available`);
		throw new Error("sqlExecMultipleRows(): No data available");
	}
};

export const sqlInsertRows = async (tableName, data) => {
	const keys = Object.keys(data);
	const insertQuery = `INSERT INTO ${tableName} (${keys.join(", ")}) VALUES (${keys.map((_, index) => `$${index + 1}`).join(", ")})`;
	try {
		await sqlQuery({ sql: insertQuery, values: Object.values(data) });
	} catch (error) {
		throw new Error(error.message);
	}
};
