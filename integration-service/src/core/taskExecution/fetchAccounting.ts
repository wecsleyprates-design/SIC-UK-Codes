import { Task } from "#api/v1/modules/tasks/task";
import { CONNECTION_STATUS, INTEGRATION_ID } from "#constants";
import { logger, platformFactory } from "#helpers";
import type { IBusinessIntegrationTaskEnriched, IDBConnection } from "#types";

export async function fetchAccounting<T = any>(
	connection: IDBConnection,
	task: IBusinessIntegrationTaskEnriched<T>
): Promise<void> {
	try {
		if (connection.platform_id === INTEGRATION_ID.MANUAL_ACCOUNTING) {
			logger.info(`ACCOUNTING TASK CONNECTION IS MANUAL ACCOUNTING: ${JSON.stringify(connection)}`);
			const manualAccounting = platformFactory({ dbConnection: connection });
			await manualAccounting.processTask({ taskId: task.id });
		} else if (connection.platform_id !== 2 && connection.connection_status !== CONNECTION_STATUS.CREATED) {
			// platform-id "2" is of quickbooks
			const taskObject = await Task.fromId(task.id);
			await taskObject.process();
		}
	} catch (err) {
		logger.error(`ACCOUNTING TASK DETAILS: ${JSON.stringify(task)}`);
		logger.error({ error: err }, "ACCOUNTING TASK ERROR");
	}
}
