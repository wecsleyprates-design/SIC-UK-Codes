import { TruliooBase } from "../common/truliooBase";
import { TruliooPSCFormData, TruliooUBOPersonData, TruliooPersonVerificationData } from "../common/types";
import { logger } from "#helpers/logger";
import { VerificationApiError } from "#api/v1/modules/verification/error";
import { StatusCodes } from "http-status-codes";
import { ERROR_CODES } from "#constants";
import { ITruliooPersonScreeningProcessor } from "./types";
import { TruliooPersonDataStorage } from "./truliooPersonDataStorage";
import { sanitizeLog } from "../common/utils";
import { processAndPersistTruliooAdverseMedia } from "../common/truliooAdverseMediaProcessor";

/**
 * Trulioo Person Verification Processor
 * Handles person verification processing using PSC flow
 */
export class TruliooPersonVerificationProcessor {
	private truliooBase: TruliooBase;
	private screeningProcessor: ITruliooPersonScreeningProcessor;
	private dataStorage: TruliooPersonDataStorage;

	constructor(
		truliooBase: TruliooBase,
		screeningProcessor: ITruliooPersonScreeningProcessor,
		dataStorage: TruliooPersonDataStorage
	) {
		this.truliooBase = truliooBase;
		this.screeningProcessor = screeningProcessor;
		this.dataStorage = dataStorage;
	}

	/**
	 * Split a full name into first and last name parts
	 * Handles cases where only fullName is available (common with Trulioo director data)
	 */
	private splitFullName(fullName: string): { firstName: string; lastName: string } {
		if (!fullName || fullName.trim() === "") {
			return { firstName: "", lastName: "" };
		}

		const nameParts = fullName.trim().split(/\s+/);
		if (nameParts.length === 1) {
			// Single name - use as both first and last for Trulioo compatibility
			return { firstName: nameParts[0], lastName: nameParts[0] };
		}

		// First part is firstName, rest is lastName
		const firstName = nameParts[0];
		const lastName = nameParts.slice(1).join(" ");
		return { firstName, lastName };
	}

	/**
	 * Process person verification using PSC flow
	 * @param personData Person data to verify
	 * @param businessData Business context data
	 * @param taskId Optional business integration task ID for linking verification records
	 * @param businessEntityVerificationId Optional KYB verification ID to fetch taskId from if not provided
	 */
	async processPersonVerification(
		personData: TruliooUBOPersonData,
		businessData: TruliooPSCFormData,
		taskId?: string,
		businessEntityVerificationId?: string
	): Promise<TruliooPersonVerificationData> {
		try {
			const safeFullName = sanitizeLog(personData.fullName);
			// Get PSC flow ID from TruliooBase configuration
			const pscFlowId = this.truliooBase.getPscFlowId();

			// Split fullName into firstName/lastName if not already provided
			// Trulioo PSC requires separate first_name and last_name fields
			let firstName = personData.firstName;
			let lastName = personData.lastName;
			if ((!firstName || firstName.trim() === "") && personData.fullName) {
				const splitName = this.splitFullName(personData.fullName);
				firstName = splitName.firstName;
				lastName = splitName.lastName;
				logger.info(
					`Split fullName "${safeFullName}" into firstName="${sanitizeLog(firstName)}", lastName="${sanitizeLog(lastName)}"`
				);
			}

			// Use business country as fallback for person country (PSC requires address_country)
			const personCountry = personData.country || businessData.companyCountryIncorporation || "";

			// DOB is optional for PSC screening — omitting it lets Trulioo match by name only.
			const personDateOfBirth = personData.dateOfBirth || "";
			if (!personData.dateOfBirth) {
				logger.info(`DOB not available for ${safeFullName}, field will be omitted from PSC payload`);
			}

			// Create combined payload with business and person data
			const combinedPayload = {
				...businessData,
				// Add person-specific fields that Trulioo PSC flow expects
				personName: personData.fullName,
				personFirstName: firstName,
				personLastName: lastName,
				personDateOfBirth: personDateOfBirth,
				personAddress: personData.addressLine1,
				personCity: personData.city,
				personPostalCode: personData.postalCode,
				personCountry: personCountry,
				personEmail: personData.email,
				personPhone: personData.phone,
				personTitle: personData.title,
				personNationality: personData.nationality,
				personPassportNumber: personData.passportNumber,
				personNationalId: personData.nationalId,
				ownershipPercentage: personData.ownershipPercentage,
				controlType: personData.controlType
			};

			// Run the PSC verification flow using shared base methods
			const flowResult = await this.truliooBase.runVerificationFlow(pscFlowId, combinedPayload);

			if (!flowResult.hfSession) {
				throw new Error("Failed to initiate PSC screening flow");
			}

			// Store initial placeholder record to handle race condition with webhook
			// This ensures the webhook can find the business_id when it arrives
			await this.dataStorage.storeInitialPersonRecord(
				this.truliooBase.getBusinessId(),
				flowResult.hfSession,
				businessData,
				taskId,
				businessEntityVerificationId
			);

			// Process screening results
			const screeningResults = await this.screeningProcessor.processScreeningResults(personData, flowResult);

			// Post-process: extract ADVERSE_MEDIA hits from PSC results, score with OpenAI, persist
			if (screeningResults.watchlistHits && screeningResults.watchlistHits.length > 0 && taskId) {
				try {
					const { adverseMedia } = await import("#api/v1/modules/adverse-media/adverse-media");
					const personName = personData.fullName || `${personData.firstName || ""} ${personData.lastName || ""}`.trim();
					const businessName = businessData.companyName || "";
					await processAndPersistTruliooAdverseMedia({
						watchlistHits: screeningResults.watchlistHits,
						businessId: this.truliooBase.getBusinessId(),
						taskId,
						entityNames: businessName ? [businessName] : [],
						individuals: personName ? [personName] : [],
						deps: {
							scoreAdverseMedia: adverseMedia.scoreAdverseMedia.bind(adverseMedia),
							insertAdverseMedia: adverseMedia.insertAdverseMedia.bind(adverseMedia)
						}
					});
				} catch (error) {
					logger.error(error, `Error processing person-level adverse media for ${sanitizeLog(personData.fullName)}`);
				}
			}

			// Validate required data before returning
			if (!flowResult.hfSession) {
				throw new Error("Missing hfSession from Trulioo flow result");
			}

			return {
				inquiryId: flowResult.hfSession,
				status: screeningResults.status === "COMPLETED" ? "completed" : "pending",
				results: {
					watchlistHits: screeningResults.watchlistHits || [],
					screeningStatus: screeningResults.status || "unknown"
				}
			};
		} catch (error: unknown) {
			const safeFullName = sanitizeLog(personData.fullName);
			logger.error(error, `Error processing person verification for ${safeFullName}:`);
			// Convert to controlled error following Middesk pattern
			if (error instanceof VerificationApiError) {
				throw error; // Already controlled
			}
			throw new VerificationApiError(
				`Failed to process person verification for ${safeFullName}: ${error instanceof Error ? error.message : "Unknown error"}`,
				StatusCodes.BAD_REQUEST,
				ERROR_CODES.INVALID
			);
		}
	}
}
