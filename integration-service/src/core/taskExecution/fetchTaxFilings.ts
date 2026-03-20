import { TaskManager } from "#api/v1/modules/tasks/taskManager";
import { fetchTaxFilings, prepareIntegrationDataForScore } from "#common";
import { TASK_STATUS, TAX_STATUS_ENDPOINTS } from "#constants";
import { getBusinessDetailsForTaxConsent, logger, sqlQuery, taxApi } from "#helpers";
import type { IBusinessIntegrationTaskEnriched, IDBConnection } from "#types";
import { buildInsertQuery } from "#utils";
import { updateTaskStatus } from ".";

export async function fetchTaxFilingsTask<T = any>(
	connection: IDBConnection,
	task: IBusinessIntegrationTaskEnriched<T>
) {
	const { data } = await getBusinessDetailsForTaxConsent(connection.business_id);

	if (!data || !data?.tin) {
		await updateTaskStatus(task.id, TASK_STATUS.FAILED, "TIN not found for business");
		logger.error(`TIN not found for businessID: ${connection.business_id}`);
		return;
	}

	let endpoint, taxApiPayload;

	// if the owner is Sole Proprietor, then we have to use the individual endpoint of TaxStatus otherwise business endpoint
	if (data.title === "Sole Proprietor") {
		endpoint = TAX_STATUS_ENDPOINTS.INDIVIDUAL;
		taxApiPayload = {
			ssn: data.tin
		};
	} else {
		endpoint = TAX_STATUS_ENDPOINTS.BUSINESS;
		taxApiPayload = {
			ein: data.tin
		};
	}

	const taxFilings = await taxApi.send(taxApiPayload, endpoint);

	const { rows } = await fetchTaxFilings(taxFilings, connection.business_id, data, task.id);

	const table = "integration_data.tax_filings";
	const columns = [
		"business_integration_task_id",
		"business_type",
		"period",
		"form",
		"form_type",
		"filing_status",
		"adjusted_gross_income",
		"total_income",
		"total_sales",
		"total_compensation",
		"total_wages",
		"irs_balance",
		"lien_balance",
		"naics",
		"naics_title",
		"interest",
		"interest_date",
		"penalty",
		"penalty_date",
		"filed_date",
		"balance",
		"tax_period_ending_date",
		"amount_filed",
		"cost_of_goods_sold",
		"version"
	];

	/**
	 * if we have data to store in the database then we are storing the data in the database
	 * and also updating the connection status and integration task status
	 */
	if (rows.length) {
		const insertTaxFilingQuery = buildInsertQuery(table, columns, rows);
		await sqlQuery({ sql: insertTaxFilingQuery, values: rows.flat() });
	}

	await updateTaskStatus(task.id, TASK_STATUS.SUCCESS, "Task executed successfully");
	await prepareIntegrationDataForScore(task.id);
}
