import type { IIntegrationStrategy } from "#lib/types/IIntegrationStrategy";
import { KYXUserBody, KYXVerificationOptions, KYXVerificationResponse } from "./common";

/**
 * KYX Strategy Interface
 * Defines contract for KYX identity verification operations
 */
export interface IKyxStrategy extends IIntegrationStrategy {
	/**
	 * Performs KYX identity verification
	 * @param body - The user body information provided by the user
	 * @param options - Optional verification options
	 * @returns Promise resolving to verification response
	 */
	verifyIdentity(body: KYXUserBody, options?: KYXVerificationOptions): Promise<KYXVerificationResponse>;

	/**
	 * Gets access token for KYX API authentication
	 * @returns Promise resolving to access token
	 */
	getAccessToken(): Promise<string>;
}
