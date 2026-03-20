import { prepareIntegrationDataForScore } from "#common";
import { CONNECTION_STATUS } from "#constants";
import { logger } from "#helpers";
import { GIACT } from "#lib/giact/giact";
import type { IBusinessIntegrationTaskEnriched, IDBConnection } from "#types";

export async function fetchGiactVerification<T = any>(
	connection: IDBConnection,
	task: IBusinessIntegrationTaskEnriched<T>
): Promise<void> {
	logger.info(`running giact verification`);
	let giact: GIACT | null = null;
	const actions = {};
	try {
		// Use proper GIACT initialization method that handles feature flags and strategy mode
		giact = await GIACT.initializeGiactConnection(task.business_id, task.customer_id);
	} catch (ex) {
		// Fallback to initializing a new GIACT connection
		logger.warn(`Failed to initialize GIACT connection, initializing a new one.`);
		giact = await GIACT.initializeGiactConnection(task.business_id, task.customer_id);
	} finally {
		try {
			if (giact && task.case_id) {
				// mark connection as success
				await giact.updateConnectionStatus(
					CONNECTION_STATUS.SUCCESS,
					JSON.stringify({ task: "fetch_giact_verification" })
				);

				actions["giact"] = await giact.processTask({
					taskId: task.id,
					businessID: connection.business_id,
					caseID: task.case_id
				});
			}
		} catch (err) {
			logger.error(`Error in giact verification for business ${task.business_id}. Error: ${(err as Error).message}`);
			actions["giact"] = { error: (err as Error).message };
		}
		await prepareIntegrationDataForScore(task.id);
	}
	logger.info(`GIACT verification completed for business ${task.business_id}. Actions: ${JSON.stringify(actions)}`);
}
