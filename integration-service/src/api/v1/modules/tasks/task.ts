import { ERROR_CODES } from "#constants";
import { getConnectionById, platformFactory } from "#helpers/platformHelper";
import { IBusinessIntegrationTaskEnriched } from "#types/db";
import { UUID } from "crypto";
import { StatusCodes } from "http-status-codes";
import { TaskError, TaskManager } from "./taskManager";

/**
 * Provide ability to process a Task by supplying an Id to Task.fromId()
 */

export class Task {
	private task: IBusinessIntegrationTaskEnriched;
	private platform: TaskManager | null = null;

	// Cannot directly instantiate Task -- use Task.fromId(uuid)
	private constructor(task: IBusinessIntegrationTaskEnriched) {
		this.task = task;
	}

	static async fromId(taskId: UUID): Promise<Task> {
		const enrichedTask = await TaskManager.getEnrichedTask(taskId);
		if (enrichedTask) {
			return Task.fromTask(enrichedTask);
		}
		throw new TaskError(`taskId=${taskId} does not exist`, {}, StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
	}

	static async fromTask(enrichedTask: IBusinessIntegrationTaskEnriched): Promise<Task> {
		const task = new Task(enrichedTask);
		await task.initialize();
		return task;
	}

	public async process() {
		if (this.platform && this.platform.processTask) {
			return await this.platform.processTask.bind(this.platform)({ task: this.task });
		}
		throw new TaskError(`taskId=${this.task.id} does not have a platform or does not have a processTask method`, {}, StatusCodes.INTERNAL_SERVER_ERROR, ERROR_CODES.NOT_ALLOWED);
	}

	/* handle the async stuff the contructor needs */
	private async initialize() {
		if (!this.task.connection_id || !this.task.task_code) {
			throw new TaskError("Provided task does not have necessary attributes", {}, StatusCodes.PRECONDITION_FAILED, ERROR_CODES.INVALID);
		}
		const dbConnection = await getConnectionById(this.task.connection_id);
		const platform = platformFactory({ dbConnection });
		this.platform = platform;
		return;
	}
}
