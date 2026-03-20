import { logger, redis as redisClient } from "#helpers/index";
import { CASE_STATUS, CASE_STATUS_REVERSE } from "#constants/index";
import { CaseRepository } from "./caseRepository";
import { buildApplicationEditInviteRedisKey } from "#helpers/redis";
import { UUID } from "@joinworth/types/dist/utils/utilityTypes";
import type { redis as RedisType } from "#helpers/index";

export class CaseManager {
	private caseRepository: CaseRepository;
	private redis: typeof RedisType;

	constructor(caseRepository?: CaseRepository, redis?: typeof RedisType) {
		this.caseRepository = caseRepository ?? new CaseRepository();
		this.redis = redis ?? redisClient;
	}

	/**
	 * Checks if status update should be skipped based on current status
	 * @param currentStatus - The current case status
	 * @param skipStatuses - Array of statuses to skip
	 * @returns boolean
	 */
	shouldSkipStatusUpdate(currentStatus: number, skipStatuses: number[]): boolean {
		return skipStatuses.includes(currentStatus);
	}

	/**
	 * Updates case status with business logic validation
	 * @param body - The case update data
	 * @param skipStatuses - Optional array of statuses to skip (defaults to common skip statuses)
	 * @returns Promise<{ previousStatus: string | undefined; skipped: boolean }> - The previous status string before update
	 * @throws {error}
	 */
	async updateCaseStatus(
		body: { status: any; userId: any; caseId: any },
		skipStatuses: Array<(typeof CASE_STATUS)[keyof typeof CASE_STATUS]> = [
			CASE_STATUS.AUTO_APPROVED,
			CASE_STATUS.AUTO_REJECTED,
			CASE_STATUS.UNDER_MANUAL_REVIEW,
			CASE_STATUS.RISK_ALERT,
			CASE_STATUS.PAUSED
		]
	): Promise<{ previousStatus: string | undefined; skipped: boolean }> {
		try {
			const currentStatus = await this.caseRepository.getCurrentCaseStatus(body.caseId);
			const previousStatusCode = currentStatus.rows[0]?.status;
			const previousStatus = previousStatusCode ? CASE_STATUS_REVERSE[previousStatusCode] : undefined;

			if (this.shouldSkipStatusUpdate(previousStatusCode, skipStatuses)) {
				logger.info(`Case with id: ${body.caseId} is already in ${previousStatus} status`);
				return { previousStatus, skipped: true };
			}

			await this.caseRepository.updateCaseStatusWithHistory(
				{
					caseId: body.caseId,
					status: body.status,
					userId: body.userId
				},
				{
					caseId: body.caseId,
					status: body.status,
					userId: body.userId
				}
			);

			return { previousStatus, skipped: false };
		} catch (error) {
			logger.error({ error }, `Error updating case status for case_id: ${body.caseId}`);
			throw error;
		}
	}

	/**
	 * Updates case attribute by case id and attribute type
	 * @param body - The case attribute update data
	 * @returns Promise<void>
	 * @throws {error}
	 */
	async updateCaseAttribute(body: {
		case_id: any;
		attribute_type: string;
		attribute_value: any;
		user_id: any;
		comment?: string;
	}): Promise<void> {
		try {
			switch (body.attribute_type) {
				case "status":
					await this.updateCaseStatus({
						caseId: body.case_id,
						status: body.attribute_value,
						userId: body.user_id
					});
					break;
				default:
					throw new Error(`Unsupported attribute type: ${body.attribute_type}`);
			}
		} catch (error) {
			logger.error({ error }, `Error updating case attribute for case_id: ${body.case_id}`);
			throw error;
		}
	}

	/**
	 * Retrieves cached application edit invite for a case.
	 * Fetches customer_id from case if not provided.
	 * @param caseId - The case ID
	 * @param customerId - Optional customer ID (will be fetched if not provided)
	 * @returns Promise<{ link: string; inviteToken: any; customerID: UUID; applicantID: UUID } | null>
	 */
	async getCachedApplicationEditInvite(
		caseId: UUID,
		customerIdOrEmpty: UUID | null = null
	): Promise<{ link: string; inviteToken: any; customerID: UUID; applicantID: UUID } | null> {
		let customerId = customerIdOrEmpty;

		if (!customerId) {
			customerId = await this.caseRepository.getCustomerIdByCaseId(caseId);
			if (!customerId) {
				logger.warn(`No customer_id found for case_id: ${caseId}`);
				return null;
			}
		}

		const key = buildApplicationEditInviteRedisKey(customerId, caseId);
		return await this.redis.get<{ link: string; inviteToken: any; customerID: UUID; applicantID: UUID }>(key);
	}

	async deleteCachedApplicationEditInvite(caseId: UUID, customerId: UUID): Promise<boolean> {
		const redisKey = buildApplicationEditInviteRedisKey(customerId, caseId);
		return await this.redis.delete(redisKey);
	}
}

export const caseManager = new CaseManager();
