import {
	CONNECTION_STATUS,
	ERROR_CODES,
	ErrorCode,
	IntegrationPlatformId,
	SCORE_TRIGGER,
	TASK_STATUS,
	TaskCode,
	TaskStatus,
	kafkaEvents,
	kafkaTopics,
	type ScoreTrigger
} from "#constants";
import { columnToActualMap } from "#constants/displayed-columns-map.constant";
import {
	WhereCondition,
	applyConditionToQuery,
	applyConditionsToQuery,
	applyWhereClausesFromFilter,
	db,
	getTotalRecordCount
} from "#helpers/knex";
import { logger } from "#helpers/logger";
import { StatusCodes } from "http-status-codes";
import { Knex } from "knex";
import AbstractConnection from "../core/abstractConnection";
import { producer } from "#helpers/kafka";

import type {
	IBusinessIntegrationTask,
	IBusinessIntegrationTaskEnriched,
	IDBConnection,
	IRequestResponse,
	IBusinessIntegrationTaskEgg
} from "#types/db";
import type { UUID } from "crypto";

export type TaskCodeHandler = () => Promise<boolean>;
export type TaskCodeHandlerWithTaskId = (
	taskId: UUID,
	enrichedTask?: IBusinessIntegrationTaskEnriched
) => Promise<boolean>;

type GetOrCreateTaskForCode<T = any> = {
	taskCode: TaskCode;
	reference_id?: string;
	metadata?: T;
	conditions?: (WhereCondition<IBusinessIntegrationTaskEnriched<T>> | Knex.Raw<IBusinessIntegrationTaskEnriched<T>>)[];
	scoreTriggerId?: UUID | null;
};

export type GetTaskScope =
	| { business_id: IDBConnection["business_id"]; connection_id?: never }
	| { business_id?: never; connection_id: IDBConnection["id"] };
export type TaskHandlerMap = Partial<Record<TaskCode, TaskCodeHandler | TaskCodeHandlerWithTaskId>>;
export class TaskError extends Error {
	status: StatusCodes;
	errorCode?: ErrorCode;
	data: any;

	constructor(message: string, data?: any, httpStatus?: StatusCodes, errorCode?: ErrorCode) {
		super(message);
		this.name = "TaskError";

		this.data = data;
		this.status = httpStatus ?? StatusCodes.BAD_REQUEST;
		this.errorCode = errorCode;
	}
}
export type GetParams = {
	query?: Partial<Parameters>;
} & ({ business_id?: never; connection_id: UUID } | { business_id: UUID; connection_id?: never });

interface IPaginatedTaskResponse {
	count?: number;
	page?: number;
	total?: number;
	tasks: IBusinessIntegrationTaskEnriched[];
}

abstract class AbstractTaskManager extends AbstractConnection {
	public static readonly PENDING_TASK_STATUSES: TaskStatus[] = [TASK_STATUS.CREATED, TASK_STATUS.ERRORED];
	public static readonly TERMINAL_TASK_STATUSES: TaskStatus[] = [TASK_STATUS.SUCCESS, TASK_STATUS.FAILED];
	public static readonly IN_PROGRESS_TASK_STATUSES: TaskStatus[] = [
		TASK_STATUS.CREATED,
		TASK_STATUS.INITIALIZED,
		TASK_STATUS.STARTED,
		TASK_STATUS.IN_PROGRESS
	];
	public abstract processTask({
		taskId,
		task
	}: {
		taskId?: UUID;
		task?: IBusinessIntegrationTaskEnriched;
	}): Promise<IBusinessIntegrationTaskEnriched>;
	protected abstract taskHandlerMap: TaskHandlerMap;

	public static getEnrichedTasks(taskId: UUID[]): Promise<IBusinessIntegrationTaskEnriched[]> {
		throw new TaskError("method must be implemented");
	}
}

export class TaskManager extends AbstractTaskManager {
	static PAGE_SIZE = 20;

	/* Needs to be impplemented in each extender */
	protected taskHandlerMap: TaskHandlerMap = {};
	protected kafkaProducer: any;

	constructor(dbConnection?: IDBConnection) {
		super(dbConnection);
		if (dbConnection) {
			this.dbConnection = dbConnection;
		}
		this.kafkaProducer = null;
		this.initKafkaProducer();
	}
	async initKafkaProducer() {
		// TODO: https://worth-ai.atlassian.net/browse/PAT-475
		// Make this a top-level import but for now its causing jest to fail for circular dependency
		this.kafkaProducer = producer;
	}
	/* Task Management Methods */
	/**
	 * 	Pass in either a taskId or Enriched Task to process it using the child class' handlerMap
	 * @param taskId?
	 * @param Task
	 * @returns enriched task or false
	 */
	public async processTask({
		taskId,
		task
	}: {
		taskId?: UUID;
		task?: IBusinessIntegrationTaskEnriched;
	}): Promise<IBusinessIntegrationTaskEnriched> {
		const staticRef = this.constructor as typeof TaskManager;
		if (taskId && !task) {
			task = await staticRef.getEnrichedTask(taskId);
		}
		if (!task) {
			throw new Error(`Could not fetch task ${taskId}`);
		}
		if (!staticRef.PENDING_TASK_STATUSES.includes(task.task_status)) {
			throw new TaskError("Task is not in a pending state", task);
		}
		const taskCode = task.task_code;
		const handler: TaskCodeHandler | TaskCodeHandlerWithTaskId | undefined =
			this.taskHandlerMap[taskCode] ?? this[taskCode];
		if (!handler || typeof handler !== "function") {
			this.updateTaskStatus(task.id, TASK_STATUS.FAILED, {
				error: `No task handler is defined for ${taskCode} for platform ${this.getPlatform()}`
			});
			logger.error(`No handler for task ${taskCode} for platform ${this.getPlatform()}`);
			throw new TaskError(`No handler for task`, task, StatusCodes.NOT_IMPLEMENTED, ERROR_CODES.INVALID);
		}
		await this.updateTaskStatus(task.id, TASK_STATUS.IN_PROGRESS);
		try {
			const success = await handler(task.id, task);
			if (success) {
				await this.updateTaskStatus(task.id, TASK_STATUS.SUCCESS);
			} else {
				logger.error(`Task=${task.id};code=${taskCode} for platform ${this.getPlatform()} errored`);
				await this.updateTaskStatus(task.id, TASK_STATUS.ERRORED);
			}
		} catch (error: any) {
			logger.error(error, `error handler on task ${task.id} platform=${task.platform_code} -  ${error["message"]}`);
			await this.updateTaskStatus(task.id, TASK_STATUS.FAILED, error);
		}
		const completedTask = await staticRef.getEnrichedTask(task.id);
		await this.sendTaskCompleteMessage(completedTask);
		return completedTask;
	}

	public static async getPaginatedTasks({
		query = {},
		business_id,
		connection_id
	}: GetParams): Promise<IPaginatedTaskResponse> {
		const validated = validate(query);
		const taskQuery = TaskManager.getTaskQuery({ query, business_id, connection_id });
		try {
			if (validated.limit && validated.limit != "all") {
				const offset = validated.limit * ((validated.page || 1) - 1);
				taskQuery.limit(validated.limit, { skipBinding: true }).offset(offset, { skipBinding: true });
			}
			const records = await taskQuery;
			const out: any = { tasks: records };
			if (validated.page == 1) {
				out.total_items = await getTotalRecordCount(taskQuery);
			}
			return out;
		} catch (ex) {
			if (ex instanceof Error) {
				logger.error(`getPaginedTasks exception: ${ex.message}`);
			}
			throw new TaskError("Could not get tasks", { exception: ex, params: query });
		}
	}

	/**
	 * Pass a query in with the expectation of finding a singular matching task
	 * @returns
	 */
	public static async findOneTask({
		query = {},
		business_id,
		connection_id
	}: GetParams): Promise<IBusinessIntegrationTaskEnriched> {
		validate(query);
		const taskQuery = this.getTaskQuery({ query, business_id, connection_id });
		try {
			taskQuery.limit(1, { skipBinding: true }).offset(0, { skipBinding: true });
			return await taskQuery.first();
		} catch (ex) {
			if (ex instanceof Error) {
				logger.error(`findOneTask exception: ${ex.message}`);
			}
			throw new TaskError("Could not get tasks", { exception: ex, params: query });
		}
	}

	public static async getEnrichedTask<T = any>(taskId: UUID): Promise<IBusinessIntegrationTaskEnriched<T>> {
		const tasks = await this.getEnrichedTasks([taskId]);
		return tasks[0];
	}
	public static async getEnrichedTasks<T = any>(taskIds: UUID[]): Promise<IBusinessIntegrationTaskEnriched<T>[]> {
		const result = await this.getEnrichedBase().whereIn("data_business_integrations_tasks.id", taskIds);
		if (result) {
			return result;
		}
		throw new TaskError("taskId not found", { taskIds }, StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
	}

	/**
	 * Find enriched tasks by the provided conditions
	 * @param conditions
	 * @returns Array of enriched tasks
	 */
	public static async findEnrichedTasks<T = any>(
		conditions: WhereCondition<IBusinessIntegrationTaskEnriched<T>>[]
	): Promise<IBusinessIntegrationTaskEnriched<T>[]> {
		let taskQuery = this.getEnrichedBase();
		for (const condition of conditions) {
			taskQuery = applyConditionToQuery<IBusinessIntegrationTaskEnriched>({
				query: taskQuery,
				columnToActualMap: columnToActualMap.IBusinessIntegrationTaskEnriched,
				condition
			});
		}
		const result: IBusinessIntegrationTaskEnriched<T>[] = await taskQuery;
		return result ?? [];
	}

	/**
	 * Retrieves the latest task for a specific business.
	 *
	 * @param businessID - The ID of the business.
	 * @param integrationPlatformID - The ID of the integration platform.
	 * @param integrationTaskCode - The code of the integration task.
	 * @param successfulTaskOnly - Optional. Specifies whether to retrieve only successful tasks. Defaults to true.
	 * @param extra_fields - Optional. Additional fields to select from the database.
	 * @param caseID - Optional. The ID of the case to filter the tasks by.
	 * @returns A promise that resolves to the latest task for the specified business.
	 */
	public static async getLatestTaskForBusiness(
		businessID: UUID,
		integrationPlatformID: IntegrationPlatformId,
		integrationTaskCode: TaskCode,
		successfulTaskOnly: boolean = true,
		extra_fields: string = "",
		caseID: string = ""
	): Promise<IBusinessIntegrationTaskEnriched> {
		const baseQuery = db<IBusinessIntegrationTaskEnriched>("integrations.data_business_integrations_tasks").select(
			"data_business_integrations_tasks.*",
			"data_connections.business_id",
			"data_connections.platform_id",
			"integration_data.request_response.request_id",
			db.raw("core_tasks.code as task_code"),
			db.raw("core_tasks.label as task_label"),
			db.raw("core_categories.code as platform_category_code"),
			db.raw("core_integrations_platforms.code as platform_code"),
			db.raw("business_score_triggers.trigger_type as trigger_type"),
			db.raw("business_score_triggers.version as trigger_version")
		);

		if (extra_fields) {
			baseQuery.select(db.raw(extra_fields)); // Add extra fields if provided
		}

		baseQuery
			.join("integrations.data_connections", "data_connections.id", "data_business_integrations_tasks.connection_id")
			.join(
				"integrations.rel_tasks_integrations",
				"rel_tasks_integrations.id",
				"data_business_integrations_tasks.integration_task_id"
			)
			.join("integrations.core_tasks", "core_tasks.id", "rel_tasks_integrations.task_category_id")
			.join(
				"integrations.core_integrations_platforms",
				"core_integrations_platforms.id",
				"rel_tasks_integrations.platform_id"
			)
			.join("integrations.core_categories", "core_categories.id", "core_integrations_platforms.category_id")
			.leftJoin(
				"integration_data.request_response",
				"integration_data.request_response.request_id",
				"data_business_integrations_tasks.id"
			)
			.leftJoin(
				"integrations.business_score_triggers",
				"business_score_triggers.id",
				"data_business_integrations_tasks.business_score_trigger_id"
			);

		if (caseID) {
			baseQuery.leftJoin("public.data_cases", "public.data_cases.score_trigger_id", "business_score_triggers.id");
		}

		baseQuery
			.where("data_connections.business_id", businessID)
			.andWhere("core_integrations_platforms.id", integrationPlatformID)
			.andWhere("core_tasks.code", integrationTaskCode);

		if (caseID) {
			baseQuery.andWhere("public.data_cases.id", caseID);
		}

		if (successfulTaskOnly) {
			baseQuery.andWhere("data_business_integrations_tasks.task_status", TASK_STATUS.SUCCESS);
		}

		baseQuery.orderBy("data_business_integrations_tasks.created_at", "desc").limit(1);

		const result = await baseQuery.first();

		return result;
	}

	/**
	 * Retrieves the task for a specific business.
	 *
	 * @param businessID - The ID of the business.
	 * @param integrationPlatformID - The ID of the integration platform.
	 * @param integrationTaskCode - The code of the integration task.
	 * @param successfulTaskOnly - Optional. Specifies whether to retrieve only successful tasks. Defaults to true.
	 * @param extra_fields - Optional. Additional fields to select from the database.
	 * @param score_trigger_id - Optional. The ID of the score to filter the tasks by.
	 * @returns A promise that resolves to the task for the specified business.
	 */
	public static async getTaskForBusiness(
		businessID: UUID,
		integrationPlatformID: IntegrationPlatformId,
		integrationTaskCode: TaskCode,
		successfulTaskOnly: boolean = true,
		extra_fields: string = "",
		score_trigger_id: string = ""
	): Promise<IBusinessIntegrationTaskEnriched> {
		const baseQuery = db<IBusinessIntegrationTaskEnriched>("integrations.data_business_integrations_tasks").select(
			"data_business_integrations_tasks.*",
			"data_connections.business_id",
			"data_connections.platform_id",
			"integration_data.request_response.request_id",
			db.raw("core_tasks.code as task_code"),
			db.raw("core_tasks.label as task_label"),
			db.raw("core_categories.code as platform_category_code"),
			db.raw("core_integrations_platforms.code as platform_code"),
			db.raw("business_score_triggers.trigger_type as trigger_type"),
			db.raw("business_score_triggers.version as trigger_version")
		);

		if (extra_fields) {
			baseQuery.select(db.raw(extra_fields)); // Add extra fields if provided
		}

		baseQuery
			.join("integrations.data_connections", "data_connections.id", "data_business_integrations_tasks.connection_id")
			.join(
				"integrations.rel_tasks_integrations",
				"rel_tasks_integrations.id",
				"data_business_integrations_tasks.integration_task_id"
			)
			.join("integrations.core_tasks", "core_tasks.id", "rel_tasks_integrations.task_category_id")
			.join(
				"integrations.core_integrations_platforms",
				"core_integrations_platforms.id",
				"rel_tasks_integrations.platform_id"
			)
			.join("integrations.core_categories", "core_categories.id", "core_integrations_platforms.category_id")
			.leftJoin(
				"integration_data.request_response",
				"integration_data.request_response.request_id",
				"data_business_integrations_tasks.id"
			)
			.leftJoin(
				"integrations.business_score_triggers",
				"business_score_triggers.id",
				"data_business_integrations_tasks.business_score_trigger_id"
			);

		baseQuery
			.where("data_connections.business_id", businessID)
			.andWhere("core_integrations_platforms.id", integrationPlatformID)
			.andWhere("core_tasks.code", integrationTaskCode);

		if (score_trigger_id) {
			baseQuery.andWhere("integrations.data_business_integrations_tasks.business_score_trigger_id", score_trigger_id);
		} else {
			baseQuery.whereNull("integrations.data_business_integrations_tasks.business_score_trigger_id");
		}

		if (successfulTaskOnly) {
			baseQuery.andWhere("data_business_integrations_tasks.task_status", TASK_STATUS.SUCCESS);
		}

		baseQuery.orderBy("data_business_integrations_tasks.created_at", "desc").limit(1);

		const result = await baseQuery.first();

		return result;
	}
	/**
	 * Retrieves the latest task for a specific business.
	 *
	 * @param businessID - The ID of the business.
	 * @param integrationPlatformID - The ID of the integration platform.
	 * @param integrationTaskCode - The code of the integration task.
	 * @param successfulTaskOnly - Optional. Specifies whether to retrieve only successful tasks. Defaults to false.
	 * @param extra_fields - Optional. Additional fields to select from the database.
	 * @param caseID - Optional. The ID of the case to filter the tasks by.
	 * @returns A promise that resolves to the latest task for the specified business.
	 */
	public async getLatestTask(
		businessID: UUID,
		integrationPlatformID: IntegrationPlatformId,
		integrationTaskCode: TaskCode,
		successfulTaskOnly: boolean = false,
		extra_fields: string = "",
		caseID: string = ""
	): Promise<IBusinessIntegrationTaskEnriched> {
		const result = await TaskManager.getLatestTaskForBusiness(
			businessID,
			integrationPlatformID,
			integrationTaskCode,
			successfulTaskOnly,
			extra_fields,
			caseID
		);
		return result;
	}

	/**
	 * Save raw respone to db
	 * @param response : Verdata.Record -- Verdata API response
	 * @param businessID
	 * @param task
	 *  @param platform_id
	 *  @param request_type
	 * @param customerID : Optional customer id
	 * @returns
	 */
	public static async saveRawResponseToDB<T = any>(
		response: any,
		businessID: UUID,
		task: IBusinessIntegrationTask,
		platform_id: IntegrationPlatformId,
		request_type: TaskCode,
		customerID?: UUID
	): Promise<IRequestResponse<T>> {
		const insertedRecord = await db<IRequestResponse>("integration_data.request_response")
			.insert({
				request_id: task.id,
				connection_id: task.connection_id,
				business_id: businessID,
				platform_id: platform_id,
				request_type: request_type,
				org_id: customerID,
				request_received: db.raw("now()"),
				status: 1,
				response
			})
			.onConflict("request_id")
			.merge()
			.returning("*");
		return insertedRecord[0];
	}

	public static async createTask(payload: IBusinessIntegrationTaskEgg): Promise<IBusinessIntegrationTask> {
		const newTask = await db<IBusinessIntegrationTask>("integrations.data_business_integrations_tasks")
			.insert(payload)
			.returning("*");
		if (newTask && newTask[0]) {
			return newTask[0];
		}
		throw new TaskError("Could not create task");
	}

	/**
	 *	Update a task's status and log it
	 *
	 * As a side effect, this will send a complete message to the task's Kafka topic if one of the class's TERMINAL_TASK_STATUSES is passed in and sendCompleteMessage is true
	 * @param id
	 * @param task_status
	 * @param log
	 */
	public async updateTaskStatus<T = any>(
		id: UUID,
		task_status: (typeof TASK_STATUS)[keyof typeof TASK_STATUS],
		log?: Error | string | Record<any, any>,
		sendCompleteMessage: boolean = false
	): Promise<IBusinessIntegrationTaskEnriched<T>> {
		if (log) {
			if (log instanceof Error) {
				log = { err: log.message, stacktrace: log.stack };
			} else if (typeof log === "string") {
				log = { err: log };
			}
		}
		await Promise.all([
			db("integrations.business_integration_tasks_events").insert({
				task_status,
				business_integration_task_id: id,
				log
			}),
			db<IBusinessIntegrationTask>("integrations.data_business_integrations_tasks")
				.update({ task_status, updated_at: db.raw("now()") })
				.where({ id })
		]);

		const staticRef = this.constructor as typeof TaskManager;
		const enrichedTask = await staticRef.getEnrichedTask(id);
		if (sendCompleteMessage && staticRef.TERMINAL_TASK_STATUSES.includes(task_status)) {
			await this.sendTaskCompleteMessage(enrichedTask);
		}
		return enrichedTask;
	}

	/**
	 *	Update a task's status and log it
	 * @param id
	 * @param task_status
	 * @param log
	 */
	public static async updateConnectionStatus(
		id: UUID,
		connection_status: (typeof CONNECTION_STATUS)[keyof typeof CONNECTION_STATUS],
		log?: any
	): Promise<void> {
		if (log) {
			if (log instanceof Error) {
				log = `{ err: ${log.message}, stacktrace: ${log.stack} };`;
			} else if (typeof log === "string") {
				log = `{ err: ${log} }`;
			}
		}
		await Promise.all([
			db("integrations.data_connections_history").insert({ connection_status, connection_id: id, log }),
			db("integrations.data_connections")
				.update({ connection_status, updated_at: db.raw("now()") })
				.where({ id })
		]);
	}

	/**
	 * Update any attribute of a task
	 * @param id -
	 * @param payload
	 * @returns Promise<IBusinessIntegrationTask>
	 */
	protected async updateTask<T = any>(
		taskId,
		payload: Partial<IBusinessIntegrationTask<T>>
	): Promise<IBusinessIntegrationTask<T>> {
		const updatedTasks = await db("integrations.data_business_integrations_tasks")
			.update({ ...payload, updated_at: db.raw("now()") })
			.where({ id: taskId })
			.returning("*");
		return updatedTasks[0];
	}
	public async getOrCreateTaskForCode<T = any>({
		taskCode,
		reference_id,
		metadata,
		conditions,
		scoreTriggerId
	}: GetOrCreateTaskForCode<T>): Promise<UUID> {
		const statusCondition: WhereCondition<IBusinessIntegrationTaskEnriched> = {
			column: "task_status",
			notIn: [TASK_STATUS.SUCCESS, TASK_STATUS.IN_PROGRESS, TASK_STATUS.STARTED]
		};
		const overallConditions = conditions ? [statusCondition, ...conditions] : [statusCondition];
		let task = await this.getTaskForCode({ taskCode, conditions: overallConditions });
		if (!task) {
			task = await this.createTaskForCode({ taskCode, metadata, reference_id, scoreTriggerId });
		}
		return task;
	}
	public async getTaskForCode({ taskCode, conditions }: Partial<GetOrCreateTaskForCode>): Promise<UUID | null> {
		const connection = this.dbConnection;
		if (connection) {
			let query = db("integrations.data_business_integrations_tasks")
				.select("data_business_integrations_tasks.id")
				.join(
					"integrations.rel_tasks_integrations",
					"data_business_integrations_tasks.integration_task_id",
					"rel_tasks_integrations.id"
				)
				.join("integrations.core_tasks", "core_tasks.id", "rel_tasks_integrations.task_category_id")
				.where("data_business_integrations_tasks.connection_id", connection.id)
				.andWhere("core_tasks.code", taskCode)
				.whereNotIn("data_business_integrations_tasks.task_status", ["SUCCESS", "IN_PROGRESS", "FAILED"])
				.orderBy("data_business_integrations_tasks.created_at", "desc")
				.limit(1)
				.first();
			if (conditions) {
				query = applyConditionsToQuery<IBusinessIntegrationTaskEnriched>({
					query,
					conditions,
					columnToActualMap: columnToActualMap.IBusinessIntegrationTaskEnriched
				});
			}

			const task = await query;
			return task?.id;
		}
		return null;
	}

	public async getTasksForCode({ taskCode, conditions }: Partial<GetOrCreateTaskForCode>): Promise<Array<UUID> | null> {
		const connection = this.dbConnection;
		if (connection) {
			let query = db("integrations.data_business_integrations_tasks")
				.select("data_business_integrations_tasks.id")
				.join(
					"integrations.rel_tasks_integrations",
					"data_business_integrations_tasks.integration_task_id",
					"rel_tasks_integrations.id"
				)
				.join("integrations.core_tasks", "core_tasks.id", "rel_tasks_integrations.task_category_id")
				.where("data_business_integrations_tasks.connection_id", connection.id)
				.andWhere("core_tasks.code", taskCode)
				.whereNotIn("data_business_integrations_tasks.task_status", ["SUCCESS", "IN_PROGRESS", "FAILED"])
				.orderBy("data_business_integrations_tasks.created_at", "desc");
			if (conditions) {
				query = applyConditionsToQuery<IBusinessIntegrationTaskEnriched>({
					query,
					conditions,
					columnToActualMap: columnToActualMap.IBusinessIntegrationTaskEnriched
				});
			}

			const taskIDs = await query;
			return taskIDs.map(row => row.id);
		}
		return null;
	}

	public async createTaskForCode({
		taskCode,
		metadata,
		reference_id,
		scoreTriggerId
	}: Partial<GetOrCreateTaskForCode>): Promise<UUID> {
		const connection = this.getDBConnection();
		if (connection) {
			const uuid = await db.transaction(async trx => {
				const getTaskId = await trx
					.from({ c: "integrations.data_connections" })
					.select(["r.id as task_id"])
					.join({ r: "integrations.rel_tasks_integrations" }, "r.platform_id", "c.platform_id")
					.join({ t: "integrations.core_tasks" }, "t.id", "r.task_category_id")
					.where("c.id", connection.id)
					.andWhere("t.code", taskCode)
					.first();

				if (getTaskId) {
					const insertedRow = await trx<IBusinessIntegrationTask>("integrations.data_business_integrations_tasks")
						.insert({
							connection_id: connection.id,
							task_status: TASK_STATUS.CREATED,
							integration_task_id: getTaskId.task_id,
							business_score_trigger_id: scoreTriggerId,
							reference_id: reference_id,
							metadata: metadata
						})
						.returning("*");
					return insertedRow[0].id as UUID;
				}
				throw new TaskError("Could not create task for code " + taskCode);
			});
			return uuid;
		}
		throw new TaskError("Could not create task for code " + taskCode);
	}

	public async getPendingTasks(): Promise<IBusinessIntegrationTaskEnriched[]> {
		if (!this.dbConnection || !this.dbConnection.id) {
			throw new TaskError("Connection not initialized");
		}
		const tasks = await TaskManager.getTaskQuery({
			query: { task_status: "pending", limit: "all" },
			business_id: this.dbConnection.business_id,
			connection_id: this.dbConnection.id
		});

		logger.debug(`Fetched ${tasks.length} pending tasks`);
		return tasks;
	}

	/**
	 * Get the request response for a task from a static class method
	 * @param taskId
	 * @returns IRequestResponse | null
	 */
	public static async getRequestResponseByTaskId(taskId: UUID): Promise<IRequestResponse | null> {
		return TaskManager.getRequestResponseByTaskIdImplementation(taskId);
	}
	/**
	 * Get the request response for a task from an instance method
	 * @param taskId
	 * @returns IRequestResponse | null
	 */
	public async getRequestResponseByTaskId<T = any>(taskId: UUID): Promise<IRequestResponse<T> | null> {
		return TaskManager.getRequestResponseByTaskIdImplementation(taskId);
	}

	/**
	 * Save an input related to a task to the request_response table
	 * @param task
	 * @param input
	 * @param externalId
	 * @param mergeOptions
	 * @returns IRequestResponse<T>
	 */
	public async saveTaskRequestResponse<T extends Record<string, unknown> = Record<string, unknown>>(
		task: IBusinessIntegrationTaskEnriched<T>,
		input: T = {} as T, // Default to empty object if no input is provided
		externalId: string | null = null,
		mergeOptions: any = null
	): Promise<IRequestResponse<T> | null> {
		if (!task?.id) {
			return null;
		}
		const insertedRecord = await db<IRequestResponse<T>>("integration_data.request_response")
			.insert({
				request_id: task.id,
				business_id: task.business_id,
				platform_id: task.platform_id,
				external_id: externalId,
				request_type: task.task_code,
				request_code: task.task_code,
				connection_id: task.connection_id,
				org_id: task.customer_id,
				response: input,
				status: task.task_status === TASK_STATUS.SUCCESS ? 1 : null,
				request_received: db.raw("now()")
			})
			.onConflict("request_id")
			.merge(mergeOptions)
			.returning("*");
		return insertedRecord?.[0] ?? null;
	}
	public async processPendingTasks() {
		const connection = this.getDBConnection();
		const stats = {
			platformId: 0,
			totalPending: 0,
			totalProcessed: 0,
			totalFailed: 0,
			totalErrored: 0,
			taskIds: [] as UUID[],
			taskIdsProcessed: [] as UUID[],
			taskIdsErrored: [] as UUID[],
			taskIdsFailed: [] as UUID[]
		};
		if (connection) {
			stats.platformId = connection.platform_id;
			await this.getPendingTasks().then(async tasks => {
				const taskPromises = tasks.map(async task => {
					stats.taskIds.push(task.id);

					await this.processTask({ task })
						.then(processResult => {
							if (processResult.task_status === TASK_STATUS.SUCCESS) {
								stats.taskIdsProcessed.push(task.id);
							} else if (processResult.task_status === TASK_STATUS.FAILED) {
								stats.taskIdsFailed.push(task.id);
							} else if (processResult.task_status === TASK_STATUS.ERRORED) {
								stats.taskIdsErrored.push(task.id);
							}
						})
						.catch(ex => {
							logger.error(ex, `Error processing task ${task.id} & ${task.platform_code}: ${ex.toString()}`);
							stats.taskIdsFailed.push(task.id);
						});
				});
				await Promise.all(taskPromises);
			});
		}
		stats.totalPending = stats.taskIds.length;
		stats.totalProcessed = stats.taskIdsProcessed.length;
		stats.totalFailed = stats.taskIdsFailed.length;
		stats.totalErrored = stats.taskIdsErrored.length;
		return stats;
	}

	public async ensureTasksExist(forceCreation = false): Promise<UUID[]> {
		const connection = this.getDBConnection();
		if (connection) {
			const requiredTasks = await db("integrations.rel_tasks_integrations")
				.select("rel_tasks_integrations.id", "core_tasks.code")
				.join("integrations.core_tasks", "core_tasks.id", "rel_tasks_integrations.task_category_id")
				.where("rel_tasks_integrations.platform_id", connection.platform_id);
			if (forceCreation) {
				return await Promise.all(
					requiredTasks.map(row => this.createTaskForCode({ taskCode: row.code, metadata: { forceCreation: true } }))
				).then(result => result);
			}
			return await Promise.all(
				requiredTasks.map(row => this.getOrCreateTaskForCode({ taskCode: row.code, metadata: {} }))
			).then(result => result);
		}
		throw new TaskError("Could not ensure tasks exist");
	}

	public async getCaseByTaskId(taskId: UUID): Promise<UUID | null> {
		const caseData = await db("integrations.data_business_integrations_tasks")
			.join(
				"public.data_cases",
				"public.data_cases.score_trigger_id",
				"data_business_integrations_tasks.business_score_trigger_id"
			)
			.select("public.data_cases.id")
			.where("integrations.data_business_integrations_tasks.id", taskId)
			.first();
		if (caseData) {
			return caseData.id;
		}
		return null;
	}

	protected async sendTaskCompleteMessage<T = any>(
		task: IBusinessIntegrationTaskEnriched<T> | UUID
	): Promise<IBusinessIntegrationTaskEnriched<T>> {
		const { prepareIntegrationDataForScore } = await import("#common/common-new");

		if (typeof task === "string") {
			const staticRef = this.constructor as typeof TaskManager;
			task = await staticRef.getEnrichedTask(task);
			if (!task) {
				throw new TaskError("Task not found", { taskId: task }, StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
			}
		}
		logger.debug(task, `🔔 taskId=${task.id} Sending task complete message`);

	// Send the existing INTEGRATION_DATA_READY event
	await this.kafkaProducer.send({
		topic: kafkaTopics.BUSINESS,
		messages: [
			{
				key: task.business_id,
				value: {
					event: kafkaEvents.INTEGRATION_DATA_READY,
					...task
				},
				headers: { event: kafkaEvents.INTEGRATION_DATA_READY }
			}
		]
	});

		// Track all integrations completion in Redis
		await this.trackIntegrationCompletion(task);

		await prepareIntegrationDataForScore(task.id, task?.trigger_type);
		return task;
	}

	/**
	 * Track all integrations completion and emit ALL_INTEGRATIONS_COMPLETE if needed
	 */
	/** Trigger types that have completion tracking enabled */
	private static readonly TRACKABLE_TRIGGER_TYPES: ScoreTrigger[] = [
		SCORE_TRIGGER.ONBOARDING_INVITE,
		SCORE_TRIGGER.MANUAL_REFRESH
	];

	private async trackIntegrationCompletion<T = any>(task: IBusinessIntegrationTaskEnriched<T>): Promise<void> {
		const { IntegrationsCompletionTracker } = await import("#helpers/integrationsCompletionTracker");
		try {
			// Determine if this is a terminal status
			const isTerminal = AbstractTaskManager.TERMINAL_TASK_STATUSES.includes(task.task_status as any);
			if (!isTerminal || !task.trigger_type || !TaskManager.TRACKABLE_TRIGGER_TYPES.includes(task.trigger_type)) {
				return;
			}

			// Get tracking for this business
			const integrationsCompletionTracker = await IntegrationsCompletionTracker.forBusiness(task.business_id);
			// Mark this integration as complete
			await integrationsCompletionTracker.handleTaskComplete(task);
		} catch (error: unknown) {
			if (error instanceof Error && error.name === "IntegrationsCompletionTrackerError") {
				logger.info({
					error,
					business_id: task.business_id,
					trigger_type: task.trigger_type,
					message:
						"Could not find integrations completion tracker for business -- assuming it has already completed/timed out"
				});
				return;
			}
			// Gracefully handle infrastructure errors (e.g. Redis unavailable in
			// sandboxed worker processes). Completion tracking is non-critical and
			// must not prevent task status updates from succeeding.
			logger.error({
				error,
				task: { id: task.id, business_id: task.business_id, task_code: (task as any).task_code },
				message: "Failed to track integration completion -- skipping (non-fatal)"
			});
		}
	}

	/**
	 * Provides a single point to get the enriched base query for tasks
	 * @returns -- a query ready to add where conditions and other things to
	 */
	private static getEnrichedBase(): Knex.QueryBuilder<IBusinessIntegrationTaskEnriched> {
		return db<IBusinessIntegrationTaskEnriched>("integrations.data_business_integrations_tasks")
			.select(
				"data_business_integrations_tasks.*",
				"data_connections.business_id",
				"data_connections.platform_id",
				db.raw("core_tasks.code as task_code"),
				db.raw("core_tasks.label as task_label"),
				db.raw("core_categories.code as platform_category_code"),
				db.raw("core_integrations_platforms.code as platform_code"),
				db.raw("business_score_triggers.trigger_type as trigger_type"),
				db.raw("business_score_triggers.version as trigger_version"),
				db.raw("business_score_triggers.customer_id as customer_id"),
				db.raw("data_cases.id as case_id")
			)
			.join("integrations.data_connections", "data_connections.id", "data_business_integrations_tasks.connection_id")
			.join(
				"integrations.rel_tasks_integrations",
				"rel_tasks_integrations.id",
				"data_business_integrations_tasks.integration_task_id"
			)
			.join("integrations.core_tasks", "core_tasks.id", "rel_tasks_integrations.task_category_id")
			.join(
				"integrations.core_integrations_platforms",
				"core_integrations_platforms.id",
				"rel_tasks_integrations.platform_id"
			)
			.join("integrations.core_categories", "core_categories.id", "core_integrations_platforms.category_id")
			.leftJoin(
				"integrations.business_score_triggers",
				"business_score_triggers.id",
				"data_business_integrations_tasks.business_score_trigger_id"
			)
			.leftJoin(
				"public.data_cases",
				"data_cases.score_trigger_id",
				"data_business_integrations_tasks.business_score_trigger_id"
			);
	}

	private static getTaskQuery({
		query,
		business_id,
		connection_id
	}): Knex.QueryBuilder<IBusinessIntegrationTaskEnriched> {
		const validated = validate(query);
		if (!business_id && !connection_id) {
			throw new TaskError("business_id or connection_id must be provided", { business_id, connection_id });
		}
		let taskQuery = TaskManager.getEnrichedBase();
		if (business_id) {
			taskQuery.where("data_connections.business_id", business_id);
		}
		if (connection_id) {
			//default behavior
			taskQuery.where("data_business_integrations_tasks.connection_id", connection_id);
		}

		const validColumns: Array<keyof IBusinessIntegrationTaskEnriched> = [
			"platform_id",
			"platform_code",
			"platform_category_code",
			"task_status",
			"id",
			"business_score_trigger_id",
			"reference_id",
			"task_code",
			"trigger_type",
			"case_id"
		];

		for (const param in query) {
			//If we're querying by connecton_id then these are redundant
			if (["page", "limit"].includes(param)) {
				continue;
			} else if (
				connection_id &&
				["platform_id", "platform_code", "platform_category_code", "platform_category_id"].includes(param)
			) {
				continue;
			} else if (param == "filter") {
				taskQuery = applyWhereClausesFromFilter<IBusinessIntegrationTaskEnriched>({
					queryBuilder: taskQuery,
					filter: validated.params.filter,
					validColumns: validColumns,
					columnToActualMap: columnToActualMap.IBusinessIntegrationTaskEnriched
				});
			} else {
				let condition: WhereCondition<IBusinessIntegrationTaskEnriched> = {
					column: param as keyof IBusinessIntegrationTaskEnriched,
					operator: "=",
					value: query[param]
				};
				//If this is "task_status" --- change "pending" to the list of pending statuses
				if (param === "task_status" && query[param] === "pending") {
					condition = { column: "task_status", in: TaskManager.PENDING_TASK_STATUSES };
				}
				taskQuery = applyConditionToQuery<IBusinessIntegrationTaskEnriched>({
					query: taskQuery,
					validColumns,
					columnToActualMap: columnToActualMap.IBusinessIntegrationTaskEnriched,
					condition
				});
			}
		}
		try {
			taskQuery.orderBy(
				(validated.params.orderBy as keyof IBusinessIntegrationTaskEnriched) || "updated_at",
				validated.params.orderDirection || "desc"
			);
			return taskQuery;
		} catch (ex) {
			throw new TaskError("Could not generate task query", { exception: ex, params: query });
		}
	}

	/**
	 * Get tasks that match specific tuples of values
	 * @param tuples - Array of tuples where each tuple contains [platform_id, task_code]
	 * @param taskStatuses? - Optional TaskStatuses
	 * @returns Promise resolving to matching enriched tasks
	 */
	public async getMostRecentTasksByPlatformIdAndTaskCodeTuples(
		tuples: Array<[IntegrationPlatformId | null, TaskCode]>,
		taskStatuses?: TaskStatus[]
	): Promise<
		Pick<
			IBusinessIntegrationTaskEnriched,
			"integration_task_id" | "platform_id" | "task_code" | "updated_at" | "task_status" | "id" | "created_at"
		>[]
	> {
		if (!this.dbConnection?.business_id) {
			throw new TaskError("Business ID not found", {}, StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
		}
		let query = TaskManager.getEnrichedBase()
			.clearSelect()
			.select(
				"integration_task_id",
				"data_connections.platform_id",
				"core_tasks.code as task_code",
				// These aggregations are just used to make sure we're getting one row when grouped by integration_task_id, platform_id, and task_code
				db.raw("max(data_business_integrations_tasks.id::text) as id"),
				db.raw("max(data_business_integrations_tasks.updated_at) as updated_at"),
				db.raw("max(data_business_integrations_tasks.created_at) as created_at"),
				db.raw("max(data_business_integrations_tasks.task_status) as task_status")
			)
			.andWhere("data_connections.business_id", this.dbConnection.business_id)
			.groupBy([
				"data_business_integrations_tasks.integration_task_id",
				"data_connections.platform_id",
				"core_tasks.code"
			])
			.orderBy("updated_at", "desc");
		if (taskStatuses) {
			query.whereIn("data_business_integrations_tasks.task_status", taskStatuses);
		}
		const specificPlatforms = query.clone().whereIn(["core_integrations_platforms.id", "core_tasks.code"], tuples);

		// Handle if we have any tasks that are not specific to a particular platform
		const anyPlatformTaskCodes = tuples
			.filter(([platformId, _]) => platformId == null)
			.map(([_, taskCode]) => taskCode);
		if (anyPlatformTaskCodes.length > 0) {
			let anyPlatforms = query.clone().whereIn(
				"core_tasks.code",
				tuples.filter(([platformId, _]) => platformId == null).map(([_, taskCode]) => taskCode)
			);
			return await specificPlatforms.union(anyPlatforms);
		}
		return await specificPlatforms;
	}

	protected async getTaskByReferenceId<T = any>(referenceValue): Promise<IBusinessIntegrationTask<T> | null> {
		const connection = this.dbConnection;
		if (connection) {
			return await db("integrations.data_business_integrations_tasks")
				.select("integrations.data_business_integrations_tasks.*")
				.where("data_business_integrations_tasks.connection_id", connection.id)
				.andWhere("reference_id", referenceValue)
				.orderBy("data_business_integrations_tasks.created_at", "desc")
				.first();
		}
		return null;
	}
	/**
	 * This is private & static as it should be maintained and used by the TaskManager class only
	 * See the static and instance method of getRequestResponseByTaskId for usage
	 * @param taskId
	 * @returns
	 */
	private static async getRequestResponseByTaskIdImplementation(taskId: UUID): Promise<IRequestResponse | null> {
		const requestResponse = await db<IRequestResponse>("integration_data.request_response")
			.where("request_id", taskId)
			?.first();
		return requestResponse ?? null;
	}

	public static async getTaskById(taskId: UUID): Promise<IBusinessIntegrationTask | undefined> {
		return db<IBusinessIntegrationTask>("integrations.data_business_integrations_tasks").where("id", taskId).first();
	}
}

type Parameters = {
	page: number;
	limit: number | "all";
	orderBy: "created_at" | "id" | string | number;
	orderDirection: "asc" | "desc";
	id: UUID;
} & {
	[key: string]: any;
};

const validate = (params: Partial<Parameters>): Partial<Parameters> => {
	const out = {
		limit: params.limit || TaskManager.PAGE_SIZE,
		page: params.page || 1,
		params
	};

	if (typeof out.page !== "number" || Math.floor(out.page) != out.page || out.page < 1) {
		throw new TaskError(`Invalid page ${out.page}`);
	}

	if (
		(typeof out.limit == "string" && out.limit !== "all") ||
		(typeof out.limit == "number" && Math.floor(out.limit) != out.limit) ||
		(out.limit as number) < 1
	) {
		throw new TaskError(`Invalid limit ${out.limit}`);
	}

	if (params) {
		//default direction if set to an invalid one
		if (params.orderDirection && !["asc", "desc"].includes(params.orderDirection)) {
			delete out.params.orderDirection;
		}
		if (params.throwError) {
			logger.error("Throwing an intentional error!");
			throw new TaskError("This threw an intentional error", {}, StatusCodes.BAD_GATEWAY, ERROR_CODES.UNAUTHENTICATED);
		}
	}
	return out;
};
