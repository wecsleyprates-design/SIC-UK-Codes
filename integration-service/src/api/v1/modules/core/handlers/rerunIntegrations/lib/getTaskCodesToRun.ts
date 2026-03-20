import { INTEGRATION_ID } from "#constants";
import { sqlQuery } from "#helpers/database";

interface GetTaskCodesToRunParams {
	connectionTaskCodes: string[];
	platformId: (typeof INTEGRATION_ID)[keyof typeof INTEGRATION_ID];
	requestedTaskCodes?: string[];
}

/**
 * Determines which task codes should be run for a connection.
 * If connection has task codes, uses those. Otherwise, if no specific task codes
 * were requested, fetches all task codes for the platform.
 */
export const getTaskCodesToRun = async ({
	connectionTaskCodes,
	platformId,
	requestedTaskCodes
}: GetTaskCodesToRunParams): Promise<string[]> => {
	let taskCodesToRun = connectionTaskCodes;
	if (taskCodesToRun.length === 0 && (!requestedTaskCodes || requestedTaskCodes.length === 0)) {
		// Get all task codes for this platform
		const taskQuery = `
			SELECT ct.code
			FROM integrations.rel_tasks_integrations rti
			INNER JOIN integrations.core_tasks ct ON ct.id = rti.task_category_id
			WHERE rti.platform_id = $1
		`;
		const taskResult = await sqlQuery({ sql: taskQuery, values: [platformId] });
		taskCodesToRun = taskResult.rows.map(row => row.code);
	}
	return Array.from(new Set(taskCodesToRun));
};
