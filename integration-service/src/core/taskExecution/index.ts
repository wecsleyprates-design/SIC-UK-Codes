import { Task } from "#api/v1/modules/tasks/task";
import { prepareIntegrationDataForScore } from "#common";
import {
	CONNECTION_STATUS,
	INTEGRATION_EXECUTION_OVERRIDE,
	TASK_STATUS,
	type IntegrationPlatformId,
	type TaskCode
} from "#constants";
import { getConnectionById, logger, sqlTransaction } from "#helpers";
import type { IBusinessIntegrationTaskEnriched, IDBConnection } from "#types";
import { randomUUID } from "crypto";
import { fetchAccounting } from "./fetchAccounting";
import { fetchAdverseMedia } from "./fetchAdverseMedia";
import { fetchAssetsData } from "./fetchAssetsData";
import { fetchBureauScoreOwners } from "./fetchBureauScoreOwners";
import { fetchBusinessEntityVerification } from "./fetchBusinessEntityVerification";
import { fetchBusinessEntityWebsiteDetails } from "./fetchBusinessEntityWebsiteDetails";
import { fetchGiactVerification } from "./fetchGiactVerification";
import { fetchHealthcareProviderVerification } from "./fetchHealthcareProviderVerification";
import { fetchIdentityVerification } from "./fetchIdentityVerification";
import { fetchPublicRecords } from "./fetchPublicRecords";
import { fetchTaxFilingsTask } from "./fetchTaxFilings";
import { manualTaxFiling } from "./manualTaxFiling";
import { fetchGoogleReviews } from "./fetchGoogleReviews";

export const TASK_CODE_TO_EXECUTION_FUNCTION: Record<
	TaskCode,
	(connection: IDBConnection, task: IBusinessIntegrationTaskEnriched<any>) => Promise<void>
> = {
	fetch_public_records: fetchPublicRecords,
	fetch_assets_data: fetchAssetsData,
	fetch_balance_sheet: fetchAccounting,
	fetch_profit_and_loss_statement: fetchAccounting,
	fetch_cash_flow: fetchAccounting,
	fetch_accounting_records: fetchAccounting,
	fetch_accounting_business_info: fetchAccounting,
	fetch_accounting_accounts: fetchAccounting,
	fetch_business_entity_verification: fetchBusinessEntityVerification,
	fetch_business_entity_website_details: fetchBusinessEntityWebsiteDetails,
	fetch_bureau_score_owners: fetchBureauScoreOwners,
	manual_tax_filing: manualTaxFiling,
	fetch_google_reviews: fetchGoogleReviews,
	fetch_giact_verification: fetchGiactVerification,
	perform_business_enrichment: genericExecutionFunction,
	fetch_healthcare_provider_verification: fetchHealthcareProviderVerification,
	fetch_identity_verification: fetchIdentityVerification,
	fetch_worth_business_entity_website_details: fetchBusinessEntityWebsiteDetails,
	fetch_middesk_business_entity_website_details: fetchBusinessEntityWebsiteDetails,
	fetch_tax_filings: fetchTaxFilingsTask,
	fetch_adverse_media: fetchAdverseMedia,
	// not yet implemented for execution
	manual: noOperation,
	fetch_commerce_payments: noOperation,
	fetch_commerce_records: noOperation,
	electronic_signature: noOperation,
	fetch_google_profile: noOperation,
	fetch_watchlist_hits: noOperation
};

async function genericExecutionFunction<T = any>(
	_connection: IDBConnection,
	task: IBusinessIntegrationTaskEnriched<T>
): Promise<void> {
	logger.debug({ task }, `genericExecutionFunction: businessId=${task.business_id}, taskCode=${task.task_code}`);
	const taskObject = await Task.fromId(task.id);
	await taskObject.process();
}

async function noOperation<T = any>(
	_connection: IDBConnection,
	task: IBusinessIntegrationTaskEnriched<T>
): Promise<void> {
	logger.debug({ task }, `noOperation: businessId=${task.business_id}, taskCode=${task.task_code}`);
	await updateTaskStatus(
		task.id,
		TASK_STATUS.FAILED,
		`Task not found for task ${task.task_code} , taskID : ${task.id}`
	);
	// check score trigger status: If all tasks are SUCCESSFUl then send the trigger to manual score service for score calculation
	await prepareIntegrationDataForScore(task.id, task.trigger_type);
	return;
}

function isConnectionValid(connection: IDBConnection): boolean {
	const overrideRun =
		INTEGRATION_EXECUTION_OVERRIDE[connection.platform_id as IntegrationPlatformId]?.includes(
			connection.connection_status
		) ?? false;
	if (!overrideRun && connection.connection_status !== CONNECTION_STATUS.SUCCESS) {
		return false;
	}
	return true;
}

export async function executeIntegrationTask<T = any>(
	task: IBusinessIntegrationTaskEnriched<T>,
	connection?: IDBConnection
): Promise<void> {
	if (
		[TASK_STATUS.IN_PROGRESS, TASK_STATUS.STARTED, TASK_STATUS.SUCCESS].includes(
			task.task_status as "STARTED" | "IN_PROGRESS" | "SUCCESS"
		)
	) {
		return;
	}

	if (!connection) {
		connection = await getConnectionById(task.connection_id);
		if (!connection) {
			await updateTaskStatus(task.id, TASK_STATUS.FAILED, "No connection found for task");
			throw new Error(`No connection found for task ${task.id}`);
		}
	}
	// Check to see if we should run an associated task even if the connection is not successful
	if (!isConnectionValid(connection)) {
		logger.warn(
			{ connection },
			`Skipping task ${task.id} (${task.task_code}/${task.platform_code}) - connection ${connection.id} status is ${connection.connection_status} (requires SUCCESS or override). Business: ${connection.business_id}, Case: ${task.case_id || "N/A"}`
		);
		return;
	}

	try {
		if (!TASK_CODE_TO_EXECUTION_FUNCTION[task.task_code]) {
			logger.error(`No execution function found for task ${task.id} (${task.task_code}/${task.platform_code})`);
			return;
		}
		await TASK_CODE_TO_EXECUTION_FUNCTION[task.task_code](connection, task);
	} catch (error: unknown) {
		logger.error(
			{ error },
			`Error executing task ${task.id} (${task.task_code}/${task.platform_code}) businessId=${task.business_id}, caseId=${task.case_id} taskCode=${task.task_code} businessScoreTriggerId=${task.business_score_trigger_id}`
		);
	}
}

export async function updateTaskStatus(taskID, status, log) {
	const now = new Date().toISOString();
	const updateTaskQuery = `UPDATE integrations.data_business_integrations_tasks SET task_status = $1, updated_at = $2 WHERE id = $3`;
	const insertEventQuery = `INSERT INTO integrations.business_integration_tasks_events (id, business_integration_task_id, task_status, log) VALUES ($1, $2, $3, $4::json)`;
	await sqlTransaction(
		[updateTaskQuery, insertEventQuery],
		[
			[status, now, taskID],
			[randomUUID(), taskID, status, JSON.stringify({ log })]
		]
	);
}
