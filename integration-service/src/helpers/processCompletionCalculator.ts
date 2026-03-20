import { TaskManager } from "#api/v1/modules/tasks/taskManager";
import {
	getEnumKeyByValue,
	INTEGRATION_ID,
	type IntegrationCategoryId,
	type IntegrationPlatformId,
	type TaskCode,
	type TaskStatus
} from "#constants";
import {
	ProcessCompletionResult,
	PLATFORM_PROCESS_MAPPING,
	type ProcessCompletionPlatformMapping
} from "#constants/process-completion.constant";
import { logger } from "#helpers/logger";
import type { IBusinessIntegrationTaskEnriched } from "#types";
import type { UUID } from "crypto";
import type { TaskType } from "./integrationsCompletionTracker";

type Task = IBusinessIntegrationTaskEnriched<any>;

type CompletionDetails = {
	isComplete: boolean;
	completed: number;
	total: number;
	failed: number;
	taskTypes: TaskType[];
};

type PlatformProcessItem = {
	category: IntegrationCategoryId;
	platform: IntegrationPlatformId | null;
	taskCode: string;
};

/**
 * Handles calculation and tracking of process completion across different integration categories
 */
export class ProcessCompletionCalculator {
	private static readonly TERMINAL_STATUSES: ReadonlySet<TaskStatus> = new Set(["SUCCESS", "FAILED", "ERRORED"]);

	/**
	 * Checks if a task has reached a terminal status
	 */
	private static isTaskTerminal(task: Task): boolean {
		return ProcessCompletionCalculator.TERMINAL_STATUSES.has(task.task_status);
	}

	/**
	 * Checks if a task has failed
	 */
	private static isTaskFailed(task: Task): boolean {
		return task.task_status === "FAILED";
	}

	/**
	 * Flattens PLATFORM_PROCESS_MAPPING into a list of platform/taskCode/category items
	 */
	private static flattenPlatformProcessMapping(): PlatformProcessItem[] {
		return Object.entries(PLATFORM_PROCESS_MAPPING).flatMap(([category, taskCodes]) =>
			Object.entries(taskCodes).flatMap(([taskCode, platforms]) => {
				if (!Array.isArray(platforms)) {
					return [];
				}

				return platforms.map(platform => ({
					category: parseInt(category) as IntegrationCategoryId,
					platform: platform === "one" ? null : (parseInt(platform) as IntegrationPlatformId),
					taskCode
				}));
			})
		);
	}

	/**
	 * Finds the category for a given task based on platform and task code
	 */
	private static findTaskCategory(task: Task, platformMapping: PlatformProcessItem[]): IntegrationCategoryId | null {
		const match = platformMapping.find(
			item => (item.platform === null || item.platform === task.platform_id) && item.taskCode === task.task_code
		);
		return match?.category ?? null;
	}

	/**
	 * Converts tasks into a structured mapping by category, task code, and platform
	 */
	static tasksToProcessCompletionPlatformMapping(tasks: Task[]): ProcessCompletionPlatformMapping {
		const platformMapping = this.flattenPlatformProcessMapping();
		const result: ProcessCompletionPlatformMapping = {};

		for (const task of tasks) {
			const category = this.findTaskCategory(task, platformMapping);
			if (!category) continue;

			const taskCode = task.task_code as TaskCode;
			if (!taskCode) continue;

			result[category] ??= {};
			result[category][taskCode] ??= {};
			result[category][taskCode][task.platform_id] = this.isTaskTerminal(task);
		}

		return result;
	}

	/**
	 * Resolves categories to check - either all categories or specified ones
	 */
	private static resolveCategories(categories?: "all" | IntegrationCategoryId[]): IntegrationCategoryId[] {
		if (!categories || categories === "all" || categories.length === 0) {
			return Object.keys(PLATFORM_PROCESS_MAPPING).map(k => parseInt(k) as IntegrationCategoryId);
		}
		return categories;
	}

	/**
	 * Filters tasks relevant to a specific category based on requirements
	 */
	private static filterTasksForCategory(
		tasks: Task[],
		categoryRequirements: Record<string, Record<number, boolean>>
	): Task[] {
		return tasks.filter(
			task => categoryRequirements[task.task_code] && categoryRequirements[task.task_code][task.platform_id] != null
		);
	}

	/**
	 * Generates task types list from category requirements
	 */
	private static generateTaskTypes(categoryRequirements: Record<string, Record<number, boolean>>): TaskType[] {
		return Object.entries(categoryRequirements)
			.flatMap(([taskCode, platforms]) =>
				Object.keys(platforms).map(platform => {
					if (!platform) return null;

					const platformName = getEnumKeyByValue(INTEGRATION_ID, parseInt(platform));
					return `${platformName}:${taskCode as TaskCode}`.toLowerCase() as TaskType;
				})
			)
			.filter((t): t is TaskType => t !== null);
	}

	/**
	 * Checks if category has custom completion logic
	 */
	private static hasCustomCompletionLogic(category: IntegrationCategoryId, tasks: Task[]): boolean | undefined {
		const categoryConfig = PLATFORM_PROCESS_MAPPING[category];
		if (categoryConfig && "isComplete" in categoryConfig && categoryConfig.isComplete) {
			return categoryConfig.isComplete(tasks);
		}
		return undefined;
	}

	/**
	 * Calculates completion details for a single category
	 */
	private static calculateCategoryCompletion(
		category: IntegrationCategoryId,
		tasks: Task[],
		categoryRequirements: Record<string, Record<number, boolean>>
	): CompletionDetails {
		const tasksForCategory = this.filterTasksForCategory(tasks, categoryRequirements);
		const completed = tasksForCategory.filter(this.isTaskTerminal).length;
		const failed = tasksForCategory.filter(this.isTaskFailed).length;
		const total = tasksForCategory.length;

		const customIsComplete = this.hasCustomCompletionLogic(category, tasks);
		const isComplete = customIsComplete ?? completed === total;

		const taskTypes = this.generateTaskTypes(categoryRequirements);

		return {
			isComplete,
			completed,
			failed,
			total,
			taskTypes
		};
	}

	/**
	 * Checks completion status across specified categories
	 */
	static checkCompletion(
		tasks: Task[],
		categories?: "all" | IntegrationCategoryId[]
	): Partial<Record<IntegrationCategoryId, CompletionDetails>> {
		const resolvedCategories = this.resolveCategories(categories);
		const requirements = this.tasksToProcessCompletionPlatformMapping(tasks);
		const result: Partial<Record<IntegrationCategoryId, CompletionDetails>> = {};

		for (const category of resolvedCategories) {
			const categoryRequirements = requirements[category];
			if (!categoryRequirements) continue;

			result[category] = this.calculateCategoryCompletion(
				category,
				tasks,
				categoryRequirements as Record<string, Record<number, boolean>>
			);
		}

		return result;
	}

	/**
	 * Aggregates completion data across all categories
	 */
	private static aggregateCompletionData(completion: Partial<Record<IntegrationCategoryId, CompletionDetails>>) {
		const completionValues = Object.values(completion);

		return {
			isComplete: completionValues.every(c => c.isComplete),
			total: completionValues.reduce((acc, c) => acc + c.total, 0),
			completed: completionValues.reduce((acc, c) => acc + c.completed, 0),
			failed: completionValues.reduce((acc, c) => acc + c.failed, 0),
			taskTypes: completionValues.flatMap(c => c.taskTypes)
		};
	}

	/**
	 * Creates a default/empty completion result
	 */
	private static createEmptyResult(): ProcessCompletionResult {
		return {
			isComplete: false,
			percentage: 0,
			timestamp: new Date().toISOString(),
			details: {
				completed: 0,
				total: 0,
				failed: 0,
				taskTypes: []
			},
			completion: {}
		};
	}

	/**
	 * Calculates completion for a specific process type or all categories
	 */
	static async calculateCompletion(
		businessID: string,
		categoryID: "all" | IntegrationCategoryId
	): Promise<ProcessCompletionResult> {
		try {
			const tasks = await TaskManager.findEnrichedTasks([
				{ column: "business_id", operator: "=", value: businessID as UUID }
			]);

			const completion = this.checkCompletion(tasks, categoryID === "all" ? undefined : [categoryID]);
			const aggregated = this.aggregateCompletionData(completion);

			return {
				isComplete: aggregated.isComplete,
				percentage: aggregated.total > 0 ? (aggregated.completed / aggregated.total) * 100 : 0,
				timestamp: new Date().toISOString(),
				details: {
					completed: aggregated.completed,
					total: aggregated.total,
					failed: aggregated.failed,
					taskTypes: aggregated.taskTypes
				},
				completion: completion as any
			};
		} catch (error) {
			logger.error({
				message: "Failed to calculate process completion",
				businessID,
				categoryID,
				error
			});

			return this.createEmptyResult();
		}
	}
}
