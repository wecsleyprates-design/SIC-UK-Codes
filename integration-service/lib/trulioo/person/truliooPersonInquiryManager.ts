import { TruliooBase } from "../common/truliooBase";
import { INTEGRATION_ID, INTEGRATION_STATUS, ERROR_CODES } from "#constants";
import { TruliooPSCFormData, TruliooUBOPersonData, TruliooDataIntegration } from "../common/types";
import { logger } from "#helpers/logger";
import { db } from "#helpers/knex";
import { StatusCodes } from "http-status-codes";
import { VerificationApiError } from "#api/v1/modules/verification/error";
import { ITruliooPersonDataStorage, ITruliooPersonVerificationProcessor } from "./types";
import type { IBusinessEntityPerson } from "#types/db";
import type { UUID } from "crypto";

/**
 * Trulioo Person Inquiry Manager
 * Handles person verification inquiry creation, retrieval, and completion
 */
export class TruliooPersonInquiryManager {
	private truliooBase: TruliooBase;
	private businessID: string;
	private dataStorage: ITruliooPersonDataStorage;
	private verificationProcessor: ITruliooPersonVerificationProcessor;

	/**
	 * Parse and validate verification data with proper type safety
	 */
	private parseVerificationData(data: unknown): {
		inquiry_status?: string;
		inquiry_id?: string;
		[key: string]: unknown;
	} {
		if (typeof data === "object" && data !== null) {
			return data as { inquiry_status?: string; inquiry_id?: string; [key: string]: unknown };
		}
		return {};
	}

	constructor(
		truliooBase: TruliooBase,
		businessID: string,
		dataStorage: ITruliooPersonDataStorage,
		verificationProcessor: ITruliooPersonVerificationProcessor
	) {
		this.truliooBase = truliooBase;
		this.businessID = businessID;
		this.dataStorage = dataStorage;
		this.verificationProcessor = verificationProcessor;
	}

	/**
	 * Create person verification inquiry (similar to Persona's createInquiry)
	 * @param personData Person data to verify
	 * @param businessData Business context data
	 * @param businessEntityVerificationId Optional business entity verification ID for integration
	 * @param taskId Optional business integration task ID
	 * @returns Verification inquiry response
	 */
	async createPersonInquiry(
		personData: TruliooUBOPersonData,
		businessData: TruliooPSCFormData,
		businessEntityVerificationId?: string,
		taskId?: string
	) {
		try {
			logger.info(`Creating Trulioo person verification inquiry for: ${personData.fullName}`);

			// Check if person verification already exists in business_entity_people table
			if (businessEntityVerificationId) {
				const existingPersonRecord = await db<IBusinessEntityPerson>("integration_data.business_entity_people")
					.select("*")
					.where({
						business_entity_verification_id: businessEntityVerificationId as UUID,
						name: personData.fullName
					})
					.first();

				if (existingPersonRecord) {
					// Safely parse metadata with validation
					let metadata: {
						screeningResults?: { status?: string; metadata?: { hfSession?: string }; [key: string]: unknown };
						[key: string]: unknown;
					} = {};
					try {
						metadata = existingPersonRecord.metadata ? JSON.parse(existingPersonRecord.metadata) : {};
					} catch (error) {
						logger.warn(`Invalid metadata format for person record ${existingPersonRecord.id}, using empty object`);
						metadata = {};
					}
					if (metadata.screeningResults?.status === "COMPLETED") {
						return {
							data: { is_trulioo_verified: true, personId: existingPersonRecord.id },
							message: "A connected Trulioo verification has been located."
						};
					}

					if (metadata.screeningResults?.status === "PENDING") {
						return {
							data: {
								inquiry_id: metadata.screeningResults?.metadata?.hfSession,
								trulioo_status: "pending",
								personId: existingPersonRecord.id
							},
							message: "Verification pending"
						};
					}
				}
			}

			// Check if person verification already exists in data_integrations table (legacy, optional)
			try {
				const existingVerification = await db<TruliooDataIntegration>("data_integrations")
					.select("*")
					.where({
						business_id: this.businessID,
						integration_id: INTEGRATION_ID.TRULIOO
					})
					.first();

				if (existingVerification) {
					const existingData = this.parseVerificationData(existingVerification.data);

					if (existingData.inquiry_status === "completed") {
						return {
							data: { is_trulioo_verified: true },
							message: "A connected Trulioo verification has been located."
						};
					}

					// If existing inquiry is pending, return current status
					if (existingData.inquiry_status === "pending" || existingData.inquiry_status === "created") {
						return {
							data: {
								inquiry_id: existingData.inquiry_id as string,
								trulioo_status: existingData.inquiry_status
							},
							message: "Verification pending"
						};
					}
				}
			} catch (legacyTableError) {
				// Legacy data_integrations table doesn't exist or query failed - this is OK
				logger.debug(`data_integrations table not available (legacy table): ${legacyTableError}`);
			}

			// Create new person verification
			const verificationData = await this.verificationProcessor.processPersonVerification(personData, businessData, taskId, businessEntityVerificationId);

			const data = {
				inquiry_id: verificationData.inquiryId,
				inquiry_status: verificationData.status,
				person_data: personData,
				business_data: businessData,
				verification_type: "PSC",
				business_entity_verification_id: businessEntityVerificationId
			};

			// Store verification data in both tables concurrently for better performance
			const storagePromises: Promise<unknown>[] = [];
			
			// Store in data_integrations table (for backward compatibility, optional)
			// Wrap in a promise that catches errors to prevent Promise.all from failing
			storagePromises.push(
				db<TruliooDataIntegration>("data_integrations")
					.insert({
						integration_id: INTEGRATION_ID.TRULIOO,
						data: data,
						status: INTEGRATION_STATUS.INITIATED,
						business_id: this.businessID,
						created_by: "system",
						updated_by: "system"
					})
					.catch((legacyTableError) => {
						// Legacy data_integrations table doesn't exist - this is OK
						logger.debug(`data_integrations table not available (legacy table): ${legacyTableError}`);
						return null; // Return null instead of throwing to allow Promise.all to succeed
					})
			);

			// If we have a businessEntityVerificationId, also store in business_entity_people table
			if (businessEntityVerificationId) {
				storagePromises.push(
					this.dataStorage.storePersonInBusinessEntityPeople(personData, businessEntityVerificationId, verificationData)
				);
			}

			// Execute all storage operations concurrently
			// Use Promise.allSettled to handle cases where legacy table doesn't exist
			await Promise.allSettled(storagePromises);

			return {
				data: { ...data, is_trulioo_verified: false },
				message: "Trulioo person verification process has been started."
			};
		} catch (error: unknown) {
			logger.error(error, "Error creating person verification inquiry:");
			// Convert to controlled error following Middesk pattern
			if (error instanceof VerificationApiError) {
				throw error; // Already controlled
			}
			throw new VerificationApiError(
				`Failed to create person verification inquiry: ${error instanceof Error ? error.message : "Unknown error"}`,
				StatusCodes.BAD_REQUEST,
				ERROR_CODES.INVALID
			);
		}
	}

	/**
	 * Get person verification details (similar to Persona's getPersonaDetails)
	 * @returns Person verification details
	 */
	async getPersonVerificationDetails() {
		try {
			// Check if verification exists (legacy table, optional)
			let verificationRecord;
			try {
				verificationRecord = await db<TruliooDataIntegration>("data_integrations")
					.select("*")
					.where({
						business_id: this.businessID,
						integration_id: INTEGRATION_ID.TRULIOO
					})
					.first();
			} catch (legacyTableError) {
				// Legacy data_integrations table doesn't exist - this is OK
				logger.debug(`data_integrations table not available (legacy table): ${legacyTableError}`);
			}

			if (!verificationRecord) {
				throw new VerificationApiError("No Trulioo verification found", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
			}

			const verificationData = this.parseVerificationData(verificationRecord.data);
			const status = verificationData.inquiry_status;

			if (status === "expired") {
				return { message: "Verification is expired" };
			} else if (status === "failed") {
				return { message: "Verification failed" };
			} else if (status === "created" || status === "pending") {
				return {
					data: {
						inquiry_id: verificationData.inquiry_id as string,
						trulioo_status: status
					},
					message: "Verification pending"
				};
			}

			// If completed, return full verification details
			return {
				data: {
					inquiry_id: verificationData.inquiry_id as string,
					trulioo_status: status,
					person_data: verificationData.person_data,
					business_data: verificationData.business_data,
					verification_results: verificationData.verification_results
				},
				message: "Verification completed"
			};
		} catch (error: unknown) {
			logger.error(error, "Error getting person verification details:");
			// Convert to controlled error following Middesk pattern
			if (error instanceof VerificationApiError) {
				throw error; // Already controlled
			}
			throw new VerificationApiError(
				`Failed to get person verification details: ${error instanceof Error ? error.message : "Unknown error"}`,
				StatusCodes.BAD_REQUEST,
				ERROR_CODES.INVALID
			);
		}
	}

	/**
	 * Complete person verification inquiry
	 */
	async completePersonInquiry() {
		try {
			// Try to get verification from legacy table (optional)
			let verificationRecord;
			try {
				verificationRecord = await db<TruliooDataIntegration>("data_integrations")
					.select("*")
					.where({
						business_id: this.businessID,
						integration_id: INTEGRATION_ID.TRULIOO
					})
					.first();
			} catch (legacyTableError) {
				// Legacy data_integrations table doesn't exist - this is OK
				logger.debug(`data_integrations table not available (legacy table): ${legacyTableError}`);
			}

			if (!verificationRecord) {
				throw new VerificationApiError("No verification found", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
			}

			let data = this.parseVerificationData(verificationRecord.data);
			data = { ...data, inquiry_status: "completed" };

			try {
				await db<TruliooDataIntegration>("data_integrations")
					.where({
						business_id: this.businessID,
						integration_id: INTEGRATION_ID.TRULIOO
					})
					.update({
						data: data,
						status: INTEGRATION_STATUS.COMPLETED
					});
			} catch (legacyTableError) {
				// Legacy data_integrations table doesn't exist - this is OK
				logger.debug(`data_integrations table not available (legacy table): ${legacyTableError}`);
			}

			logger.info(`Person verification completed for business: ${this.businessID}`);
		} catch (error: unknown) {
			logger.error(error, "Error completing person verification:");
			// Convert to controlled error following Middesk pattern
			if (error instanceof VerificationApiError) {
				throw error; // Already controlled
			}
			throw new VerificationApiError(
				`Failed to complete person verification: ${error instanceof Error ? error.message : "Unknown error"}`,
				StatusCodes.BAD_REQUEST,
				ERROR_CODES.INVALID
			);
		}
	}
}
