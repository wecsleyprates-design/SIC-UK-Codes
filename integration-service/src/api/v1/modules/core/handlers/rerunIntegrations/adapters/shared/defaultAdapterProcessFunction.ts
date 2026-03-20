import { logger } from "#helpers/logger";
import { db } from "#helpers/knex";
import type { TaskCode } from "#constants";
import type { IntegrationProcessFunction } from "../types";
import { isEmpty } from "#utils";

/**
 * Default adapter process function that creates and processes tasks.
 * Used by standard integrations that don't need custom processing logic.
 * Expects metadata to be provided by the caller.
 * @returns The task IDs of the created/processed tasks
 * @throws Error if metadata is missing or task creation/processing fails
 */
export const defaultAdapterProcessFunction: IntegrationProcessFunction = async params => {
	const { platform, platform_code, connection_id, task_code, metadata, scoreTriggerId } = params;

	if (isEmpty(metadata)) throw new Error(`No metadata provided for ${platform_code} - ${task_code}`);

	/** Get or create task with metadata */
	const taskId = await platform.getOrCreateTaskForCode({
		taskCode: task_code as TaskCode,
		metadata,
		reference_id: undefined,
		scoreTriggerId,
		/**
		 * If there is an existing task but it has different metadata, we cannot reuse it.
		 * In that scenario, we need to create a new task with the new metadata to ensure
		 * that the task is run with the correct metadata.
		 */
		conditions: [db.raw("metadata::text = ?", [JSON.stringify(metadata)])]
	});

	if (!taskId) throw new Error(`Could not get or create task for ${platform_code} - ${task_code}`);

	logger.info(`[defaultAdapterProcessFunction] Successfully got or created task for ${platform_code} - ${task_code} - task_id: ${taskId}, connection_id: ${connection_id}`);

	/** Process the task without waiting for it to complete */
	platform.processTask({ taskId }).then(() => {
		logger.info(
			`[defaultAdapterProcessFunction] Successfully ran task ${task_code} for platform ${platform_code} - task_id: ${taskId}, connection_id: ${connection_id}`
		);	
	}).catch(error => {
		logger.error(
			{ error },
			`[defaultAdapterProcessFunction] Error processing task ${task_code} for platform ${platform_code} - task_id: ${taskId}, connection_id: ${connection_id}`
		);
	});

	return [taskId];
};
