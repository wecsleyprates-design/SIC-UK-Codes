import { TruliooBase } from "../common/truliooBase";
import { ERROR_CODES, INTEGRATION_TASK } from "#constants";
import { getBusinessDetails } from "#helpers";
import { TaskHandlerMap, TaskManager } from "#api/v1/modules/tasks/taskManager";
import { TruliooFlows, TaskUpdateData, TruliooBusinessData } from "../common/types";
import { logger } from "#helpers/logger";
import { VerificationApiError } from "#api/v1/modules/verification/error";
import { StatusCodes } from "http-status-codes";
import { ITruliooBusinessKYBProcessor } from "./types";
import { isTruliooBusinessDataMetadata } from "./typeguards";

/**
 * Trulioo Business Task Handler
 * Handles the main task processing for business entity verification
 */
export class TruliooBusinessTaskHandler {
	private truliooBase: TruliooBase;
	private kybProcessor: ITruliooBusinessKYBProcessor;

	constructor(truliooBase: TruliooBase, kybProcessor: ITruliooBusinessKYBProcessor) {
		this.truliooBase = truliooBase;
		this.kybProcessor = kybProcessor;
	}

	/**
	 * Create task handler map for business entity verification
	 */
	createTaskHandlerMap(updateTask: (taskId: string, data: TaskUpdateData) => Promise<void>): TaskHandlerMap {
		return {
			fetch_business_entity_verification: async taskId => {
				logger.debug("fetch Trulioo Business");

				const task = await TaskManager.getEnrichedTask(taskId);

				let businessData: TruliooBusinessData;

				/** Check if task has metadata from adapter (e.g., rerunIntegrations) */
				if (isTruliooBusinessDataMetadata(task.metadata)) {
					logger.info(
						`Using metadata from task for business ${this.truliooBase["businessID"]} and task ${taskId}: ${JSON.stringify(task.metadata)}`
					);
					businessData = task.metadata;
				} else {
					/** Fallback to fetching from Case Service (original behavior) */
					logger.info(
						`No valid metadata found in task for business ${this.truliooBase["businessID"]}, fetching from Case Service`
					);
					const businessDetails = await getBusinessDetails(this.truliooBase["businessID"]);

					if (!businessDetails?.data) {
						const message = `❌ Business with id ${this.truliooBase["businessID"]} could not be found in Trulioo integration process`;
						await updateTask(taskId, { metadata: { status: message } });
						logger.info(message);
						return false;
					}

					businessData = businessDetails.data;
				}

				try {
					// Handle KYB (Know Your Business) flow
					await this.kybProcessor.processKYBFlow(taskId, businessData);

					await updateTask(taskId, {
						metadata: {
							status: "completed",
							flowType: TruliooFlows.KYB,
							businessId: this.truliooBase["businessID"]
						}
					});

					return true;
				} catch (error: unknown) {
					logger.error(error, `Error in Trulioo KYB flow:`);

					// Convert to controlled error following Middesk pattern
					const controlledError =
						error instanceof VerificationApiError
							? error
							: new VerificationApiError(
									`Trulioo KYB flow failed: ${error instanceof Error ? error.message : "Unknown error"}`,
									StatusCodes.BAD_REQUEST,
									ERROR_CODES.INVALID
								);

					await updateTask(taskId, {
						metadata: {
							status: "failed",
							error: controlledError.message
						}
					});

					// Don't throw here as this is a task handler - return false to indicate failure
					return false;
				}
			}
		};
	}
}
