import { TruliooBase } from "../common/truliooBase";
import { TruliooKYBFormData, TruliooBusinessData } from "../common/types";
import { extractRegistrationNumber } from "../common/utils";
import { logger } from "#helpers/logger";
import { VerificationApiError } from "#api/v1/modules/verification/error";
import { StatusCodes } from "http-status-codes";
import { ERROR_CODES } from "#constants";
import { ITruliooBusinessResultsStorage, ITruliooUBOExtractor } from "./types";

/**
 * Trulioo Business KYB Processor
 * Handles the KYB (Know Your Business) flow processing
 */
export class TruliooBusinessKYBProcessor {
	private truliooBase: TruliooBase;
	private resultsStorage: ITruliooBusinessResultsStorage;
	private uboExtractor: ITruliooUBOExtractor;

	constructor(
		truliooBase: TruliooBase,
		resultsStorage: ITruliooBusinessResultsStorage,
		uboExtractor: ITruliooUBOExtractor
	) {
		this.truliooBase = truliooBase;
		this.resultsStorage = resultsStorage;
		this.uboExtractor = uboExtractor;
	}

	/**
	 * Process KYB (Know Your Business) flow
	 * This handles business entity verification
	 */
	async processKYBFlow(taskId: string, businessData: TruliooBusinessData): Promise<void> {
		logger.info(`🚀 Starting KYB verification for business: ${this.truliooBase["businessID"]}`);

		// Get KYB flow ID from TruliooBase configuration
		const kybFlowId = this.truliooBase.getKybFlowId();
		logger.info(`🔗 Using Trulioo KYB Flow ID: ${kybFlowId}`);

		// Extract business address from the nested structure
		// Try business_addresses array first, then fall back to flat address fields
		const primaryAddress =
			businessData.business_addresses?.find(addr => addr.is_primary) || businessData.business_addresses?.[0];

		// Build address data from either nested structure or flat fields (from getBusinessDetails)
		// We keep street-only (line 1) and full address (line 1 + line 2) separate:
		//   - streetOnly  → sent to Trulioo so their Comprehensive View shows all-green Address Line 1
		//   - fullAddress → stored internally so the verification badge comparison still matches the user-submitted address
		const addressLine1 = primaryAddress?.addressLine1 || primaryAddress?.line_1 || (businessData as any).address_line_1;
		const addressLine2 =
			primaryAddress?.address_line_2 || primaryAddress?.apartment || (businessData as any).address_line_2;
		const fullAddressLine = [addressLine1, addressLine2].filter(Boolean).join(", ") || addressLine1;
		const streetOnlyLine = addressLine1;
		const addressData = {
			country: primaryAddress?.country || (businessData as any).address_country,
			state: primaryAddress?.state || (businessData as any).address_state,
			city: primaryAddress?.city || (businessData as any).address_city,
			postal_code: primaryAddress?.postal_code || (businessData as any).address_postal_code
		};

		logger.info(`📍 Address data extracted for business (flowId: ${kybFlowId}, businessID: ${this.truliooBase["businessID"]}): ${JSON.stringify(addressData)}`);

		// Validate required business data before creating payload
		if (!businessData.name) {
			throw new VerificationApiError(
				"Business name is required for KYB verification",
				StatusCodes.BAD_REQUEST,
				ERROR_CODES.VALIDATION_ERROR
			);
		}

		if (!addressData.country) {
			throw new VerificationApiError(
				"Business country is required for KYB verification",
				StatusCodes.BAD_REQUEST,
				ERROR_CODES.VALIDATION_ERROR
			);
		}

		if (!addressData.postal_code) {
			throw new VerificationApiError(
				"Business postal code is required for KYB verification",
				StatusCodes.BAD_REQUEST,
				ERROR_CODES.VALIDATION_ERROR
			);
		}

		// Extract registration number from business data (check multiple possible field names, including TIN)
		const registrationNumber = extractRegistrationNumber(businessData);

		// Storage payload: uses fullAddressLine (street + suite) so the verification badge
		// matches the user-submitted address stored in business_entity_address_source
		const businessPayload: TruliooKYBFormData = {
			companyName: businessData.name,
			companyCountryIncorporation: addressData.country,
			companyStateAddress: addressData.state || "",
			companyCity: addressData.city || "",
			companyZip: addressData.postal_code as string, // Required field - validated above
			companyState: addressData.state || undefined,
			companyregno: typeof registrationNumber === "string" ? registrationNumber : undefined,
			companyAddressFull: fullAddressLine || undefined
		};

		// Trulioo payload: uses streetOnlyLine (no suite/apartment) so Trulioo's
		// Comprehensive View compares only the street against data sources → all-green Address Line 1
		const truliooPayload: TruliooKYBFormData = {
			...businessPayload,
			companyAddressFull: streetOnlyLine || undefined
		};

		logger.info(`📤 Sending business data to Trulioo: ${JSON.stringify(truliooPayload, null, 2)}`);
		logger.info(`💾 Storage payload (full address with suite): companyAddressFull=${businessPayload.companyAddressFull}`);

		// Run the KYB verification flow — send street-only address to Trulioo
		const flowResult = await this.truliooBase.runVerificationFlow(kybFlowId, truliooPayload);

		if (!flowResult.hfSession) {
			throw new VerificationApiError(
				"Failed to initiate KYB flow - no session returned from Trulioo",
				StatusCodes.BAD_REQUEST,
				ERROR_CODES.INVALID
			);
		}

		logger.info(`✅ Trulioo KYB flow initiated successfully with session: ${flowResult.hfSession}`);

		// Store initial placeholder record to handle race condition with webhook
		await this.resultsStorage.storeInitialVerificationRecord(taskId, businessPayload, flowResult.hfSession);

		// Store business verification results
		await this.resultsStorage.storeBusinessVerificationResults(taskId, businessPayload, flowResult);

		logger.info(`🎉 KYB verification completed for business: ${this.truliooBase["businessID"]}`);
	}
}
