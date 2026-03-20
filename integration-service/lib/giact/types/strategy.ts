import type { IIntegrationStrategy } from "#lib/types/IIntegrationStrategy";
import { GIACTResponse, ServiceRequest } from "./common";

/**
 * GIACT Strategy Interface
 * Defines contract for GIACT verification and authentication operations
 */
export interface IGiactStrategy extends IIntegrationStrategy {
	/**
	 * Verifies bank account using GIACT services
	 * @param request - Service request payload
	 * @returns Promise resolving to verification response
	 */
	verifyAccount(request: ServiceRequest): Promise<GIACTResponse>;

	/**
	 * Authenticates bank account using GIACT services
	 * @param request - Service request payload
	 * @returns Promise resolving to authentication response
	 */
	authenticateAccount(request: ServiceRequest): Promise<GIACTResponse>;
}
