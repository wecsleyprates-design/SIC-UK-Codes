import { EVENTS, INTEGRATION_ID, QUEUES } from "#constants";

import { logger } from "#helpers/logger";
import { platformFactory } from "#helpers/platformHelper";
import { randomUUID, type UUID } from "crypto";
import { Match } from "./match";
import BullQueue from "#helpers/bull-queue";
import type { IBusinessIntegrationTaskEnriched } from "#types/db";
import { VerificationApiError } from "#api/v1/modules/verification/error";
import { db } from "#helpers";
import { MatchBusinessResponse } from "./types";

export class MatchUtil {
	/* Shortcut to ensure Match-pro task is created and runs for the given customer and business */
	static async runMatchBusiness(
		customerID: UUID,
		businessID: UUID,
		icas?: string[]
	): Promise<IBusinessIntegrationTaskEnriched> {
		try {
			const connection = await Match.getOrCreateConnection(businessID);
			const platform = platformFactory({ dbConnection: connection });
			const taskId = await platform.getOrCreateTaskForCode({
				taskCode: "fetch_business_entity_verification",
				reference_id: businessID,
				metadata: { customerID, ...(icas !== undefined ? { icas } : {}) } // Send customerId and icas in Metadata
			});
			return await platform.processTask({ taskId });
		} catch (ex) {
			logger.error({ error: ex, customerID, businessID }, "Failed to match business");
			throw new VerificationApiError("Failed to match business");
		}
	}

	static enqueueMatchProRequest = async (requestId: UUID, request: Record<string, any>) => {
		const queue = new BullQueue(QUEUES.TASK);
		const jobId = `${requestId}::${randomUUID()}`;
		return queue.addJob(
			EVENTS.MATCH_PRO_BULK,
			{ requestId, request },
			{ jobId, removeOnComplete: false, removeOnFail: false }
		);
	};

	static processJobRequest = async (job: any): Promise<any> => {
		const { customer_id: customerID, business_id: businessID } = job?.request;
		try {
			const updatedTask = await MatchUtil.runMatchBusiness(customerID, businessID);
			logger.info({ businessID, taskStatus: updatedTask.task_status }, "Match-pro task completed");
		} catch (error) {
			logger.error({ error, businessID }, "Failed to run Match-pro task");
		}
	};

	static async getMatchBusinessResult(params: {
		businessID: UUID;
		ica?: string;
	}): Promise<MatchBusinessResponse> {
		try {
			const matchResultQuery = db("integration_data.request_response")
				.select("integration_data.request_response.*")
				.where("integration_data.request_response.platform_id", INTEGRATION_ID.MATCH)
				.andWhere("integration_data.request_response.business_id", params.businessID)
				.orderBy("requested_at", "desc")
				.limit(1);

			const matchResult = await matchResultQuery;

			if (matchResult.length === 0) {
				logger.info({ businessID: params.businessID }, "Match Business result: Record not found");
				return {};
			}

			const request_response = matchResult[0];
			const response = request_response.response;

			if (params.ica) {
				// Handle Multi-ICA Aggregated Response
				if (response.multi_ica && response.results) {
					const resultForIca = response.results[params.ica];
					if (!resultForIca) {
						logger.info(
							{ businessID: params.businessID, ica: params.ica },
							"Match Business result: ICA not found in aggregated result"
						);
						return {};
					}
					return resultForIca;
				}

				// Handle Legacy Single Response
				// Check if the legacy record matches the requested ICA
				const legacyIca =
					response.terminationInquiryRequest?.acquirerId ||
					request_response.request?.terminationInquiryRequest?.acquirerId;

				if (legacyIca === params.ica) {
					return response;
				} else {
					// Found a record but for different ICA
					return {};
				}
			}

			// If no ICA specific requested, return the whole response object (legacy or aggregated)
			return response;
		} catch (error) {
			logger.error({ error, businessID: params.businessID }, "Match Business result: Error while fetching");
			throw error;
		}
	}
}
