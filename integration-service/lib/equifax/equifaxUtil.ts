import { CONNECTION_STATUS, EVENTS, INTEGRATION_ID, QUEUES } from "#constants";
import { logger } from "#helpers/logger";
import { getConnectionForBusinessAndPlatform, platformFactory } from "#helpers/platformHelper";
import { randomUUID, type UUID } from "crypto";
import { Equifax } from "./equifax";
import BullQueue from "#helpers/bull-queue";
import businessLookupHelper from "#helpers/businessLookupHelper";
import type { IDBConnection } from "#types/db";
import { db } from "#helpers/knex";
import type { Job } from "bull";
import { strategyPlatformFactory } from "#helpers/strategyPlatformFactory";

export class EquifaxUtil {
	/* Shortcut to ensure that a task is created and runs for the given business --- useful for backfilling */
	static runEquifaxPublicRecordsTask = async (businessID: UUID) => {
		logger.debug(`Running equifax public records task for business ${businessID}`);
		let equifaxDbConnection;
		try {
			equifaxDbConnection = await getConnectionForBusinessAndPlatform(businessID, INTEGRATION_ID.EQUIFAX);
		} catch (ex) {
			const insertedConnection = await db<IDBConnection>("integrations.data_connections")
				.insert({
					business_id: businessID,
					platform_id: INTEGRATION_ID.EQUIFAX,
					connection_status: CONNECTION_STATUS.SUCCESS
				})
				.returning("*");
			equifaxDbConnection = insertedConnection[0];
		}
		try {
			const equifax = await strategyPlatformFactory<Equifax>({
				businessID: businessID,
				platformID: INTEGRATION_ID.EQUIFAX
			});
			const equifaxTask = await equifax.getOrCreateTaskForCode({ taskCode: "fetch_public_records" });
			if (equifaxTask) {
				await equifax.processTask({ taskId: equifaxTask });
			}
		} catch (ex) {
			logger.error({ error: ex }, 'Equifax public records task failed');
			throw ex;
		}
	};

	static enqueueMatchRequest = async (requestId: UUID, request: Record<string, any>) => {
		const queue = new BullQueue(QUEUES.BUREAU);
		const jobId = `${requestId}::${request?.providedKey || randomUUID()}`;
		return queue.addJob(
			EVENTS.EQUIFAX_MATCH,
			{ requestId, request },
			{ jobId, removeOnComplete: false, removeOnFail: false }
		);
	};

	static processJobRequest = async (job: Job): Promise<any> => {
		const { tin, customer_id: customerID, external_id: externalID, business_id: businessID } = job.data?.request;
		const businesses = await businessLookupHelper({ tin, businessID, customerID, externalID });

		// Normalize to array if only one business is returned
		const businessList = Array.isArray(businesses) ? businesses : [businesses];
		for (const business of businessList) {
			try {
				await EquifaxUtil.runEquifaxPublicRecordsTask(business?.id as UUID);
			} catch (err: any) {
				logger.error({ error: err }, `Failed to run Equifax task for businessId=${business?.id}`);
				// optionally continue processing others even if one fails
			}
		}
	};
}
