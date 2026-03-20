import { Task } from "#api/v1/modules/tasks/task";
import { INTEGRATION_ID, TASK_STATUS } from "#constants";
import { logger } from "#helpers";
import type { IBusinessIntegrationTaskEnriched, IDBConnection } from "#types";
import { updateTaskStatus } from ".";

export async function fetchGoogleReviews<T = any>(
	_connection: IDBConnection,
	task: IBusinessIntegrationTaskEnriched<T>
): Promise<void> {
	logger.debug({ task }, `fetchGoogleReviews: businessId=${task.business_id}, taskCode=${task.task_code}`);
	if (task.platform_id === INTEGRATION_ID.GOOGLE_PLACES_REVIEWS) {
		const taskObject = await Task.fromId(task.id);
		await taskObject.process();
	} else {
		await updateTaskStatus(task.id, TASK_STATUS.FAILED, `Unsupported platform: ${task.platform_id}`);
	}
}
