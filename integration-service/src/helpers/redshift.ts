import { envConfig } from "#configs";
import {
	RedshiftDataClient,
	ExecuteStatementCommand,
	GetStatementResultCommand,
	DescribeStatementCommand,
	type GetStatementResultCommandOutput,
	CancelStatementCommand
} from "@aws-sdk/client-redshift-data";
import { logger } from "./logger";
import { redis } from "./redis";

const redshiftClient = new RedshiftDataClient({
	region: envConfig.AWS_SES_REGION,
	credentials: { accessKeyId: envConfig.AWS_DATA_ACCESS_KEY_ID || envConfig.AWS_ACCESS_KEY_ID || "", secretAccessKey: envConfig.AWS_DATA_ACCESS_KEY_SECRET || envConfig.AWS_ACCESS_KEY_SECRET || "" }
});

const MAX_CONCURRENT_QUERIES = Number(envConfig.MAX_CONCURRENT_QUERIES) || 100;

const cancelStatementQuery = async (queryId: string | undefined) => {
	try {
		const cancelCmd = new CancelStatementCommand({ Id: queryId });
		await redshiftClient.send(cancelCmd);
	} catch (cancelErr) {
		logger.error(`Failed to cancel Redshift statement: ${cancelErr}`);
	}
};

const getActiveQueryCount = async (): Promise<number> => {
	const count = await redis.get("active_queries");
	return count ? Number(count) : 0;
};

// Helper function to increment active query count
const incrementActiveQueries = async () => {
	await redis.incr("active_queries");
};

// Helper function to decrement active query count
const decrementActiveQueries = async () => {
	await redis.decr("active_queries");
};

// Wait for a slot to open if too many queries are running
const waitForSlot = async () => {
	while (true) {
		const activeCount = await getActiveQueryCount();
		if (activeCount < MAX_CONCURRENT_QUERIES) {
			return;
		}
		// logger.info(`Max concurrent queries reached (${activeCount}/${MAX_CONCURRENT_QUERIES}). Waiting...`);
		await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds before checking again
	}
};

/**
 * Executes a SQL query against Amazon Redshift and retrieves the result.
 *
 * This function sends a SQL query to a Redshift cluster using AWS SDK's RedshiftDataClient.
 * It waits for the query execution to complete and returns the result. If the query fails
 * or is aborted, it throws an error with the appropriate message.
 *
 * @param {string} sql - The SQL query string to execute against Redshift.
 * @returns {Promise<object>} - A promise that resolves to the query result object from Redshift.
 * @throws {Error} - Throws an error if the query execution fails or if any AWS SDK command throws an error.
 *
 * @example
 * const sql = "SELECT * FROM my_table";
 * try {
 *   const result = await executeRedshiftQuery(sql);
 *   logger.info(`Red Shift Result: ${JSON.stringify(result)}`);
 * } catch (error) {
 *   logger.error(`Error executing Redshift query: ${error}`);
 * }
 */
export const executeRedshiftQuery = async (sql: string, tries: number = 180) => {
	await waitForSlot(); // Ensure we're within the query limit before proceeding
	await incrementActiveQueries(); // Increase the active query count

	const params = {
		WorkgroupName: envConfig.REDSHIFT_WORKGROUP_NAME,
		ResourceArn: envConfig.REDSHIFT_WORKGROUP_NAME,
		Database: envConfig.REDSHIFT_DATABASE,
		Sql: sql,
		SecretArn: envConfig.REDSHIFT_SECRET_ARN
	};

	let attempts = 0;
	try {
		// Step 1: Execute the query
		const executeCommand = new ExecuteStatementCommand(params);
		const result = await redshiftClient.send(executeCommand);
		const queryId = result.Id;

		// Step 2: Poll for query status until it's FINISHED
		let queryStatus;
		do {
			// Wait for 1 second before polling again
			await new Promise(resolve => setTimeout(resolve, 1000));

			// Check query status
			const describeCommand = new DescribeStatementCommand({ Id: queryId });
			const describeResult = await redshiftClient.send(describeCommand);
			queryStatus = describeResult.Status;
			logger.info(`Current redshift query status: ${queryStatus}`);
			attempts++;
			if (attempts > tries) {
				await cancelStatementQuery(queryId);
				logger.error(`Query ${queryId} Describe Result ${JSON.stringify(describeResult, null, 2)} was canceled due to exceeding the response time limit. Possible timeout threshold exceeded.`);
				break;
			}
		} while (queryStatus !== "FINISHED" && queryStatus !== "FAILED" && queryStatus !== "ABORTED");

		// If the query failed or was aborted, throw an error
		if (queryStatus !== "FINISHED") {
			throw new Error(`Query execution failed with status: ${queryStatus}`);
		}

		// Step 3: Fetch the results once the query is finished
		const getResultCommand = new GetStatementResultCommand({ Id: queryId });
		const response = await redshiftClient.send(getResultCommand);

		logger.info(`Redshift query executed successfully.`);

		return response;
	} catch (error) {
		logger.error(`Error executing Redshift query: ${error}`);
		throw error;
	} finally {
		await decrementActiveQueries(); // Decrease the active query count once done
	}
};

export const unwrapRedshiftResponse = <T = Record<string, any>>(response: GetStatementResultCommandOutput): T[] => {
	let results: T[] = [];
	try {
		// Extract the records and metadata from the response
		const { Records, ColumnMetadata } = response;
		if (!Records || !ColumnMetadata) {
			throw new Error("No records or column metadata found in the response.");
		}
		// Map the records to JavaScript objects using the column metadata
		results = Records?.map(row => {
			let resultObject: T = {} as T;
			row.forEach((field, index) => {
				const columnName = ColumnMetadata[index].name;
				if (!columnName) {
					throw new Error("No column metadata found for index: " + index);
				}
				// Extract the value from the field based on its type
				let value;
				if (field.isNull) {
					value = null;
				} else if (field.booleanValue !== undefined) {
					value = field.booleanValue;
				} else if (field.longValue !== undefined) {
					value = field.longValue;
				} else if (field.doubleValue !== undefined) {
					value = field.doubleValue;
				} else if (field.stringValue !== undefined) {
					value = field.stringValue;
				} else if (field.blobValue !== undefined) {
					value = Buffer.from(field.blobValue).toString(); // Blob handling
				}

				// Assign the value to the corresponding column name in the result object
				resultObject[columnName] = value;
			});
			return resultObject;
		});

		// Log or return the final result set as an array of objects
	} catch (error) {
		logger.error(`Error fetching Redshift results: ${error}`);
	}
	return results;
};

export const executeAndUnwrapRedshiftQuery = async <T = Record<string, any>>(query: string, tries?: number): Promise<T[]> => {
	const response = await executeRedshiftQuery(query, tries);
	return unwrapRedshiftResponse<T>(response);
};

export const serializeBigInt = <T = string>(data: T, toObject = false): string | object | null => {
	if (data == null) {
		return null;
	}
	const str = JSON.stringify(data, (_, value) => (typeof value === "bigint" ? value.toString() : value));
	return toObject ? JSON.parse(str) : str;
};
