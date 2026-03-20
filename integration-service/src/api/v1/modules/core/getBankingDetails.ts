import { INTEGRATION_ID, type IntegrationPlatformId, type TaskStatus } from "#constants";
import { sqlQuery, sqlTransaction } from "#helpers/database";
import type { UUID } from "crypto";

type TaskToStatus = { id: UUID; task_status: TaskStatus };
type BankingDetails = {
	plaidTask?: TaskToStatus | null;
	tasks: TaskToStatus[];
	institutions?: { name: string; bank_account: string }[];
};

/**
 * Get banking details for a business
 * @param businessID - The ID of the business
 * @param caseID - The ID of the case
 * @returns Banking details for the business
 */
export const getBankingDetails = async ({
	businessID,
	caseID
}: {
	businessID: UUID;
	caseID: UUID;
}): Promise<BankingDetails> => {
	let queries: string[] = [];
	let values: any[] = [];
	let plaidTask: { rows: TaskToStatus[]; rowCount: number | null } | null = null;

	// Find plaid task - case-specific when caseID provided, otherwise business-level
	if (caseID) {
		// Find task through business_score_triggers → data_cases linkage (same as banking API)
		const getCaseTaskQuery = `
			SELECT task.id, task.task_status, task.updated_at
			FROM integrations.data_business_integrations_tasks task
			JOIN integrations.data_connections con ON con.id = task.connection_id
			JOIN integrations.business_score_triggers bst ON bst.id = task.business_score_trigger_id
			JOIN public.data_cases dc ON dc.score_trigger_id = bst.id
			WHERE con.business_id = $1
			AND dc.id = $2
			AND con.platform_id = $3
			ORDER BY task.updated_at DESC
			LIMIT 1`;
		plaidTask = await sqlQuery<TaskToStatus, [UUID, UUID, IntegrationPlatformId]>({
			sql: getCaseTaskQuery,
			values: [businessID, caseID, INTEGRATION_ID.PLAID]
		});
	} else {
		// No caseID - find any plaid task for business
		const getPlaidTaskQuery = `
			SELECT task.id, task.task_status, task.updated_at
			FROM integrations.data_business_integrations_tasks task
			JOIN integrations.data_connections ON data_connections.id = task.connection_id
			WHERE data_connections.business_id = $1
			AND data_connections.platform_id = $2
			ORDER BY task.updated_at DESC
			LIMIT 1`;
		plaidTask = await sqlQuery<TaskToStatus, [UUID, IntegrationPlatformId]>({
			sql: getPlaidTaskQuery,
			values: [businessID, INTEGRATION_ID.PLAID]
		});
	}

	// Get institution names using the task we found
	// When a specific plaid task is available, retrieve only institutions linked to that task via rel_task_bank_account.
	// As a fallback, retrieve all bank accounts for the business (left joins allow null task/connection).
	let getInstitutionNameQuery;
	if (plaidTask?.rowCount && plaidTask?.rowCount > 0 && plaidTask?.rows?.[0]?.id) {
		// Specific task found: get institutions only for this task via rel_task_bank_account relationship
		getInstitutionNameQuery = `SELECT DISTINCT 
    ba.institution_name AS name,
    ba.bank_account
FROM integration_data.rel_task_bank_account AS rtba
JOIN integration_data.bank_accounts AS ba ON ba.id = ANY(rtba.bank_account_id) 
WHERE rtba.business_integration_task_id = $1`;
		queries.push(getInstitutionNameQuery);
		values.push([plaidTask.rows[0].id]);
	} else {
		// No task found - fallback to all bank accounts for business
		// This path is less common and occurs when no plaid task exists for the business.
		getInstitutionNameQuery = `SELECT DISTINCT 
    integration_data.bank_accounts.institution_name AS name,
    integration_data.bank_accounts.bank_account
FROM integration_data.bank_accounts
LEFT JOIN integrations.data_business_integrations_tasks 
    ON integrations.data_business_integrations_tasks.id = integration_data.bank_accounts.business_integration_task_id
LEFT JOIN integrations.data_connections 
    ON integrations.data_connections.id = integrations.data_business_integrations_tasks.connection_id
WHERE integrations.data_connections.business_id = $1`;
		queries.push(getInstitutionNameQuery);
		values.push([businessID]);
	}

	// Get task status - same logic as above (case-specific or business-level)
	if (caseID) {
		const getBankingTaskIds = `SELECT task.id, task.task_status 
    FROM integrations.data_business_integrations_tasks task
    JOIN integrations.data_connections con on con.id = task.connection_id
    JOIN integrations.business_score_triggers bst ON bst.id = task.business_score_trigger_id
    JOIN public.data_cases dc ON dc.score_trigger_id = bst.id
    WHERE con.business_id = $1 AND dc.id = $2
    AND con.platform_id = $3
    ORDER BY task.updated_at desc`;
		queries.push(getBankingTaskIds);
		values.push([businessID, caseID, INTEGRATION_ID.PLAID]);
	} else {
		const getTaskIdStatusQuery = `SELECT task.id, task.task_status 
    FROM integrations.data_business_integrations_tasks task
    JOIN integrations.data_connections con on con.id = task.connection_id
    WHERE con.business_id = $1
    AND con.platform_id = $2
    ORDER BY task.updated_at desc`;
		queries.push(getTaskIdStatusQuery);
		values.push([businessID, INTEGRATION_ID.PLAID]);
	}

	const [institutions, tasks] = await sqlTransaction(queries, values);
	return {
		plaidTask: plaidTask?.rows?.[0],
		institutions: institutions?.rows ?? [],
		tasks: tasks?.rows ?? []
	};
};
