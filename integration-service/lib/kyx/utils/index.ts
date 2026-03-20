import { KYXVerificationRequest, KYXVerificationOptions, KYXUserBody } from "../types";
import { logger } from "#helpers/logger";
import { envConfig } from "#configs";

export class KYXUtil {
	/**
	 * Collects, validates, and maps customer/applicant data for KYX identity verification
	 * @param body - User body information for the verification request
	 * @param options - Optional verification options
	 * @returns Promise<KYXVerificationRequest> - Formatted data for KYX API
	 */
	async getRequestPayload(
		{
			firstName,
			middleName,
			lastName,
			email,
			phoneNumber,
			dob,
			address1,
			address2,
			city,
			state,
			postalCode,
			ssn,
			country
		}: KYXUserBody,
		options?: KYXVerificationOptions
	): Promise<KYXVerificationRequest> {
		logger.info("KYX: Getting request payload for KYX verification");
		try {
			// Determine test mode - default to true in non-production environments
			const testMode = envConfig.NODE_ENV === "production"
				? false
				: envConfig.KYX_ENV_MODE === 'development' || false;

			// Build base request with required fields
			const kyxRequest: KYXVerificationRequest = {
				checks: options?.checks || ["prefillExpress"], // Default to basic KYC check
				country: country || "USA", // Default to USA (3-letter code as per spec)
				userConsent: options?.userConsent || true, // Required flag as specified
				testMode,
				plan: options?.plan || false
			};

			// Add optional fields
			if (options?.clientReference) {
				kyxRequest.clientReference = options.clientReference;
			}

			// Add user information fields if present
			this.addUserInfo(kyxRequest, "firstName", firstName);
			this.addUserInfo(kyxRequest, "middleName", middleName);
			this.addUserInfo(kyxRequest, "lastName", lastName);
			this.addUserInfo(kyxRequest, "phoneNumber", phoneNumber);
			this.addUserInfo(kyxRequest, "dob", dob);
			this.addUserInfo(kyxRequest, "email", email);
			this.addUserInfo(kyxRequest, "address1", address1);
			this.addUserInfo(kyxRequest, "address2", address2);
			this.addUserInfo(kyxRequest, "city", city);
			this.addUserInfo(kyxRequest, "state", state);
			this.addUserInfo(kyxRequest, "postalCode", postalCode);
			this.addUserInfo(kyxRequest, "ssn", ssn);

			logger.info("KYX: Successfully got request payload for KYX verification");
			return kyxRequest;
		} catch (error) {
			logger.error(`Failed to get request payload for KYX verification`);
			throw error;
		}
	}

	// Helper function to add trimmed non-empty string values
	private addUserInfo = (
		target: KYXVerificationRequest,
		key: keyof KYXVerificationRequest,
		value: string | undefined
	): void => {
		const trimmedValue = value?.trim();
		if (trimmedValue) {
			(target as any)[key] = trimmedValue;
		}
	};
}
