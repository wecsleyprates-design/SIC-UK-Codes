/* Basic implementation of building to Warehouse Service stored in Redshift */

import { uploadRawIntegrationDataToS3 } from "#common/common";
import { DIRECTORIES, EVENTS, INTEGRATION_ID, type EventEnum } from "#constants";
import { logger } from "#helpers/index";
import { BusinessEntityVerificationService as BusinessEntityVerification } from "#api/v1/modules/verification/businessEntityVerification";
import { VerificationApiError } from "#api/v1/modules/verification/error";

import type { TaskHandlerMap } from "#api/v1/modules/tasks/taskManager";
import type { IBusinessIntegrationTaskEnriched, IDBConnection } from "#types/db";
import type { CanadaOpenEntityMatchTask } from "./types";

export class CanadaOpen extends BusinessEntityVerification {
	protected static readonly PLATFORM_ID = INTEGRATION_ID.CANADA_OPEN;
	protected staticRef: typeof CanadaOpen;
	constructor(dbConnection: IDBConnection) {
		super(dbConnection);
		this.staticRef = CanadaOpen;
	}
	taskHandlerMap: TaskHandlerMap = {
		fetch_business_entity_verification: async taskId => {
			logger.debug("fetch CanadaOpen");
			const task = await this.staticRef.getEnrichedTask<CanadaOpenEntityMatchTask>(taskId);

			if (!task.metadata) {
				logger.error({ task_id: task.id, business_id: this.dbConnection?.business_id }, "Task not setup as an EntityMatching");
				throw new VerificationApiError("Not an entity matching task");
			}

			return await this.processEntityMatching(task as IBusinessIntegrationTaskEnriched<CanadaOpenEntityMatchTask>);
		}
	};

	public async processEntityMatching(task: IBusinessIntegrationTaskEnriched<CanadaOpenEntityMatchTask>): Promise<boolean> {
		logger.debug({ business_id: this.dbConnection?.business_id, task_id: task.id }, "Processing CanadaOpen entity matching");
		if (!task.metadata || !task.metadata.match_id) {
			logger.error({ task_id: task.id, business_id: this.dbConnection?.business_id }, "Task not setup as an EntityMatching Task");
			throw new VerificationApiError("Not an entity matching task");
		}
		if (!task.metadata.match) {
			logger.debug({ business_id: this.dbConnection?.business_id, task_id: task.id }, "No match found for businessId");
			throw new VerificationApiError("No Match Found");
		}
		if (this.isBelowMinimumPredictionScore(task)) {
			logger.warn({ prediction: task.metadata.prediction, min_threshold: this.staticRef.MINIMUM_PREDICTION_SCORE }, "Prediction score below minimum threshold");
			throw new VerificationApiError("Below minimum threshold");
		}
		const {
			match: { corporate_id: externalId }
		} = task.metadata;
		const newMetadata: CanadaOpenEntityMatchTask = { ...task.metadata, business: task.metadata.match, match_mode: "ai" };
		await Promise.all([
			this.updateTask(task.id, { reference_id: externalId.toString(), metadata: newMetadata }),
			this.saveRequestResponse<CanadaOpenEntityMatchTask>(task, newMetadata, externalId.toString())
		]);
		try {
			await uploadRawIntegrationDataToS3(newMetadata, task.business_id, "match", DIRECTORIES.BUSINESS_ENTITY_VERIFICATION, "CANADAOPEN");
		} catch (ex) {
			logger.error({ task_id: task.id, error: ex }, "Failed to upload entry to S3");
		}
		return true;
	}
}
