import { sqlQuery, sqlTransaction } from "./database";

import { StatusCodes } from "http-status-codes";
import { redis } from "./redis/redis";
import { ERROR_CODES } from "#constants";

export const insertPurgedBusinesses = async (businessIDs: string[], deletedBy: string) => {
	try {
		const queriesArray: string[] = [];
		const valuesArray: any = [];

		for (const businessID of businessIDs) {
			const query = `SELECT db.id, name, tin, customer_id
            FROM data_businesses db LEFT JOIN rel_business_customer_monitoring rbcm on db.id = rbcm.business_id
            where db.id = $1`;

			const result = await sqlQuery({ sql: query, values: [businessID] });

			const insertPurgedBusinessQuery = `
            INSERT INTO purge_business.data_purged_businesses (
                business_id,
                name,
                tin,
                customer_id,
                deleted_by
                ) VALUES
                ${result.rows
									.map((_, i) => `($${i * 5 + 1}, $${i * 5 + 2}, $${i * 5 + 3}, $${i * 5 + 4}, $${i * 5 + 5})`)
									.join(", ")}
                `;

			const values = result.rows.flatMap(row => [row.id, row.name, row.tin, row.customer_id, deletedBy]);

			queriesArray.push(insertPurgedBusinessQuery);
			valuesArray.push(values);
		}
		await sqlTransaction(queriesArray, valuesArray);
	} catch (error) {
		throw error;
	}
};

export const restorePurgedBusinesses = async businessIDs => {
	try {
		const query = `DELETE FROM purge_business.data_purged_businesses WHERE business_id = ANY($1)`;
		await sqlQuery({ sql: query, values: [businessIDs] });
	} catch (error) {
		throw error;
	}
};

class PurgedBusinessMiddlewareError extends Error {
	status: number;
	errorCode: string;
	constructor(message: string, httpStatus: number, errorCode: string) {
		super(message);
		this.name = "PurgedBusinessMiddlewareError";
		this.status = httpStatus;
		this.errorCode = errorCode;
	}
}

export const validatePurgedBusinessHelper = async (businessId, caseId, error = true) => {
	if (businessId == null && caseId == null) {
		if (error) {
			throw new PurgedBusinessMiddlewareError("Business does not exist.", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
		}

		return true;
	}

	if (businessId) {
		const redisKey = `{purged_business}:${businessId}`;
		const isBusinessPurged = await redis.exists(redisKey);

		if (isBusinessPurged && error) {
			throw new PurgedBusinessMiddlewareError("Business does not exist.", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
		}
	}

	if (caseId) {
		const redisKey = `{purged_business}:{cases}:${caseId}`;
		const isBusinessPurged = await redis.exists(redisKey);

		if (isBusinessPurged) {
			throw new PurgedBusinessMiddlewareError("Business does not exist.", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
		}
	}

	return false;
};
