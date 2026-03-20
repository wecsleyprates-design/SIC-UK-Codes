import { banking } from "#api/v1/modules/banking/banking";
import { BankingTaskAction } from "#api/v1/modules/banking/types";
import { TaskManager } from "#api/v1/modules/tasks/taskManager";
import { prepareIntegrationDataForScore } from "#common";
import { INTEGRATION_ID, TASK_STATUS } from "#constants";
import { logger, platformFactory } from "#helpers";
import { ManualBanking } from "#lib/manual/manualBanking";
import type { IBusinessIntegrationTaskEnriched, IDBConnection } from "#types";
import { updateTaskStatus } from ".";

export async function fetchAssetsData<T = any>(connection: IDBConnection, task: IBusinessIntegrationTaskEnriched<T>) {
	try {
		if (connection?.platform_id === INTEGRATION_ID.PLAID) {
			await banking.fetchAssetReport(task.id, BankingTaskAction.REFRESH_ASSET_REPORT);
		} else if (connection?.platform_id === INTEGRATION_ID.MANUAL_BANKING) {
			const manualBanking = platformFactory({ dbConnection: connection });
			const bankStatements = await manualBanking?.getBankStatements();
			await ManualBanking.updateManualBankingTaskMetadata(task.id, {
				ocr_document_ids: bankStatements?.map(bs => bs.id)
			});
			await manualBanking.processTask({ taskId: task.id });
		}
	} catch (err: any) {
		logger.error({ error: err }, "Error in fetching asset report");
		await updateTaskStatus(task.id, TASK_STATUS.FAILED, `Error in fetching asset report: ${err.message}`);
	}
	await prepareIntegrationDataForScore(task.id);
}
