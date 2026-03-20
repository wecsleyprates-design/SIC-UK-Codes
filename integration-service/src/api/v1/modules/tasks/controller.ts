import {
	getConnectionById,
	getConnectionsForBusiness,
	getOrCreateConnection,
	platformFactory
} from "#helpers/platformHelper";
import type { IDBConnection } from "#types/db";
import type { UUID } from "crypto";
import type { Request } from "express";

import { ERROR_CODES, INTEGRATION_ID, TaskCodeEnum, type IntegrationCategoryId, type TaskCode } from "#constants";
import { logger } from "#helpers/logger";
import type { Response } from "#types/index";
import { catchAsync } from "#utils/catchAsync";
import { StatusCodes } from "http-status-codes";
import { GetParams, TaskError, TaskManager } from "./taskManager";
import { DeferrableTaskManager } from "./deferrableTaskManager";
import { ProcessCompletionCalculator } from "#helpers/processCompletionCalculator";
import { IntegrationsCompletionTracker } from "#helpers/integrationsCompletionTracker";

export const controller = {
	getTaskById: catchAsync(async (req: Request, res: Response) => {
		const { task_id } = req.params;
		const result = await TaskManager.getEnrichedTask(task_id as UUID);
		res.jsend.success(result);
	}),
	processTask: catchAsync(async (req: Request, res: Response) => {
		const { task_id } = req.params;
		const { authorization } = req.headers;
		const task = await TaskManager.getEnrichedTask(task_id as UUID);
		if (task) {
			const platform = platformFactory({
				dbConnection: (await getConnectionById(task.connection_id)) as IDBConnection,
				authorization
			});

			let result;
			if (platform instanceof DeferrableTaskManager) {
				logger.debug({ task }, "Synchronously executing deferrable task");
				result = await platform.synchronouslyExecuteDeferrableTask(task);
			} else {
				result = await platform.processTask({ taskId: task.id, task });
			}
			const updatedTask = await TaskManager.getEnrichedTask(task.id);
			res.jsend.success({ originalTask: task, updatedTask, result });
		} else {
			res.jsend.error("Task not found");
		}
	}),
	processPendingTasksForConnection: catchAsync(async (req: Request, res: Response) => {
		const { connection_id, task_status } = req.params;
		const { authorization } = req.headers;

		if (connection_id && task_status.toLowerCase() === "pending") {
			try {
				const platform = platformFactory({
					dbConnection: await getConnectionById(connection_id as UUID),
					authorization
				});
				const result = await platform.processPendingTasks();
				return res.jsend.success(result);
			} catch (ex) {
				return res.jsend.error("Unhandled platform error");
			}
		}
		throw new Error(
			"Invalid request: must supply connection_id and task_status=pending to process pending tasks for a connection."
		);
	}),
	processPendingTasksForBusiness: catchAsync(async (req: Request, res: Response) => {
		const { business_id, task_status } = req.params;
		const { authorization } = req.headers;

		const out = { connections: {} };
		if (business_id && task_status.toLowerCase() === "pending") {
			await getConnectionsForBusiness(business_id as UUID).then(async connections => {
				const tasksForConection = connections.map(async connection => {
					try {
						const platform = await platformFactory({
							dbConnection: await getConnectionById(connection.id as UUID),
							authorization
						});
						if (platform && typeof platform == "object") {
							await platform.processPendingTasks().then(stats => (out.connections[connection.id] = stats));
						}
					} catch (ex) {
						out.connections[connection.id] = { error: "Unhandled platform", platform_id: connection.platform_id };
						logger.error(
							`Skipping unhandled platform ${connection.platform_id} for business ${business_id} due to error: ${(ex as Error).message} [processPendingTasksForBusiness]`
						);
					}
				});
				await Promise.all(tasksForConection);
			});
			return res.jsend.success(out);
		}
		throw new Error(
			"Invalid request: must supply business_id and task_status=pending to process pending tasks for a business."
		);
	}),
	getTasks: catchAsync(async (req: Request, res: Response, next) => {
		const {
			business_id,
			connection_id,
			task_status
		}: { business_id?: UUID; connection_id?: UUID; task_status?: string } = req.params;
		const query: { [key: string]: any } = req.query;
		if (!business_id && !connection_id) {
			throw new TaskError(
				"Invalid request: neither business_id or connection_id supplied",
				{},
				StatusCodes.PRECONDITION_REQUIRED,
				ERROR_CODES.INVALID
			);
		}
		if (task_status && !query.task_status) {
			query.task_status = task_status;
		}
		if (!query.page) {
			query.page = 1;
		}
		const result = await TaskManager.getPaginatedTasks({ business_id, connection_id, query } as GetParams);
		return res.jsend.success(result);
	}),
	generateAndExecuteTaskForBusiness: catchAsync(async (req: Request, res: Response) => {
		const { business_id, platformCode, taskCode } = req.params;
		const { reference_id, metadata, score_trigger_id } = req.body;
		const { runNow } = req.query;
		const { authorization } = req.headers;

		if (!Object.values(TaskCodeEnum).includes(taskCode as TaskCode)) {
			throw new TaskError(`Invalid task code ${taskCode}`, {}, StatusCodes.PRECONDITION_REQUIRED, ERROR_CODES.INVALID);
		}
		const platformID = INTEGRATION_ID[platformCode];
		if (!platformID) {
			throw new TaskError(
				`Invalid platform code ${platformCode}`,
				{},
				StatusCodes.PRECONDITION_REQUIRED,
				ERROR_CODES.INVALID
			);
		}
		const dbConnection = await getOrCreateConnection(business_id as UUID, platformID);
		if (!dbConnection) {
			throw new TaskError(
				"Could not establish connection to business",
				{},
				StatusCodes.PRECONDITION_REQUIRED,
				ERROR_CODES.INVALID
			);
		}
		const platform: TaskManager = platformFactory({ dbConnection, authorization });
		const originalTaskId = await platform.getOrCreateTaskForCode({
			taskCode: taskCode as TaskCode,
			reference_id,
			metadata,
			scoreTriggerId: score_trigger_id
		});
		if (!originalTaskId) {
			throw new TaskError("Could not create task", {}, StatusCodes.PRECONDITION_REQUIRED, ERROR_CODES.INVALID);
		}
		const originalTask = await TaskManager.getEnrichedTask(originalTaskId);

		if (platform instanceof DeferrableTaskManager && runNow) {
			logger.debug({ originalTask }, "Synchronously executing deferrable task");
			await platform.synchronouslyExecuteDeferrableTask(originalTask);
		} else {
			await platform.processTask({ taskId: originalTaskId, task: originalTask });
		}
		const updatedTask = await TaskManager.getEnrichedTask(originalTaskId);
		return res.jsend.success({ dbConnection, updatedTask, originalTask });
	}),
	getBusinessCompletion: catchAsync(async (req: Request, res: Response) => {
		const { business_id } = req.params;
		const { category } = req.query;
		const completionTracker = await IntegrationsCompletionTracker.forBusiness(business_id as UUID);
		const completion = await ProcessCompletionCalculator.calculateCompletion(
			business_id as UUID,
			(category as unknown as IntegrationCategoryId) ?? "all"
		);
		const state = await completionTracker.getCompletionState();
		return res.jsend.success({ state, completion });
	})
};
