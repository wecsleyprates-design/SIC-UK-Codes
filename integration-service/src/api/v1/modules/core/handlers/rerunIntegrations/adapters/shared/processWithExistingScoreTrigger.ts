import type { TaskManager } from "#api/v1/modules/tasks/taskManager";
import { INTEGRATION_ID, SCORE_TRIGGER, type IntegrationPlatform, type TaskCode } from "#constants";
import { getOrCreateConnection, platformFactory } from "#helpers";
import { BusinessScoreTriggerRepository } from "#core/scoreTrigger/businessScoreTriggerRepository";
import type { BusinessScoreTrigger } from "#types";
import type { UUID } from "crypto";

export async function processWithExistingBusinessScoreTrigger<T extends TaskManager = TaskManager>(
	businessId: UUID,
	platformCode: IntegrationPlatform,
	taskCode: TaskCode
) {
	const dbConnection = await getOrCreateConnection(businessId, INTEGRATION_ID[platformCode]);
	const platform = platformFactory<T>({ dbConnection });

	const businessScoreTriggerRepository = new BusinessScoreTriggerRepository();
	const businessScoreTrigger: BusinessScoreTrigger | undefined = await businessScoreTriggerRepository
		.getBusinessScoreTriggerByBusinessId(businessId, SCORE_TRIGGER.ONBOARDING_INVITE)
		.catch(() => undefined);
	const taskId = await platform.createTaskForCode({
		taskCode,
		scoreTriggerId: businessScoreTrigger?.id
	});

	await platform.processTask({ taskId });
	return [taskId];
}
