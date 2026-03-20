/**
 * GIACT Mock Strategy Implementation
 * Provides mock responses for testing and development environments
 */

import type { ServiceRequest, GIACTResponse, IGiactStrategy } from "#lib/giact/types";
import { findMatchingMockResponse } from "#constants/giact-mock-mappings";
import { createStrategyLogger, type StrategyLogger } from "#helpers";
import { GIACT_SERVICE_FLAGS } from "../giact.constants";

export class GiactMockStrategy implements IGiactStrategy {
	private logger: StrategyLogger;

	constructor() {
		this.logger = createStrategyLogger("GIACT", "MOCK");
	}

	getMode(): "MOCK" {
		return "MOCK";
	}

	isAvailable(): boolean {
		return true; // Mock is always available
	}

	async verifyAccount(request: ServiceRequest): Promise<GIACTResponse> {
		this.logger.debug(
			`Processing GIACT mock verify request ${JSON.stringify({ requestId: request.UniqueId, accountNumber: request.BankAccountEntity?.AccountNumber?.slice(-4), routingNumber: request.BankAccountEntity?.RoutingNumber, serviceType: "verify" })}`
		);
		const response = await this.getMockResponse(request, "verify");
		this.logger.debug(
			`GIACT mock verify request completed ${JSON.stringify({ requestId: request.UniqueId, verificationResult: response?.VerificationResult, responseCode: response?.AccountVerificationResult?.ResponseCode })}`
		);
		return response;
	}

	async authenticateAccount(request: ServiceRequest): Promise<GIACTResponse> {
		this.logger.debug(
			`Processing GIACT mock authenticate request ${JSON.stringify({ requestId: request.UniqueId, accountNumber: request.BankAccountEntity?.AccountNumber?.slice(-4), routingNumber: request.BankAccountEntity?.RoutingNumber, serviceType: "authenticate" })}`
		);
		const response = await this.getMockResponse(request, "authenticate");
		this.logger.debug(
			`GIACT mock authenticate request completed ${JSON.stringify({ requestId: request.UniqueId, verificationResult: response?.VerificationResult, responseCode: response?.AccountVerificationResult?.ResponseCode })}`
		);
		return response;
	}

	/**
	 * Generates mock GIACT response for testing
	 * @param request - Service request payload
	 * @param serviceType - Service type (verify, authenticate)
	 * @returns Promise resolving to mock response
	 */
	private async getMockResponse(request: ServiceRequest, serviceType?: string): Promise<GIACTResponse> {
		const delay = Math.random() * 400 + 100;
		await new Promise(resolve => setTimeout(resolve, delay));

		this.logger.debug(
			`Mock response generated ${JSON.stringify({ requestId: request.UniqueId, serviceType, delayMs: Math.round(delay) })}`
		);

		const predefinedResponse = findMatchingMockResponse(request);
		if (predefinedResponse) {
			this.logger.debug(
				`Using predefined mock response ${JSON.stringify({ requestId: request.UniqueId, accountNumber: request.BankAccountEntity?.AccountNumber?.slice(-4), routingNumber: request.BankAccountEntity?.RoutingNumber })}`
			);
			return predefinedResponse;
		}

		this.logger.debug(
			`Using default mock response ${JSON.stringify({ requestId: request.UniqueId, accountNumber: request.BankAccountEntity?.AccountNumber?.slice(-4), routingNumber: request.BankAccountEntity?.RoutingNumber })}`
		);

		return this.createMockDefaultResponse(request);
	}

	/**
	 * Creates default mock response for testing.
	 * Uses the new GIACT date-range property names (AccountAdded, AccountLastUpdated, AccountClosed)
	 * Values are sample strings grabbed from: https://sandbox.api.giact.com/verificationservices/web_api/Help/Api/POST-web_api-inquiries_v5_8
	 * Mocks and constants use new names and are backwards compatible for reading old meta/API responses.
	 *
	 * @param request - Service request payload
	 * @returns Default mock GIACT response
	 */
	private createMockDefaultResponse(request: ServiceRequest): GIACTResponse {
		return {
			ItemReferenceID: 12345,
			CreatedDate: new Date().toISOString(),
			ErrorMessages: [],
			UniqueID: request.UniqueId,
			VerificationResult: 1,
			AlertMessages: null,
			// Option A: new date-range fields only (AccountAdded, AccountLastUpdated, AccountClosed)
			AccountVerificationResult: {
				ResponseCode: 1,
				BankName: "Mock Bank",
				AccountAdded: "sample string 6",
				AccountLastUpdated: "sample string 7",
				AccountClosed: "sample string 8",
				BankAccountType: "Checking",
				FundsConfirmationResult: null
			},
			AccountAuthenticationResult: null,
			PersonIdentificationResult: null,
			BusinessIdentificationResult: null,
			WorldSanctionScanResult: null,
			ESIResult: null,
			IPAddressResult: null,
			DomainWhoIsResult: null,
			MobileResult: null,
			AccountInsightsResult: null,
			IdentityScoreResult: null,
			PhoneVerificationResult: null
		};
	}
}
