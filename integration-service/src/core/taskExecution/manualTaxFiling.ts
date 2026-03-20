import { TaskManager } from "#api/v1/modules/tasks/taskManager";
import { prepareIntegrationDataForScore } from "#common";
import { INTEGRATION_ID, TASK_STATUS } from "#constants";
import { logger, sqlTransaction } from "#helpers";
import type { IBusinessIntegrationTaskEnriched, IDBConnection } from "#types";

export async function manualTaxFiling<T = any>(
	connection: IDBConnection,
	task: IBusinessIntegrationTaskEnriched<T>
): Promise<void> {
	try {
		// get the last successful task for the business
		const lastTask = await TaskManager.getLatestTaskForBusiness(
			connection.business_id,
			INTEGRATION_ID.MANUAL,
			"manual_tax_filing",
			true
		);
		logger.info(`manual_tax_filing: lastTask: ${JSON.stringify(lastTask)}`);
		if (lastTask.task_status === TASK_STATUS.SUCCESS) {
			// replicate the same data for the new task
			const replicateTaskFilingQuery = `INSERT INTO integration_data.tax_filings (business_integration_task_id, business_type, period, form, form_type, filing_status, adjusted_gross_income, total_income, total_sales, total_compensation, total_wages, irs_balance, lien_balance, naics, naics_title, interest, interest_date, penalty, penalty_date, filed_date, balance, tax_period_ending_date, amount_filed, cost_of_goods_sold, version) 
                SELECT $1, business_type, period, form, form_type, filing_status, adjusted_gross_income, total_income, total_sales, total_compensation, total_wages, irs_balance, lien_balance, naics, naics_title, interest, interest_date, penalty, penalty_date, filed_date, balance, tax_period_ending_date, amount_filed, cost_of_goods_sold, 1 FROM integration_data.tax_filings WHERE business_integration_task_id = $2`;
			const updateTaskQuery = `UPDATE integrations.data_business_integrations_tasks SET task_status = $1, metadata = $2 WHERE id = $3`;

			await sqlTransaction(
				[replicateTaskFilingQuery, updateTaskQuery],
				[
					[task.id, lastTask.id],
					[TASK_STATUS.SUCCESS, lastTask.metadata, task.id]
				]
			);
			await prepareIntegrationDataForScore(task.id);
		}
	} catch (error) {
		logger.error({ error }, "manual_tax_filing failed");
	}
}
