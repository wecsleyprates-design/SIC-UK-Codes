import { logger } from "#helpers/logger";
import type {
	ChangedField,
	FieldCondition,
	FieldSubscription,
	StateUpdateContext,
	StateUpdatePayload,
	OnUpdateResult,
	StateUpdateHandler
} from "./types";
import { middeskBusinessStateUpdateHandler } from "./handlers/middeskBusinessEntityVerification";
// import { baselayerBusinessStateUpdateHandler } from "./handlers/baselayerBusinessEntityVerification";
import { websiteScanBusinessStateUpdateHandler } from "./handlers/worthWebsiteScanning";
import { entityMatchStateUpdateHandler } from "./handlers/entityMatchRequest";
import { serpRerunStateUpdateHandler } from "./handlers/serpRerun";
import { verdataFetchPublicRecordsStateUpdateHandler } from "./handlers/verdataFetchPublicRecords";
import { IntegrationsCompletionTracker, type TaskType } from "#helpers/integrationsCompletionTracker";
import { SCORE_TRIGGER, type IntegrationPlatform } from "#constants";
import type { UUID } from "crypto";
import { BusinessScoreTriggerRepository } from "#core/scoreTrigger";

// Add handlers here to register them for onUpdate events!
const REGISTERED_HANDLERS: StateUpdateHandler[] = [
	middeskBusinessStateUpdateHandler,
	// baselayerBusinessStateUpdateHandler, TODO: Temporarily disable Baselayer until is implemented and tested
	websiteScanBusinessStateUpdateHandler,
	entityMatchStateUpdateHandler,
	serpRerunStateUpdateHandler,
	verdataFetchPublicRecordsStateUpdateHandler
];

const fieldMatchesSubscription = (changedField: ChangedField, subscription: FieldSubscription) => {
	return changedField.toLowerCase() === subscription.toLowerCase();
};

const conditionSatisfied = (changedFields: ChangedField[], condition: FieldCondition): boolean => {
	if (Array.isArray(condition)) {
		// AND group: all subscriptions in the group must match
		return condition.every(sub => changedFields.some(cf => fieldMatchesSubscription(cf, sub)));
	}
	// Single subscription: OR over all changed fields
	return changedFields.some(cf => fieldMatchesSubscription(cf, condition));
};

const getApplicableHandlers = (
	changedFields: ChangedField[],
	trigger: StateUpdateHandler["trigger"]
): StateUpdateHandler[] =>
	REGISTERED_HANDLERS.filter(
		handler =>
			handler.trigger === trigger && handler.fields.some(condition => conditionSatisfied(changedFields, condition))
	);

export const processOnUpdateHandlers = async (
	payload: StateUpdatePayload,
	trigger: StateUpdateHandler["trigger"]
): Promise<OnUpdateResult> => {
	const changedFields = Object.keys(payload.changes);

	if (!changedFields.length) {
		logger.debug(
			{ businessId: payload.businessId, source: payload.source },
			"[stateUpdateHandler] No applicable changes detected; skipping handlers."
		);
		return { triggered: [], skipped: REGISTERED_HANDLERS.map(handler => handler.id) };
	}

	// Get the appropriate business score trigger for onboarding
	const businessScoreTriggerRepository = new BusinessScoreTriggerRepository();
	const businessScoreTrigger = await businessScoreTriggerRepository.getBusinessScoreTriggerByBusinessId(
		payload.businessId as UUID,
		SCORE_TRIGGER.ONBOARDING_INVITE
	);

	const context: StateUpdateContext = { ...payload, changedFields, businessScoreTriggerId: businessScoreTrigger.id };
	const applicableHandlers = getApplicableHandlers(changedFields, trigger);
	const skipped = REGISTERED_HANDLERS.filter(handler => !applicableHandlers.includes(handler)).map(
		handler => handler.id
	);
	const applicableTaskTypes: TaskType[] = applicableHandlers.map(
		handler => `${handler.platformCode.toLowerCase() as IntegrationPlatform}:${handler.taskCode}` as TaskType
	);

	const errors: { handlerId: string; error: unknown }[] = [];
	const triggered: string[] = [];

	// Initialize integrations completion tracker for the business
	let completionTracker: IntegrationsCompletionTracker | undefined;
	const requiredTaskTypes = await IntegrationsCompletionTracker.getRequiredTasksByTaskType(applicableTaskTypes);
	if (Object.keys(requiredTaskTypes).length > 0) {
		try {
			completionTracker = await IntegrationsCompletionTracker.initializeTracking(
				{
					business_id: context.businessId as UUID,
					customer_id: context.customerId as UUID,
					business_score_trigger_id: businessScoreTrigger.id as UUID
				},
				requiredTaskTypes
			);
		} catch (error: unknown) {
			logger.error({ error, context }, "Failed to initialize integrations completion tracker");
		}
	}

	await Promise.allSettled(
		applicableHandlers.map(async handler => {
			try {
				logger.info(
					{
						businessId: payload.businessId,
						source: payload.source,
						handlerId: handler.id,
						changedFields
					},
					`[onUpdate] Executing ${trigger} handler ${handler.id}`
				);
				await handler.run(context);
				triggered.push(handler.id);
			} catch (error) {
				logger.error(error, `[onUpdate] Handler ${handler.id} failed`);
				errors.push({ handlerId: handler.id, error });
			}
		})
	);

	return {
		triggered,
		skipped,
		completionTracker,
		errors: errors.length ? errors : undefined
	};
};

export const registeredOnUpdateHandlers = REGISTERED_HANDLERS;
