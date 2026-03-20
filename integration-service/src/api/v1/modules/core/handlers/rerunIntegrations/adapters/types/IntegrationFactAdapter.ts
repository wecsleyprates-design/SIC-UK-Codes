import { FactName } from "#lib/facts/types";
import { IntegrationFactGetMetadata } from "./IntegrationFactGetMetadata";
import type { TaskManager } from "#api/v1/modules/tasks/taskManager";
import type { TaskCode, IntegrationPlatformId } from "#constants";
import type { UUID } from "crypto";

export interface IntegrationProcessFunctionParams<M = any> {
	platform: TaskManager;
	task_code: TaskCode | string;
	connection_id: string;
	platform_code: string;
	platform_id: IntegrationPlatformId;
	business_id: string;

	/**
	 * Metadata for the task. This should be provided by the caller after generating it via adapter.getMetadata.
	 */
	metadata: M;

	/**
	 * Optional score trigger ID to associate with created tasks.
	 * When provided, tasks are created with this business_score_trigger_id,
	 * enabling completion tracking for rerun integrations.
	 */
	scoreTriggerId?: UUID;
}

/**
 * Parameters for the checkRunnable function.
 * This is the same as the process function params sans metadata.
 */
export type IntegrationCheckRunnableFunctionParams = Partial<Omit<IntegrationProcessFunctionParams, "metadata">>;

/**
 * Process function that creates and runs a task for an integration.
 * @returns The task ID of the created/processed task
 * @throws Error if task creation or processing fails
 */
export type IntegrationProcessFunction<M = any> = (params: IntegrationProcessFunctionParams<M>) => Promise<string[]>;

/**
 * Function that checks if the associated integration for this adapter *can* run.
 * By default, this will just return true.
 */
export type IntegrationCheckRunnableFunction = (params: IntegrationCheckRunnableFunctionParams) => Promise<boolean>;

/**
 * Base type for integration adapters.
 * Adapters convert resolved facts into platform-specific metadata formats and handle task processing.
 */
export interface IntegrationFactAdapter<M = any> {
	/**
	 * Converts resolved facts into platform-specific metadata.
	 * @param business_id - The business ID for context
	 * @returns Platform-specific metadata object, or undefined if no metadata should be passed
	 */
	getMetadata: IntegrationFactGetMetadata<M>;
	isValidMetadata?: (metadata: M) => boolean;
	/** The fact names that this adapter depends on */
	factNames?: FactName[];
	/**
	 * Processes tasks for this integration platform.
	 * Can use the default adapter process function (getDefaultAdapterProcessFunction) or implement custom logic.
	 */
	process: IntegrationProcessFunction<M>;
	/**
	 * Determines if the associated integration for this adapter *can* run.
	 * By default, this will just return true.
	 */
	checkRunnable: IntegrationCheckRunnableFunction;
}
