import type { IntegrationPlatformId, TaskCode } from "#constants";
import type { SourceName } from "#lib/facts/sources";
import type { FactName } from "#lib/facts/types";
import type { UUID } from "crypto";

export type DependentTaskRequirements = {
	platformId: IntegrationPlatformId | null;
	timeoutInSeconds?: number;
	lastRunAtInSeconds?: number;
	mostRecentRun?: Date;
	mostRecentCreation?: Date;
	taskId?: UUID;
};
/**
 * @description A map of fact names to their requirements
 * @property {number | null} maximumSources - The maximum number of sources for the fact: Job will be skipped with status of SUCCESS if the number of sources is greater than this value
 * @property {number | null} minimumSources - The minimum number of sources for the fact: Job will be delayed until the number of sources for a fact is greater than or equal to this value (set to 1 to just ensure the fact has a value)
 * @property {number} resolvedSources - The number of sources that have been resolved for the fact: maintained by the task manager
 * @property {any} currentValue - The current value of the fact
 * @property {any} previousValue - The previous value of the fact
 */
type DependentFactRequirements = {
	maximumSources?: number | null;
	minimumSources?: number | null;
	resolvedSources?: number;
	ignoreSources?: Array<SourceName>;
	currentValue?: any;
	previousValue?: any;
};
export type DependentTask = Record<TaskCode, Array<DependentTaskRequirements>>;
export type DependentFact = Record<FactName, DependentFactRequirements>;

export type DeferrableTask = {
	dependentFacts?: Partial<DependentFact>;
	dependentTasks?: Partial<DependentTask>;
	timeout: number; // number of seconds to wait before just running the task
	maxAttempts?: number; // number of times to attempt to run the task
	attempts?: number; // number of times the task has been attempted
};
