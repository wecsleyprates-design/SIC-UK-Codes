import { customerIntegrationSettings } from "#api/v1/modules/customer-integration-settings/customer-integration-settings";
import { INTEGRATION_ENABLE_STATUS } from "#constants";
import { getCustomerBusinessConfigs, internalGetCaseByID, logger } from "#helpers";
import { strategyPlatformFactory } from "#helpers/strategyPlatformFactory";
import type { Equifax } from "#lib/equifax";
import type { IBusinessIntegrationTaskEnriched, IDBConnection } from "#types";

export async function fetchBureauScoreOwners<T = any>(
	connection: IDBConnection,
	task: IBusinessIntegrationTaskEnriched<T>
): Promise<void> {
	try {
		logger.info(
			`CASE SUBMIT: Equifax Bureau Score Owners for business ${connection.business_id} and connection ${connection.id} and task ${task.id}`
		);
		const equifax = await strategyPlatformFactory<Equifax>({ dbConnection: connection });
		// Check if skip credit check is enabled for a business or not
		if (!task.case_id) {
			throw new Error("Task does not have case_id");
		}
		const caseDetail = await internalGetCaseByID(task.case_id);
		const customerID = caseDetail?.customer_id;

		if (customerID) {
			const settings = await customerIntegrationSettings.findById(customerID);
			const equifaxIntegrationSettingEnabled =
				settings?.settings?.["equifax"]?.status === INTEGRATION_ENABLE_STATUS.ACTIVE;
			if (customerID && !equifaxIntegrationSettingEnabled) {
				logger.info(`Equifax Setting disabled for customer ${customerID}`);
				return;
			}
			const customerBusinessConfigs = await getCustomerBusinessConfigs(customerID, connection.business_id);
			const businessEquifaxSetting = customerBusinessConfigs?.[0]?.config.skip_credit_check;
			if (businessEquifaxSetting) {
				logger.info(
					`REFRESH SCORE: Equifax Setting disabled for customer ${customerID} and business ${connection.business_id}`
				);
				return;
			}
		} else {
			// TODO: Make this flag value dynamic based on the global config of standalone case
			// This is a temporary flag to disable fetching credit report for standalone tasks
			const fetchCreditReportForStandaloneTasks = false;
			if (!fetchCreditReportForStandaloneTasks) {
				logger.info(`CASE SUBMIT: Credit Check for standalone tasks is disabled`);
				return;
			}
		}

		if (connection && connection.configuration?.skip_credit_check) {
			logger.info(`CASE SUBMIT: Skip Credit Check enabled for business ${connection.business_id}`);
			return;
		}
		logger.info(
			`CASE SUBMIT: Fetching Equifax Bureau Score Owners for business ${connection.business_id} and connection ${connection.id} and score_trigger_id ${task.business_score_trigger_id} started`
		);
		// This is an extra check to make sure that the task has business_score_trigger_id
		if (!task.business_score_trigger_id) {
			logger.info(`CASE SUBMIT: Task ${task.id} does not have business_score_trigger_id`);
			return;
		}
		const equifaxTasks = await equifax.createFetchBureauScoreOwnersTasks(task.business_score_trigger_id);
		logger.info(
			`CASE SUBMIT: Equifax Bureau Score Owners for business ${connection.business_id} new tasks created: ${JSON.stringify(equifaxTasks)}`
		);
		for (const equifaxTask of equifaxTasks) {
			try {
				await equifax.processTask({ taskId: equifaxTask });
				logger.info(
					`CASE SUBMIT: Equifax Bureau Score Owners for business ${connection.business_id} and connection ${connection.id} and task ${equifaxTask} completed`
				);
			} catch (error) {
				logger.error(
					`CASE SUBMIT: Failed to process task ${equifaxTask} for business ${connection.business_id} and connection ${connection.id}: ${JSON.stringify(error)}`
				);
			}
		}
	} catch (error) {
		logger.error(error, "Error processing Equifax Bureau Score Owners");
	}
}
