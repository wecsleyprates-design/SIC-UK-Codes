import { prepareIntegrationDataForScore } from "#common";
import { db, logger } from "#helpers";
import { NPI } from "#lib/npi/npi";
import type { IBusinessIntegrationTaskEnriched, IDBConnection } from "#types";

export async function fetchHealthcareProviderVerification<T = any>(
	connection: IDBConnection,
	task: IBusinessIntegrationTaskEnriched<T>
): Promise<void> {
	let query = db("integrations.data_business_integrations_tasks")
		.select(
			"data_business_integrations_tasks.id",
			"data_business_integrations_tasks.reference_id",
			"data_business_integrations_tasks.metadata",
			"data_business_integrations_tasks.task_status"
		)
		.join(
			"integrations.rel_tasks_integrations",
			"data_business_integrations_tasks.integration_task_id",
			"rel_tasks_integrations.id"
		)
		.join("integrations.core_tasks", "core_tasks.id", "rel_tasks_integrations.task_category_id")
		.where("data_business_integrations_tasks.connection_id", connection.id)
		.andWhere("core_tasks.code", "fetch_healthcare_provider_verification")
		.whereIn("data_business_integrations_tasks.task_status", ["SUCCESS", "IN_PROGRESS", "FAILED"])
		.orderBy("data_business_integrations_tasks.created_at", "desc")
		.limit(1)
		.first();
	const lastTask = await query;
	logger.info(`NPI: lastTask: ${JSON.stringify(lastTask)}`);
	if (lastTask) {
		// replicate the same data for the new task
		const npi = new NPI();
		let lastNPIData = await npi.getProviderInfoByTaskId(lastTask?.id);
		if (lastNPIData && task.case_id) {
			lastNPIData.business_integration_task_id = task.id;
			lastNPIData.case_id = task.case_id;
			await npi.saveResultToDB(lastNPIData);
		}
		await db("integrations.data_business_integrations_tasks").where({ id: task.id }).update({
			reference_id: lastTask.reference_id,
			metadata: lastTask.metadata,
			task_status: lastTask.task_status
		});
		await prepareIntegrationDataForScore(task.id);
	}
}
