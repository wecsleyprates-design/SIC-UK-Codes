import type { IntegrationPlatform, TaskCode } from "#constants";
import type { IntegrationsCompletionTracker } from "#helpers/integrationsCompletionTracker";
import type { UUID } from "crypto";

export type FieldSubscription = string;

/**
 * A single subscription or an AND-group of subscriptions.
 * Handler is triggered if ANY condition in `fields` is satisfied.
 * A condition is satisfied if:
 *  - FieldSubscription: that single field changed (OR)
 *  - FieldConditionGroup (array): ALL fields in the group changed (AND)
 */
export type FieldCondition = FieldSubscription | FieldConditionGroup;
export type FieldConditionGroup = FieldSubscription[];

export type Handler<T = void> = {
	platformCode: IntegrationPlatform;
	taskCode: TaskCode;
	fields: FieldCondition[];
	handler?: () => Promise<T>;
};

export interface ChangeEvent<T = unknown> {
	path: string;
	isSensitive?: boolean;
	previousValue: T;
	newValue: T;
}

export type ChangedField = FieldSubscription & {
	isSensitive?: boolean;
	previousValue?: unknown;
	currentValue?: unknown;
};

export type StateUpdatePayload = {
	businessId: string | UUID;
	customerId: string | UUID;
	source?: string;
	changes: Record<string, any>;
	previousState?: Record<string, any>;
	currentState?: Record<string, any>;
};

export type StateUpdateContext = StateUpdatePayload & {
	changedFields: ChangedField[];
	businessScoreTriggerId?: UUID;
};

export type StateUpdateHandler = Handler & {
	id: string;
	description?: string;
	trigger: "synchronous" | "asynchronous";
	run: (context: StateUpdateContext) => Promise<void>;
};

export type OnUpdateResult = {
	completionTracker?: IntegrationsCompletionTracker;
	triggered: string[];
	skipped: string[];
	errors?: { handlerId: string; error: unknown }[];
};
