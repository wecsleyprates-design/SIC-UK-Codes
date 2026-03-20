import { TaskManager } from "#api/v1/modules/tasks/taskManager";
import { prepareIntegrationDataForScore } from "#common";
import { SCORE_TRIGGER, TASK_STATUS } from "#constants";
import { db } from "#helpers";
import { strategyPlatformFactory } from "#helpers/strategyPlatformFactory";
import type { PlaidIdv } from "#lib/plaid/plaidIdv";
import type { IBusinessIntegrationTaskEnriched, IDBConnection } from "#types";
import { v4 as uuidv4 } from "uuid";

export async function fetchIdentityVerification<T = any>(
	connection: IDBConnection,
	task: IBusinessIntegrationTaskEnriched<T>
): Promise<void> {
	task = await TaskManager.getEnrichedTask(task.id);
	if (task.task_status === TASK_STATUS.CREATED) {
		const PlaidIdv = await strategyPlatformFactory<PlaidIdv>({ dbConnection: connection });
		// get last score trigger id
		const lastScoreVersion = await db("integrations.business_score_triggers")
			.select("version")
			.where("id", task.business_score_trigger_id)
			.first();

		const idvTask = await db("integrations.data_business_integrations_tasks as dbt")
			.select("dbt.*")
			.join("integrations.business_score_triggers as bst", "dbt.business_score_trigger_id", "bst.id")
			.where("dbt.connection_id", connection.id)
			.whereNotIn("dbt.task_status", [TASK_STATUS.CREATED])
			.andWhere("bst.version", lastScoreVersion.version - 1)
			.andWhere("bst.trigger_type", SCORE_TRIGGER.ONBOARDING_INVITE)
			.orderBy("dbt.created_at", "desc");

		for (const taskData of idvTask) {
			const getOrCreateTask = await PlaidIdv.getOrCreateTaskForCode({
				taskCode: "fetch_identity_verification",
				scoreTriggerId: task.business_score_trigger_id
			});

			await db("integrations.data_business_integrations_tasks").where({ id: getOrCreateTask }).update({
				reference_id: taskData.reference_id,
				metadata: taskData.metadata,
				task_status: taskData.task_status
			});
			const rowsToCopy = await db("integration_data.identity_verification")
				.select(
					"business_id",
					"platform_id",
					"external_id",
					"applicant_id",
					"status",
					"meta",
					"created_at",
					"updated_at"
				)
				.where("business_integration_task_id", taskData.id);

			// Create new rows with JS-generated UUIDs
			const rowsToInsert = rowsToCopy.map(row => ({
				id: uuidv4(), // Safe, JS UUID
				business_integration_task_id: getOrCreateTask,
				...row
			}));
			if (rowsToInsert.length) {
				await db("integration_data.identity_verification").insert(rowsToInsert);
			}
			await prepareIntegrationDataForScore(getOrCreateTask);
		}
	}
}
