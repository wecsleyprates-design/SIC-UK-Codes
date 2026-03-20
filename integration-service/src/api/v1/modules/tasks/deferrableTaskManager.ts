import { ERROR_CODES, TASK_STATUS } from "#constants";
import { TaskManager } from "./taskManager";
import { logger } from "#helpers/logger";
import { factWithHighestConfidence } from "#lib/facts/rules";
import {
	IBusinessIntegrationTaskEvent,
	type IBusinessIntegrationTask,
	type IBusinessIntegrationTaskEnriched,
	type IDBConnection,
	type IRequestResponse
} from "#types/db";
import { Knex } from "knex";
import { TaskEvent } from "#models/taskEvent";
import { StatusCodes } from "http-status-codes";
import { SerializableMap } from "#utils/serialization";
import path from "path";
import { existsSync } from "fs";

import type { FactEngine } from "#lib/facts/factEngine";
import type { Fact, FactName } from "#lib/facts/types";
import type { EnqueuedJob } from "#lib/aiEnrichment/types";
import type { Job, JobOptions, QueueOptions } from "bull";
import type { UUID } from "crypto";
import type { DeferrableTask, DependentFact, DependentTask, DependentTaskRequirements } from "./types";
import type BullQueue from "#helpers/bull-queue";
import type { ErrorCode, EventEnum, IntegrationPlatformId, QueueEnum, TaskCode } from "#constants";
import type { SandboxedJob } from "#helpers/bull-queue";
import { getFactKeys } from "#lib/facts/utils";

/**
 * Tasks that are meant to be deferrable should extend this class.
 * It will handle the deferrable logic and the task execution.
 *
 * The normal "process" task function will push the task into a queue
 * and then the evaluateJob function will be called by a worker to evaluate the task
 * and then execute it if the task is ready.
 *
 * See documentation
 * https://worth-ai.atlassian.net/wiki/spaces/joinworth/pages/353894421/DeferrableTaskManager
 */

type BaseTaskType = DeferrableTask;
/**
 * The evaluated state of a deferrable task
 * 1) Defer -- continue to defer this task
 * 2) Ready -- the task is ready to run
 * 3) Success -- the task is complete/skipped actual execution
 * 4) Fail -- the task failed/early exit with FAILURE state
 * 5) Unknown -- the job is not in a valid state to be evaluated
 */
export const READY_STATE = {
	DEFER: "DEFER",
	READY: "READY",
	SUCCESS: "SUCCESS",
	FAIL: "FAIL",
	UNKNOWN: "UNKNOWN"
} as const;
export type ReadyState = (typeof READY_STATE)[keyof typeof READY_STATE];

export abstract class DeferrableTaskManager extends TaskManager {
	protected dbConnection: IDBConnection;
	protected factEngine?: FactEngine;
	protected db: Knex;
	protected bullQueue: BullQueue;
	protected staticRef: typeof DeferrableTaskManager;
	protected static readonly QUEUE_NAME: QueueEnum;
	protected static readonly QUEUE_EVENT: EventEnum;
	protected static readonly QUEUE_OPTIONS: Partial<QueueOptions> = {
		prefix: "{deferrableTask}",
		settings: { maxStalledCount: 10, stalledInterval: 90000 }
	};
	// The path (relative to the deferredTaskWorker) to the sandboxed file that will process the job if you want to run the job in a sandboxed environment
	protected static readonly QUEUE_WORKER_SANDBOX_PATH: string | undefined;
	protected static readonly FAIL_JOB_PROGRESS: number = -99;
	protected static readonly SUCCESS_JOB_PROGRESS: number = 100;
	protected static readonly MAX_ATTEMPTS: number = 10;
	/**
	 * Number of seconds to wait before allowing the task to run with the data available to it. Set to 0 to disable and always run.
	 */
	protected static readonly TASK_TIMEOUT_IN_SECONDS: number = 90;
	/** Define fact dependencies in subclasses  */
	static readonly DEPENDENT_FACTS: Partial<DependentFact> = {};
	/** Define task dependencies in subclasses */
	static readonly DEPENDENT_TASKS: Partial<DependentTask> = {};

	constructor({
		dbConnection,
		db,
		bullQueue,
		factEngine
	}: {
		dbConnection: IDBConnection;
		db: Knex;
		bullQueue: BullQueue;
		factEngine?: FactEngine;
	}) {
		super(dbConnection);
		this.dbConnection = dbConnection;
		this.db = db;
		this.factEngine = factEngine;
		this.bullQueue = bullQueue;
		this.staticRef = this.constructor as typeof DeferrableTaskManager;
		if (!this.staticRef.getQueueName()) {
			throw new DeferrableTaskError("Queue name is not set");
		}
		if (!this.staticRef.getQueueEvent()) {
			throw new DeferrableTaskError("Queue event is not set");
		}
	}

	/**
	 * 	Pass in either a taskId or Enriched Task to "process" it by simply enqueuing the task
	 *
	 * This overrides the parent class' processTask method to not directly set SUCCESS/ERROR/STARTED and instead just enqueues the task without looking for a task handler
	 *
	 * This requires you to ensure there's actually a real handler for the Queue+Event combination as a Queue Worker
	 * otherwise the task will just sit in the queue indefinitely
	 * @param taskId?
	 * @param Task
	 * @returns enriched task or throws an error
	 */
	public override async processTask({
		taskId,
		task
	}: {
		taskId?: UUID;
		task?: IBusinessIntegrationTaskEnriched;
	}): Promise<IBusinessIntegrationTaskEnriched> {
		if (taskId && !task) {
			task = await this.staticRef.getEnrichedTask(taskId);
		}
		if (!task) {
			throw new DeferrableTaskError(`Could not fetch task ${taskId}`, task, StatusCodes.NOT_FOUND, ERROR_CODES.INVALID);
		}
		if (!this.getPendingTaskStatuses().includes(task.task_status)) {
			throw new DeferrableTaskError(
				"Task is not in a pending state",
				task,
				StatusCodes.BAD_REQUEST,
				ERROR_CODES.INVALID
			);
		}
		try {
			await this.enqueueTask(task.id);
		} catch (error) {
			await this.updateTaskStatus(task.id, TASK_STATUS.FAILED, error instanceof Error ? error : "Unknown error");
			logger.error(`Error enqueuing task ${task.id}: ${error}`);
			throw new DeferrableTaskError(
				`Error enqueuing task ${task.id}: ${error}`,
				task,
				StatusCodes.INTERNAL_SERVER_ERROR,
				ERROR_CODES.INVALID
			);
		}
		return this.staticRef.getEnrichedTask(task.id);
	}

	/**
	 * This is the main method that is called by a worker to evaluate the job to see if can run
	 * It will:
	 * - Get the enriched task
	 * - Evaluate if the task can run (evaluateReadyState()
	 * - Update task metadata with debug information calculated by evaluateReadyState()
	 * - Update the task status to in progress
	 * - Call executeDeferrableTask()
	 * - Update the task status to success or failed
	 * @param job
	 * @returns [ReadyState, message]
	 */
	public async evaluateJob<T = any>(
		job: Job<EnqueuedJob> | SandboxedJob<EnqueuedJob>
	): Promise<[ReadyState, string | null]> {
		const { task_id: taskID } = job.data;
		const task = await this.staticRef.getEnrichedTask(taskID);
		const [readyState, returnMessage] = await this.evaluateReadyState(job, task);
		const updatedTask = await this.updateTask(taskID, { metadata: task.metadata });
		let message: string | null = null;

		switch (readyState) {
			case READY_STATE.DEFER:
				const delay = Math.ceil(this.bullQueue.getDelay(job) / 1000);
				const logMessage = `⏳ Not OK to run task ${taskID} - attempt ${job.attemptsMade} of ${job.opts.attempts} - next attempt ${delay}s Current Progress:${job.progress()}%`;
				message = returnMessage ?? logMessage;

				await this.deferJob(job, message);
				break;
			case READY_STATE.SUCCESS:
				message = returnMessage ?? "Task skipped due to precondition being met";
				await this.completeJob(job, message);
				break;

			case READY_STATE.FAIL:
				message = message ?? "Task failed due to precondition being met";
				await this.updateTaskStatus<T>(taskID, TASK_STATUS.FAILED, { message }, true);
				logger.debug(
					`❌ taskId=${taskID} Task marked as failed due to a failure precondition being met ${returnMessage}`
				);
				await this.completeJob(job, message);
				break;

			case READY_STATE.READY:
				await this.updateTaskStatus<T>(taskID, TASK_STATUS.STARTED, {
					message: `Criteria met: starting task via ${this.constructor.name}`
				});
				try {
					if (await this.executeDeferrableTask(updatedTask, job)) {
						logger.debug(`✅ taskId=${taskID} Successfully completed task`);
						const successMsg = `✅ Completing taskID=${taskID} in ${this.constructor.name} after ${job.attemptsMade} attempt${job.attemptsMade === 1 ? "" : "s"}`;
						await this.completeJob(job, successMsg);
						return [readyState, successMsg];
					} else {
						throw new DeferrableTaskError("Execution failed");
					}
				} catch (ex) {
					const errorMsg = `❌ taskId=${taskID} evaluateJob exception: ${ex}`;
					await this.discardJob(job, errorMsg);
					logger.error(ex, errorMsg);
					throw new DeferrableTaskError(errorMsg, task, StatusCodes.INTERNAL_SERVER_ERROR, ERROR_CODES.INVALID);
				}
			default:
				const errorMsg = `❌ taskId=${taskID} evaluateJob invalid ready state: ${readyState}`;
				await this.discardJob(job, errorMsg);
				throw new DeferrableTaskError(errorMsg);
		}
		return [readyState, message];
	}

	public static getQueueName() {
		return this.QUEUE_NAME;
	}
	public static getQueueEvent() {
		return this.QUEUE_EVENT;
	}
	public static getQueueOptions() {
		return this.QUEUE_OPTIONS;
	}
	public static getQueueSandboxedPath() {
		// Remove leading / from path
		return this.QUEUE_WORKER_SANDBOX_PATH?.replace(/^\//, "");
	}

	/**
	 * Get the sandboxed file for the given root path
	 * @param rootPath The absolute path to the root of the worker loading this sandboxed file
	 * 	necessary to resolve the path where the actual worker file lives
	 * @param validExtensions The valid extensions to check for - defaults to ["ts", "js"]
	 * @returns The sandboxed file path or throws if the file does not exist with any of the "validExtensions" defined
	 */
	public static getQueueSandboxFile(rootPath: string, validExtensions: string[] = ["js", "ts"]) {
		const sandboxRelativePath = this.getQueueSandboxedPath();
		if (!sandboxRelativePath) {
			throw new DeferrableTaskError("Queue sandbox path is not set");
		}
		// Remove everything after the last "."
		const relativePathWithoutExtension = sandboxRelativePath.replace(/\.[^.]+$/, "");

		// Iterate over the valid extensions and return the first one that exists -- if not found after then throw
		for (const extension of validExtensions) {
			const testPath = path.join(rootPath, `${relativePathWithoutExtension}.${extension}`);
			if (existsSync(testPath)) {
				return testPath;
			}
		}
		throw new DeferrableTaskError(
			`Sandboxed file ${rootPath}/${sandboxRelativePath} does not exist with any of the valid extensions: ${validExtensions.join(", ")}`
		);
	}

	public getBullQueue() {
		return this.bullQueue;
	}
	public getDependentFacts() {
		return this.staticRef.DEPENDENT_FACTS;
	}
	public getDependentTasks() {
		return this.staticRef.DEPENDENT_TASKS;
	}
	public getTaskTimeout() {
		return this.staticRef.TASK_TIMEOUT_IN_SECONDS;
	}
	public getMaxAttempts() {
		return this.staticRef.MAX_ATTEMPTS;
	}
	public getTerminalTaskStatuses() {
		return this.staticRef.TERMINAL_TASK_STATUSES;
	}
	public getPendingTaskStatuses() {
		return this.staticRef.PENDING_TASK_STATUSES;
	}
	/**
	 * Get the numerical progress of a job that has failed
	 * Used in the sandboxed worker to infer the status of a job
	 * @returns number
	 */
	public getFailJobProgress() {
		return this.staticRef.FAIL_JOB_PROGRESS;
	}
	/* Get the numerical progress of a job that has finished successfully
	 * Used in the sandboxed worker to infer the status of a job
	 * @returns number
	 */
	public getSuccessJobProgress() {
		return this.staticRef.SUCCESS_JOB_PROGRESS;
	}
	public getNow(): number {
		return Date.now();
	}

	public async getJobStatus(job: Job<EnqueuedJob> | SandboxedJob<EnqueuedJob>): Promise<ReadyState> {
		let jobStatus: ReadyState = "UNKNOWN";
		let emoticon: string = "❓";
		if (this.getBullQueue().isSandboxedJob(job)) {
			const progress = job.progress();
			// infer status some other way...
			if (progress >= this.getSuccessJobProgress()) {
				jobStatus = READY_STATE.SUCCESS;
			} else if (progress === this.getFailJobProgress()) {
				jobStatus = READY_STATE.FAIL;
			} else {
				jobStatus = READY_STATE.DEFER;
			}
		} else {
			const [isCompleted, isDelayed, isFailed] = await Promise.all([
				job.isCompleted(),
				job.isDelayed(),
				job.isFailed()
			]);
			jobStatus = isCompleted
				? READY_STATE.SUCCESS
				: isDelayed
					? READY_STATE.DEFER
					: isFailed
						? READY_STATE.FAIL
						: "UNKNOWN";
		}
		emoticon =
			jobStatus === READY_STATE.SUCCESS
				? "✅"
				: jobStatus === READY_STATE.FAIL
					? "❌"
					: jobStatus === READY_STATE.DEFER
						? "⏳"
						: "❓";
		logger.debug(
			`${emoticon} ${this.staticRef.QUEUE_EVENT}: Finished Evaluating Job ${job.name} :: ${job.id} :: Status: ${jobStatus} :: ${job.failedReason ? `:: ${job.failedReason}` : ""} :: ${JSON.stringify(
				job.data
			)}`
		);
		return jobStatus;
	}

	/**
	 * Get the most recent request response for an optional given taskID, external ID, or taskCode
	 *	Each param is treated as an AND condition when provided
	 * @param externalID? - The external ID of the request response
	 * @param taskID? - The task ID of the request response
	 * @param taskCode? - The task code of the request response
	 * @returns The most recent request response for the business
	 */
	public async getFromRequestResponse<T extends object = object>({
		externalID,
		taskID,
		taskCode
	}: {
		externalID?: string;
		taskID?: UUID;
		taskCode?: TaskCode;
	}): Promise<IRequestResponse<T> | null> {
		const query = this.db<IRequestResponse<T>>("integration_data.request_response")
			.select("*")
			.where("business_id", this.dbConnection.business_id)
			.where("platform_id", this.dbConnection.platform_id)
			.orderBy("requested_at", "desc")
			.limit(1);
		if (taskID) {
			query.where("request_id", taskID);
		}
		if (externalID) {
			query.where("external_id", externalID);
		}
		if (taskCode) {
			query.where("request_code", taskCode);
		}
		const record = await query;
		return record[0];
	}

	/**
	 * Discard a job
	 * 	Sets the task status to failed
	 * 	Adds log to logger & job log
	 * 	Sets the progress of the job to the fail job progress
	 * 	Discards the job
	 * @param job
	 * @param message
	 * @returns void
	 */
	public async discardJob(job: Job<EnqueuedJob> | SandboxedJob<EnqueuedJob>, message: string): Promise<void> {
		const { task_id: taskID } = job.data;

		// Mark the job as discarded BEFORE any awaits to ensure Bull registers it for this attempt
		try {
			await job.discard();
		} catch (error) {
			logger.error(error, `Error discarding job ${job.id} for queue ${this.getBullQueue().queue.name}`);
		}
		await this.updateTaskStatus(taskID, TASK_STATUS.FAILED, message, true);
		logger.error(message);
		await job.log(message);
		await job.progress(this.getFailJobProgress());
	}

	/**
	 * Mutates existing task metadata
	 * Returns ReadyState and a possible error message if the task is not ready to run (E is the type of the error message)
	 *
	 * It's OK to run if:
	 * - The task was created before the timeout period
	 * - The task has all the dependent facts or tasks resolved
	 * @param enrichedTask
	 * @returns Promise<[ReadyState, M]> A promise that resolves to the ready state and a possible nullable message if the task is not ready to run (M is the type of the error message)
	 */
	protected async evaluateReadyState<T extends BaseTaskType, M extends any = string>(
		job: Job<EnqueuedJob> | SandboxedJob<EnqueuedJob>,
		enrichedTask: IBusinessIntegrationTaskEnriched<T>
	): Promise<[ReadyState, M | null]> {
		let returnMessage: M | null = null;
		let readyState: ReadyState = READY_STATE.DEFER;
		const dependentFacts = this.getDependentFacts();
		const dependentTasks = this.getDependentTasks();
		const factNames = getFactKeys(dependentFacts);

		if (!enrichedTask?.metadata || Object.keys(enrichedTask.metadata).length === 0) {
			const defaultMetadata = (await this.getDefaultTaskMetadata()) as T;
			enrichedTask.metadata = defaultMetadata;
		}

		// If the task has timed out, set the ready state to READY and execute the task
		if (this.hasTaskTimedOut(enrichedTask, enrichedTask.metadata?.timeout)) {
			readyState = READY_STATE.READY;
		}
		// If the task has reached the max number of attempts, set the ready state to READY and execute the task
		if (this.hasTaskReachedMaxAttempts(enrichedTask, job.attemptsMade, enrichedTask.metadata?.maxAttempts)) {
			readyState = READY_STATE.READY;
		}

		const satisfiedTasksMap = new SerializableMap<string /*platformId::taskCode*/, boolean>();
		const satisfiedFactMap = new SerializableMap<FactName, boolean>();
		let dependentTaskTuples: Array<[IntegrationPlatformId | null, TaskCode]> = [];

		/* Checks to see if deferrable Facts are set */
		if (Object.keys(dependentFacts).length > 0 && this.factEngine) {
			const factValues = await this.getFactValues();
			logger.debug(`👀 FactValues: ${JSON.stringify(factValues)}`);

			for (const factName of factNames) {
				satisfiedFactMap.set(factName, false);
				if (enrichedTask.metadata?.dependentFacts?.[factName]) {
					const dependentFact = enrichedTask.metadata.dependentFacts[factName];
					const numSources = this.factEngine.getNumberOfSourcesForFact(factName, dependentFact?.ignoreSources);
					dependentFact.resolvedSources = numSources;
					if ((factValues[factName] ?? "").toString() != dependentFact.currentValue?.toString()) {
						dependentFact.previousValue = dependentFact.currentValue;
						dependentFact.currentValue = factValues[factName];
					}
					if (dependentFact.maximumSources != null && numSources >= dependentFact.maximumSources) {
						satisfiedFactMap.set(factName, true);
						readyState = READY_STATE.SUCCESS;
						returnMessage =
							`Fact ${factName} has ${numSources} sources and the maximum number of sources is ${dependentFact.maximumSources} - Skipping execution and marking as success` as M;
						logger.debug(`👍 taskId=${enrichedTask.id} ${returnMessage}`);
					} else if (dependentFact.minimumSources != null && numSources >= dependentFact.minimumSources) {
						satisfiedFactMap.set(factName, true);
						logger.debug(
							`👍 taskId=${enrichedTask.id} ${factName} ${numSources} greater than or equal to ${dependentFact.minimumSources}`
						);
					} else {
						logger.debug(
							`😩 taskId=${enrichedTask.id} ${factName} ${numSources} less than ${dependentFact.minimumSources}`
						);
					} // Keep looping so we update all the metadata
				}
			}
		}
		/* Checks to see if deferrable Tasks are set */
		if (Object.keys(dependentTasks).length > 0) {
			logger.debug(`👀 Deferrable Tasks defined: ${JSON.stringify(dependentTasks)}`);
			// Init the satisfiedTasks map as all falses
			Object.entries(dependentTasks).forEach(
				([taskCode, dependentTaskRequirements]) =>
					dependentTaskRequirements &&
					dependentTaskRequirements?.forEach(({ platformId }) =>
						satisfiedTasksMap.set(this.getKeyFromTuple([platformId, taskCode as TaskCode]), false)
					)
			);
			dependentTaskTuples = Array.from(satisfiedTasksMap.keys()).map(key => this.getTupleFromKey(key));
			const completedTasks = await this.getMostRecentTasksByPlatformIdAndTaskCodeTuples(
				dependentTaskTuples,
				this.getTerminalTaskStatuses()
			);
			const pendingTasks = await this.getMostRecentTasksByPlatformIdAndTaskCodeTuples(
				dependentTaskTuples,
				this.getPendingTaskStatuses()
			);
			logger.debug(`👀 Completed Tasks: ${JSON.stringify(completedTasks)}`);
			logger.debug(`👀 Pending Tasks: ${JSON.stringify(pendingTasks)}`);
			// Add task info to current task metadata for tracking purposes
			const mutateTask = (
				dependentTask: DependentTaskRequirements[],
				evaluatedTask: Pick<IBusinessIntegrationTaskEnriched<any>, "id" | "platform_id" | "created_at" | "updated_at">
			) => {
				if (dependentTask && evaluatedTask) {
					const indexOfPlatform = dependentTask?.findIndex(
						t => t.platformId === evaluatedTask.platform_id || t.platformId == null
					);
					if (indexOfPlatform !== undefined && dependentTask && dependentTask[indexOfPlatform]) {
						dependentTask[indexOfPlatform].mostRecentRun = evaluatedTask.updated_at as unknown as Date;
						dependentTask[indexOfPlatform].mostRecentCreation = evaluatedTask.created_at as unknown as Date;
						dependentTask[indexOfPlatform].taskId = evaluatedTask.id;
					}
				}
			};
			for (const [taskCode, dependentTaskRequirements] of Object.entries(dependentTasks)) {
				for (const taskRequirements of dependentTaskRequirements) {
					// Metadata tracking entry may not exist yet if the task was
					// created with custom metadata (e.g. TruliooPSCScreening).
					// Still evaluate DB state so dependencies can be satisfied.
					const dependentTask = enrichedTask.metadata?.dependentTasks?.[taskCode];
					if (completedTasks && completedTasks.length > 0) {
						for (const task of completedTasks) {
							if (await this.hasTaskPreviouslyRunWithinThreshold(task, taskRequirements.lastRunAtInSeconds)) {
								satisfiedTasksMap.set(this.getKeyFromTuple([task.platform_id, task.task_code]), true);
								// Any platform satisfiying a task automatically satisfies the "null" platform as well
								satisfiedTasksMap.set(this.getKeyFromTuple([null, task.task_code]), true);
								if (dependentTask) mutateTask(dependentTask, task);
							}
						}
					}
					if (pendingTasks && pendingTasks.length > 0) {
						for (const task of pendingTasks) {
							if (this.hasTaskTimedOut(task, taskRequirements.timeoutInSeconds)) {
								satisfiedTasksMap.set(this.getKeyFromTuple([task.platform_id, task.task_code]), true);
								// Any platform satisfiying a task automatically satisfies the "null" platform as well
								satisfiedTasksMap.set(this.getKeyFromTuple([null, task.task_code]), true);
								if (dependentTask) mutateTask(dependentTask, task);
							}
						}
					}
				}
			}
		}
		if (enrichedTask.metadata?.attempts != null && typeof enrichedTask.metadata.attempts === "number") {
			enrichedTask.metadata.attempts++;
		}

		if (readyState === READY_STATE.DEFER) {
			const satisfiedTasks = Array.from(satisfiedTasksMap.values());
			const satisfiedFacts = Array.from(satisfiedFactMap.values());
			readyState =
				satisfiedTasks.every((satisfied: boolean) => satisfied) &&
				satisfiedFacts.every((satisfied: boolean) => satisfied)
					? READY_STATE.READY
					: READY_STATE.DEFER;
			logger.debug(`👀 taskId=${enrichedTask.id} :: Ready State=${readyState} `);
			if (factNames.length > 0) {
				logger.debug(
					`  📚 ${factNames.length} required facts and ${satisfiedFacts.filter(satisfied => satisfied).length} satisfied`
				);
			}
			if (satisfiedTasks.length > 0) {
				logger.debug(
					`  ⛭ ${dependentTaskTuples.length} required tasks and ${satisfiedTasks.filter(satisfied => satisfied).length} satisfied`
				);
			}
			if (readyState === READY_STATE.DEFER) {
				const invalidKeys = [...satisfiedTasksMap.entries(), ...satisfiedFactMap.entries()]
					.filter(([, value]) => value !== true)
					.map(([key]) => key);
				const validKeys = [...satisfiedTasksMap.entries(), ...satisfiedFactMap.entries()]
					.filter(([, value]) => value)
					.map(([key]) => key);
				logger.debug(`  👀 taskId=${enrichedTask.id} :: Unsatisfied Keys: ${JSON.stringify(invalidKeys)}`);
				logger.debug(`  👀 taskId=${enrichedTask.id} :: Satisfied Keys: ${JSON.stringify(validKeys)}`);
			}
		}

		logger.debug(`💕 taskId=${enrichedTask.id} readyState=${readyState} task=${JSON.stringify(enrichedTask)}`);
		return [readyState, returnMessage];
	}

	protected async getFactEngine(): Promise<FactEngine> {
		if (!this.factEngine) {
			throw new Error("FactEngine is not initialized");
		}
		await this.factEngine.applyRules(factWithHighestConfidence);
		return this.factEngine;
	}

	/**
	 * Pick specific facts out from an array of Facts
	 * @param factName: Array of the fact names to pick out
	 * @param allFacts : Arrry of all the facts to choose from
	 * @returns New array of the facts that match the factName
	 */
	protected static selectFacts(factName: FactName[], allFacts: Fact[]): Fact[] {
		// Return the facts that have factName
		return allFacts.reduce((acc, fact) => {
			if (factName.includes(fact.name)) {
				acc.push(fact);
			}
			return acc;
		}, [] as Fact[]);
	}
	protected async getFacts(factNames?: FactName[]): Promise<Record<FactName, Fact>> {
		if (!this.factEngine) {
			throw new Error("FactEngine is not initialized");
		}
		if (!factNames) {
			factNames = getFactKeys(this.getDependentFacts());
		}

		const factEngine = await this.getFactEngine();
		logger.debug(`👀 Dependent fact keys to use: ${factNames}`);
		const resolvedFacts = factEngine.getAllResolvedFacts([], false);
		const facts = Object.values(resolvedFacts).reduce(
			(acc, fact) => {
				if (fact.name && factNames.includes(fact.name) && factEngine.isValidFactValue(fact.value)) {
					acc[fact.name] = fact as Fact;
				}
				return acc;
			},
			{} as Record<FactName, Fact>
		);
		return facts;
	}
	protected async getFactValues(factNames?: FactName[]): Promise<Record<FactName, any>> {
		const facts = await this.getFacts(factNames);
		return Object.values(facts).reduce((acc, fact) => {
			acc[fact.name] = fact.value;
			return acc;
		}, {} as Record<FactName, any>);
	}

	protected async enqueueTask(taskId: UUID, jobOpts: Partial<JobOptions> = {}) {
		const jobData = {
			task_id: taskId,
			platform_id: this.dbConnection.platform_id,
			business_id: this.dbConnection.business_id
		};
		const jobOptions = {
			jobId: taskId,
			delay: 500,
			attempts: this.getMaxAttempts(),
			removeOnComplete: 100,
			removeOnFail: 1000,
			backoff: { type: "exponential", delay: 2000 },
			...jobOpts
		};
		const job = await this.bullQueue.addJob<EnqueuedJob>(this.staticRef.QUEUE_EVENT, jobData, jobOptions);
		await this.updateTaskStatus(taskId, TASK_STATUS.INITIALIZED, {
			job_id: job.id,
			job_data: jobData,
			job_options: jobOptions,
			queue: this.bullQueue.queue.name,
			event: this.staticRef.QUEUE_EVENT,
			message: `Enqueued for processing on queue ${this.bullQueue.queue.name} in ${Math.ceil(this.bullQueue.getDelay(job) / 1000)}s`
		});
	}

	/**
	 * Public interface to manually execute a deferrable task
	 * Meant for debug purposes only
	 * @param task
	 * @param job
	 * @returns
	 */
	public async synchronouslyExecuteDeferrableTask(
		task: IBusinessIntegrationTask,
		job?: Job<EnqueuedJob> | SandboxedJob<EnqueuedJob>
	): Promise<boolean> {
		// If Job isn't passed in attempt to enqueue it then pull the reference from the Queue
		if (!job) {
			await this.processTask({ taskId: task.id });
			job = (await this.bullQueue.getJobByID(task.id)) as Job<EnqueuedJob> | SandboxedJob<EnqueuedJob>;
		}
		if (!job) {
			throw new DeferrableTaskError("Job could not be found or enqueued");
		}
		const success = await this.executeDeferrableTask(task, job);
		const successMsg = `✅⏩️ Synchronously executed deferrable taskID=${task.id} in ${this.constructor.name} after ${job.attemptsMade} attempt${job.attemptsMade === 1 ? "" : "s"}`;
		await this.completeJob(job, successMsg);
		return success;
	}

	protected async executeDeferrableTask<T = any>(
		task: IBusinessIntegrationTask<T>,
		job: Job<EnqueuedJob> | SandboxedJob<EnqueuedJob>
	): Promise<boolean> {
		throw new DeferrableTaskError("executeDeferrableTask not implemented!");
	}

	/**
	 * Override or extend this as necessary for an implementation */
	protected async getDefaultTaskMetadata<T extends BaseTaskType = BaseTaskType>(): Promise<T> {
		let dependentFacts: Partial<DependentFact> = {};
		if (this.factEngine) {
			dependentFacts = Object.entries(this.getDependentFacts()).reduce((acc, [factName, dependentFactSetup]) => {
				acc[factName] = {
					minimumSources: dependentFactSetup?.minimumSources ?? null,
					maximumSources: dependentFactSetup?.maximumSources ?? null,
					resolvedSources: 0
				};
				return acc;
			}, {} as DependentFact);
		}
		return {
			dependentFacts,
			dependentTasks: this.getDependentTasks(),
			timeout: this.getTaskTimeout(),
			maxAttempts: this.getMaxAttempts(),
			attempts: 0
		} as T;
	}

	protected async saveRequestResponse<T extends object = object>(
		task: IBusinessIntegrationTaskEnriched,
		input: T,
		mergeOptions: any = null
	): Promise<IRequestResponse<T>> {
		const insertedRecord = await this.db<IRequestResponse>("integration_data.request_response")
			.insert({
				request_id: task.id,
				business_id: task.business_id,
				platform_id: task.platform_id,
				request_type: task.task_code,
				request_code: task.task_code,
				connection_id: task.connection_id,
				response: JSON.stringify(input),
				external_id: "external_id" in input ? (input.external_id as string | null | undefined) : null
			})
			.onConflict("request_id")
			.merge(mergeOptions)
			.returning("*");
		return insertedRecord[0];
	}

	/**
	 * Defer a job
	 * 	increments the progress of the job by 1
	 *  adds log to logger & job log
	 * 	updates task status to in progress
	 * @param job
	 * @param message
	 * @returns void
	 */
	protected async deferJob(job: Job<EnqueuedJob> | SandboxedJob<EnqueuedJob>, message: string): Promise<void> {
		const { task_id: taskID } = job.data;
		await this.updateTaskStatus(taskID, TASK_STATUS.IN_PROGRESS, {
			message
		});
		const currentProgress: number = job.progress() ?? 0;

		logger.debug(message);
		await job.log(message);
		await job.progress(currentProgress + 1);
	}
	/**
	 * Complete a job
	 * 	Sets the task status to success
	 * 	Adds log to logger & job log
	 * 	Sets the progress of the job to 100
	 * @param job
	 * @param message
	 * @returns void
	 */
	protected async completeJob(job: Job<EnqueuedJob> | SandboxedJob<EnqueuedJob>, message: string): Promise<void> {
		const { task_id: taskID } = job.data;

		await this.updateTaskStatus(taskID, TASK_STATUS.SUCCESS, { message }, true);
		logger.debug(message);
		await job.log(message);
		await job.progress(100);
		if (!this.getBullQueue().isSandboxedJob(job)) {
			try {
				await job.moveToCompleted();
			} catch (error) {
				logger.error(error, `Error moving job ${job.id} for queue ${this.getBullQueue().queue.name} to completed`);
			}
		}
	}

	private hasTaskTimedOut(
		enrichedTask: Pick<IBusinessIntegrationTaskEnriched, "id" | "created_at" | "updated_at">,
		timeoutInSeconds: number | undefined
	): boolean {
		const defaultTimeout = this.getTaskTimeout();
		const secondsSinceTaskCreated = this.getTimeDiffInSeconds(enrichedTask, "created_at");
		// Has timed out?
		return secondsSinceTaskCreated > (timeoutInSeconds ?? defaultTimeout);
	}

	private hasTaskReachedMaxAttempts(
		task: Pick<IBusinessIntegrationTaskEnriched, "id">,
		attempts: number,
		maxAttempts: number = this.getMaxAttempts()
	): boolean {
		if (attempts >= maxAttempts) {
			logger.info(`📚 taskId=${task.id} max attempts reached. ${attempts} attempts vs ${maxAttempts} attempts`);
			return true;
		}
		return false;
	}

	/**
	 * Determine if a task has already run "recently"
	 * Pass in the number of elapsed seconds since the task was last updated to determine
	 *
	 * Possible future TODO to consider: lookup task history to determine the most recent timestamp of a terminal state transition.
	 * Dont' think it's necessary for the moment
	 * @param enrichedTask
	 * @param lastRunAtInSeconds
	 * @returns
	 */
	private async hasTaskPreviouslyRunWithinThreshold(
		enrichedTask: Pick<IBusinessIntegrationTaskEnriched, "id" | "updated_at" | "created_at">,
		lastRunAtInSeconds: number | undefined
	): Promise<boolean> {
		if (lastRunAtInSeconds === undefined) {
			return true;
		}
		const events = await TaskEvent.getEventsForTask(enrichedTask.id, this.getTerminalTaskStatuses());
		if (events.length > 0) {
			const lastEvent = events[0].getRecord();
			const secondsSinceTaskUpdated = this.getTimeDiffInSeconds(lastEvent, "updated_at");
			if (secondsSinceTaskUpdated <= lastRunAtInSeconds) {
				logger.info(
					`⏰ taskId=${enrichedTask.id} last run within required time period. ${secondsSinceTaskUpdated} seconds vs ${lastRunAtInSeconds} seconds`
				);
				return true;
			}
		}
		return false;
	}

	private getTimeDiffInSeconds(
		task:
			| Pick<IBusinessIntegrationTaskEnriched, "id" | "created_at" | "updated_at">
			| Pick<IBusinessIntegrationTaskEvent, "business_integration_task_id" | "created_at">,
		fieldToUse: "created_at" | "updated_at" = "created_at",
		nowUtc = this.getNow()
	) {
		// Force the database timestamp to be parsed as UTC
		// If the timestamp doesn't end with 'Z', add it to ensure UTC parsing
		const timestampString = (task[fieldToUse] ?? task.created_at).toString();
		if (!timestampString) {
			const id = "id" in task ? task.id : task.business_integration_task_id;
			throw new Error(`Timestamp string is empty for task ${id} and field ${fieldToUse}`);
		}
		const utcTimestampString = timestampString.endsWith("Z") ? timestampString : timestampString + "Z";
		const createdAtUtcMs = new Date(utcTimestampString).getTime();

		// Calculate seconds since task was created
		return Math.abs(Math.floor((nowUtc - createdAtUtcMs) / 1000));
	}

	private getKeyFromTuple(tuple: [IntegrationPlatformId | null, TaskCode]): string {
		return `${tuple[0] ?? "null"}::${tuple[1]}`;
	}
	private getTupleFromKey(key: string): [IntegrationPlatformId | null, TaskCode] {
		const [platformId, taskCode] = key.split("::");
		return [platformId === "null" ? null : (platformId as unknown as IntegrationPlatformId), taskCode as TaskCode];
	}
}

export class DeferrableTaskError<T = any> extends Error {
	status: StatusCodes;
	errorCode?: ErrorCode;
	data: T | undefined;

	constructor(message: string, data?: T, httpStatus?: StatusCodes, errorCode?: ErrorCode) {
		super(message);
		this.name = "DeferrableTaskError";
		this.data = data;
		this.status = httpStatus ?? StatusCodes.BAD_REQUEST;
		this.errorCode = errorCode;
		logger.error(`⚠️ ${this.name}: ${data ? JSON.stringify(data) : ""}`);
	}
}
