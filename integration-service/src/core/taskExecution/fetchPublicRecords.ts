import { Task } from "#api/v1/modules/tasks/task";
import { CONNECTION_STATUS, INTEGRATION_ID } from "#constants";
import { logger, updateConnectionByConnectionId } from "#helpers";
import { EntityMatching } from "#lib/entityMatching/entityMatching";
import type { IBusinessIntegrationTaskEnriched, IDBConnection } from "#types";

export async function fetchPublicRecords<T = any>(
	connection: IDBConnection,
	task: IBusinessIntegrationTaskEnriched<T>
) {
	// mark the connection as SUCCESS for Verdata if it is not already
	try {
		if (
			connection.platform_id === INTEGRATION_ID.VERDATA &&
			connection.connection_status !== CONNECTION_STATUS.SUCCESS
		) {
			await updateConnectionByConnectionId(connection.id, CONNECTION_STATUS.SUCCESS, {});
		}
	} catch (ex: any) {
		logger.error(
			`Error updating connection status for businessId: ${connection.business_id} connectionId=${connection.id}: ${ex.message}`
		);
	}

	logger.debug(`fetch_public_records: taskDetails: ${JSON.stringify(task)}`);
	try {
		const isEntityMatchingEnabled = await EntityMatching.isEnabled(connection.platform_id);
		if (isEntityMatchingEnabled) {
			return;
		}
		const taskObject = await Task.fromId(task.id);
		await taskObject.process.bind(taskObject)();
	} catch (ex: any) {
		logger.error(
			`taskId=${task.id}/${task.platform_code} error in processing public records task: ${ex?.message ?? ""}`
		);
	}
}
