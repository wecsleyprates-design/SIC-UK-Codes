import { envConfig } from "#configs/index";
import { logger } from "#helpers/index";
import { Pool, QueryArrayResult, type QueryResult, type QueryResultRow } from "pg";

class DatabaseError extends Error {
	constructor(message) {
		super(message);
		this.name = "DatabaseError";
	}
}

const pool = new Pool({
	host: envConfig.DB_HOST,
	port: parseInt(envConfig.DB_PORT || "") || 5432,
	user: envConfig.DB_USER,
	password: envConfig.DB_PASSWORD,
	database: envConfig.DB_NAME,
	max: parseInt(envConfig.DB_MAX_CONNECTIONS || "") || 100,
	idleTimeoutMillis: 30000,
	connectionTimeoutMillis: 0,
	ssl: envConfig.ENV === "production" ? { rejectUnauthorized: false } : false
});

pool.on("error", (err, _client) => {
	logger.error({ err }, "idle client error");
});

/**
 * tests connection and returns done, if successful;
 * or else rejects with connection error:
 */
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

/**
 * Single Query to Postgres
 * @param sql: the query for store data
 * @param values: the data to be stored
 * @return result
 */
export const sqlQuery = async <T extends QueryResultRow = any, V extends any[] = any[]>({ sql, values }: { sql: string; values?: V }): Promise<QueryResult<T>> => {
	logger.debug(`sqlQuery() sql: ${sql} | data: ${values}`);
	try {
		const result = await pool.query<T, V>(sql, values);
		return result;
	} catch (error: unknown) {
		throw new DatabaseError((error as any).message);
	}
};

/**
 * Retrieve a SQL client with transaction from connection pool. If the client is valid, either
 * COMMMIT or ROALLBACK needs to be called at the end before releasing the connection back to pool.
 */
export const beginTransaction = async () => {
	const client = await pool.connect();
	try {
		await client.query("BEGIN");
		return client;
	} catch (error: unknown) {
		throw new DatabaseError((error as any).message);
	}
};

// Rollback transaction
export const rollbackTransaction = async ({ client }) => {
	if (typeof client !== "undefined" && client) {
		try {
			await client.query("ROLLBACK");
		} catch (error) {
			throw new DatabaseError((error as any).message);
		} finally {
			client.release();
		}
	} else {
		logger.warn(`rollback not executed. client is not set`);
	}
};

// Commit transaction
export const commitTransaction = async ({ client }) => {
	if (typeof client !== "undefined" && client) {
		try {
			await client.query("COMMIT");
		} catch (error) {
			throw new DatabaseError((error as any).message);
		} finally {
			client.release();
		}
	} else {
		logger.warn(`commit not excuted. client is not set`);
	}
};

/**
 * Execute multiple sql statments as a transaction in NO particular order
 * @param queries: multiple sql queries
 * @param queryValues: values associated with queries
 * @return results
 */
export const sqlTransaction = async (queries, queryValues) => {
	if (queries.length !== queryValues.length) {
		throw new DatabaseError("Number of provided queries did not match the number of provided query values arrays");
	}
	const client = await beginTransaction();

	try {
		const queryPromises: any[] = [];
		queries.forEach((query, index) => {
			queryPromises.push(client.query(query, queryValues[index]));
		});
		const results = await Promise.all(queryPromises);

		await commitTransaction({ client });
		return results;
	} catch (err) {
		await rollbackTransaction({ client });
		throw new DatabaseError(`Error occurred while executing transaction : ${(err as any).message}`);
	}
};

/**
 * Execute multiple sql statments as a transaction in sequential manner
 * @param queries: multiple sql queries
 * @param queryValues: values associated with queries
 * @return results
 */
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
		throw new DatabaseError(`Error occurred while executing sequenced transaction : ${(err as any).message}`);
	}
};

/**
 * Execute a sql statment with a single row of data
 * @param sql: the query for store data
 * @param data: the data to be stored
 * @return result
 */
export const sqlExecSingleRow = async ({ client, sql, values }) => {
	logger.debug(`sqlExecSingleRow() sql: ${sql} | data: ${values}`);
	try {
		const result = await client.query(sql, values);
		logger.debug(`sqlExecSingleRow(): ${result.command} | ${result.rowCount}`);
		return result;
	} catch (error) {
		logger.error({ error }, `sqlExecSingleRow() error | sql: ${sql} | data: ${values}`);
		throw new Error((error as any).message);
	}
};

/**
 * Execute a sql statement with multiple rows of parameter data.
 * @param sql: the query for store data
 * @param data: the data to be stored
 * @return result
 */
export const sqlExecMultipleRows = async ({ client, sql, values }) => {
	logger.debug(`inside sqlExecMultipleRows()`);
	if (values.length !== 0) {
		for (const item of values) {
			try {
				logger.debug(`sqlExecMultipleRows() item: ${item}`);
				logger.debug(`sqlExecMultipleRows() sql: ${sql}`);
				await client.query(sql, item);
			} catch (error) {
				logger.error({ error }, "sqlExecMultipleRows() error");
				throw new Error((error as any).message);
			}
		}
	} else {
		logger.error(`sqlExecMultipleRows(): No data available`);
		throw new Error("sqlExecMultipleRows(): No data available");
	}
};
