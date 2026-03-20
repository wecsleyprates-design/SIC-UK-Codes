import { TruliooUBOPersonData, TruliooPersonVerificationData, TruliooPSCFormData } from "../common/types";
import { logger } from "#helpers/logger";
import { db } from "#helpers/knex";
import type { IBusinessEntityPerson, IBusinessEntityVerification } from "#types/db";
import type { UUID } from "crypto";
import { convertToUUIDFormat } from "../common/utils";

/**
 * Trulioo Person Data Storage
 * Handles storage of person records in business_entity_people table
 */
export class TruliooPersonDataStorage {
	/**
	 * Create an initial "placeholder" verification record for PSC before calling Trulioo.
	 * This ensures the webhook can find the business_id associated with the PSC hfSession.
	 * @param businessId - Business ID
	 * @param hfSession - Trulioo hfSession (transaction ID)
	 * @param businessContext - Business context data
	 * @param taskId - Optional task ID (will be fetched from KYB record if not provided)
	 * @param businessEntityVerificationId - Optional KYB verification ID to fetch taskId from
	 */
	async storeInitialPersonRecord(
		businessId: string,
		hfSession: string,
		businessContext: TruliooPSCFormData,
		taskId?: string,
		businessEntityVerificationId?: string
	): Promise<void> {
		try {
			const uuidFormattedExternalId = convertToUUIDFormat(hfSession);

			logger.info(`Storing initial PSC verification record for business ${businessId}, hfSession: ${hfSession}, taskId: ${taskId}, businessEntityVerificationId: ${businessEntityVerificationId}`);

			// If taskId is not provided, try to fetch it from the KYB verification record
			let resolvedTaskId = taskId;
			if (!resolvedTaskId && businessEntityVerificationId) {
				try {
					const kybRecord = await db<IBusinessEntityVerification>("integration_data.business_entity_verification")
						.where({ id: businessEntityVerificationId as UUID })
						.whereNotNull("business_integration_task_id")
						.first();

					if (kybRecord?.business_integration_task_id) {
						resolvedTaskId = kybRecord.business_integration_task_id as string;
						logger.info(`Fetched taskId ${resolvedTaskId} from KYB verification record ${businessEntityVerificationId}`);
					}
				} catch (error) {
					logger.warn(error, `Could not fetch taskId from KYB verification record ${businessEntityVerificationId}`);
				}
			}

			// If still no taskId, try to find any recent KYB verification for this business
			if (!resolvedTaskId) {
				try {
					const recentKybRecord = await db<IBusinessEntityVerification>("integration_data.business_entity_verification")
						.where({ business_id: businessId as UUID })
						.whereNotNull("business_integration_task_id")
						.orderBy("created_at", "desc")
						.first();

					if (recentKybRecord?.business_integration_task_id) {
						resolvedTaskId = recentKybRecord.business_integration_task_id as string;
						logger.info(`Fetched taskId ${resolvedTaskId} from recent KYB verification record for business ${businessId}`);
					}
				} catch (error) {
					logger.warn(error, `Could not fetch taskId from recent KYB verification for business ${businessId}`);
				}
			}

			// Build the record - business_integration_task_id is NOT NULL, so we must have a taskId
			const initialRecord: Partial<IBusinessEntityVerification> = {
				business_id: businessId as UUID,
				external_id: uuidFormattedExternalId,
				name: businessContext.companyName,
				status: "in_progress",
				unique_external_id: uuidFormattedExternalId
			};

			// Only add taskId if we have one (NOT NULL constraint)
			if (resolvedTaskId) {
				initialRecord.business_integration_task_id = resolvedTaskId as UUID;
			} else {
				logger.error(`Cannot store PSC verification record without taskId for hfSession ${hfSession} - business_integration_task_id is required. Business: ${businessId}, businessEntityVerificationId: ${businessEntityVerificationId}`);
				return; // Exit early - we cannot insert without taskId
			}

			await db<IBusinessEntityVerification>("integration_data.business_entity_verification")
				.insert(initialRecord)
				.onConflict(["external_id"])
				.ignore();

		} catch (error: unknown) {
			logger.error(error, `Error storing initial PSC verification record for hfSession ${hfSession}:`);
		}
	}

	/**
	 * Store person record in business_entity_people table for integration with business verification
	 */
	async storePersonInBusinessEntityPeople(
		personData: TruliooUBOPersonData,
		businessEntityVerificationId: string,
		verificationData: TruliooPersonVerificationData
	): Promise<void> {
		try {
			// Normalize source field to array format to match Middesk structure
			// Use inquiryId as id when available, with fallback for cases where inquiryId is not provided
			const inquiryId = verificationData.inquiryId;
			const sourceObject: {
				type: string;
				provider: string;
				id: string;
				controlType?: string;
				inquiryId?: string;
			} = {
				type: "trulioo_psc",
				provider: "trulioo",
				id: inquiryId || `${businessEntityVerificationId}-${personData.fullName}`,
				controlType: personData.controlType
			};
			// Only include inquiryId if it's available to avoid redundancy with id field
			if (inquiryId) {
				sourceObject.inquiryId = inquiryId;
			}

			const personRecord = {
				business_entity_verification_id: businessEntityVerificationId as UUID,
				name: personData.fullName,
				submitted: true,
				source: JSON.stringify([sourceObject]),
				titles: personData.title ? [personData.title] : [],
				metadata: JSON.stringify({
					personData,
					screeningResults: verificationData.results,
					controlType: personData.controlType,
					ownershipPercentage: personData.ownershipPercentage,
					email: personData.email,
					phone: personData.phone,
					nationality: personData.nationality,
					screenedAt: new Date().toISOString()
				})
			};

			// Insert or update the person record
			await db<IBusinessEntityPerson>("integration_data.business_entity_people")
				.insert(personRecord)
				.onConflict(["business_entity_verification_id", "name"])
				.merge();

			logger.info(`Person record stored in business_entity_people for: ${personData.fullName}`);
		} catch (error: unknown) {
			logger.error(error, `Error storing person in business_entity_people for ${personData.fullName}:`);
			// Don't throw error here as this is supplementary to the main verification process
		}
	}
}
