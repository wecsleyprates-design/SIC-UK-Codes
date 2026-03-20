import { envConfig } from "#configs";
import { logger } from "#helpers/logger";
import { INTEGRATION_ID } from "#constants";
import { TruliooFlows, FlowParams, TruliooKYBFormData, TruliooPSCFormData, FlowElement, TruliooWatchlistHit } from "./types";
import { VerificationApiError } from "#api/v1/modules/verification/error";
import { StatusCodes } from "http-status-codes";
import { ERROR_CODES } from "#constants";

// Import the refactored modules
import { TruliooRetryManager } from "./truliooRetryManager";
import { TruliooHttpClient } from "./truliooHttpClient";
import { TruliooErrorHandler } from "./truliooErrorHandler";
import { TruliooTokenManager } from "./truliooTokenManager";
import {
	resolveRequiredFieldValue,
	shouldIncludeFieldValue
} from "./formDataHelpers";
import { toShortNodeType } from "./utils";

/**
 * Trulioo Base Class
 * Focuses on core API communication and flow management
 * All error handling, retry logic, and utilities are in separate modules
 */
export abstract class TruliooBase {
	protected clientId: string;
	protected clientSecret: string;
	protected tokenAPIUrl: string;
	protected initFlowApi: string;
	protected submitApi: string;
	protected retrieveApi: string;
	protected businessID: string;
	protected flowType: string;
	protected kybFlowId: string;
	protected pscFlowId: string;

	constructor(businessID: string) {
		this.clientId = envConfig.TRULIOO_CLIENT_ID!;
		this.clientSecret = envConfig.TRULIOO_CLIENT_SECRET!;
		// Validate required environment variables
		if (!envConfig.TRULIOO_AUTH_API) {
			throw new Error("TRULIOO_AUTH_API environment variable is required");
		}
		if (!envConfig.TRULIOO_INITFLOW_API) {
			throw new Error("TRULIOO_INITFLOW_API environment variable is required");
		}
		if (!envConfig.TRULIOO_SUBMIT_API) {
			throw new Error("TRULIOO_SUBMIT_API environment variable is required");
		}
		if (!envConfig.TRULIOO_RETRIEVE_API) {
			throw new Error("TRULIOO_RETRIEVE_API environment variable is required");
		}

		this.tokenAPIUrl = envConfig.TRULIOO_AUTH_API;
		this.initFlowApi = envConfig.TRULIOO_INITFLOW_API;
		this.submitApi = envConfig.TRULIOO_SUBMIT_API;
		this.retrieveApi = envConfig.TRULIOO_RETRIEVE_API;
		this.flowType = TruliooFlows.KYB; // Default, will be set by implementations

		// Validate flow IDs with meaningful defaults
		this.kybFlowId = envConfig.TRULIOO_KYB_FLOWID || "kyb-flow";
		this.pscFlowId = envConfig.TRULIOO_PSC_FLOWID || "psc-screening-flow";

		if (!businessID) {
			throw new Error("Business ID is required for Trulioo operations");
		}
		this.businessID = businessID;
	}

	// Abstract methods that must be implemented by concrete classes
	abstract getIntegrationId(): number;
	abstract getFlowType(): string;

	// Getter for business ID
	getBusinessId(): string {
		return this.businessID;
	}

	// Getter for KYB flow ID
	getKybFlowId(): string {
		return this.kybFlowId;
	}

	// Getter for PSC flow ID
	getPscFlowId(): string {
		return this.pscFlowId;
	}

	/**
	 * Controlled API call method using the refactored modules
	 * @param apiCall - The API call function to execute
	 * @param context - Context information for logging
	 * @returns Promise with controlled error handling
	 */
	protected async callWithErrorControl<T>(
		apiCall: () => Promise<T>,
		context: { operation: string; businessID?: string; details?: unknown; useFallback?: boolean; noRetry?: boolean }
	): Promise<T> {
		try {
			// Respect noRetry flag by bypassing the retry manager if set
			const result = context.noRetry
				? await apiCall()
				: await TruliooRetryManager.retryWithBackoff(apiCall, context);

			return result;
		} catch (error: unknown) {
			// Log the error with structured logging
			logger.error(
				{
					error,
					businessID: context.businessID || this.businessID,
					operation: context.operation,
					details: context.details
				},
				`Error in Trulioo ${context.operation}`
			);

			// Attempt recovery for certain types of errors
			if (error instanceof Error && TruliooRetryManager.isRetryableError(error)) {
				logger.info(`Attempting recovery for recoverable error in Trulioo ${context.operation}`);
				const recoverySuccessful = await TruliooErrorHandler.attemptRecovery(error, context);

				if (recoverySuccessful) {
					logger.info(`Recovery successful for Trulioo ${context.operation}, retrying operation`);
					// Retry the operation once after successful recovery
					try {
						const result = await TruliooRetryManager.retryWithBackoff(apiCall, context);
						return result;
					} catch (retryError: unknown) {
						logger.error(retryError, `Retry after recovery failed for Trulioo ${context.operation}:`);
						// Fall through to error handling
					}
				}
			}

			// Perform rollback for any partial operations
			await TruliooErrorHandler.rollbackOperations(context);

			// If fallback is enabled and it's a service unavailable error, return fallback
			if (context.useFallback && error instanceof Error && TruliooRetryManager.isRetryableError(error)) {
				return TruliooErrorHandler.getFallbackResponse(context.operation) as T;
			}

			// Convert to controlled error
			throw TruliooErrorHandler.convertToControlledError(error, context);
		}
	}

	/**
	 * Request a new OAuth token from Trulioo
	 * @returns OAuth token response
	 */
	protected async requestNewToken() {
		return TruliooTokenManager.requestNewToken();
	}

	/**
	 * Get access token, requesting new one if needed
	 * @returns Access token string
	 */
	protected async getAccessToken(): Promise<string> {
		return TruliooTokenManager.getAccessToken();
	}

	/**
	 * Get flow configuration from Trulioo
	 * @param params Flow parameters including flowId
	 * @returns Flow data and session information
	 */
	protected async getFlow(params: FlowParams): Promise<{ data: { elements: FlowElement[] }; hfSession: string }> {
		return this.callWithErrorControl(
			async () => {
				const url = `${this.initFlowApi}/${params.flowId}`;
				const accessToken = await TruliooTokenManager.getAccessToken();
				const response = await TruliooHttpClient.get(url, {
					Authorization: `Bearer ${accessToken}`
				});
				const data = response.data;
				const hfSession = response.headers["x-hf-session"] || "";

				if (!hfSession) logger.warn("No x-hf-session header found in flow response.");

				return { data, hfSession };
			},
			{
				operation: "getFlow",
				businessID: this.businessID,
				details: { flowId: params.flowId }
			}
		);
	}

	/**
	 * Submit flow data directly to Trulioo without retries.
	 * This prevents creating multiple transactions in case of timeout.
	 */
	protected async submitDirectly(
		params: FlowParams & { hfSession: string; payload: Partial<TruliooKYBFormData | TruliooPSCFormData> }
	) {
		return this.callWithErrorControl(
			async () => {
				const url = `${this.submitApi}/${params.flowId}`;
				const accessToken = await TruliooTokenManager.getAccessToken();
				const response = await TruliooHttpClient.post(url, params.payload, {
					Authorization: `Bearer ${accessToken}`,
					"x-hf-session": params.hfSession
				});
				return response.data;
			},
			{
				operation: "submitDirectly",
				businessID: this.businessID,
				details: { flowId: params.flowId, hfSession: params.hfSession },
				noRetry: true // ATOMIC: Prevent retry on POST to avoid duplicate transactions
			}
		);
	}

	/**
	 * Submit flow data to Trulioo
	 * @param params Flow parameters including flowId, hfSession, and payload
	 * @returns Submit response
	 */
	protected async submitFlow(
		params: FlowParams & { hfSession: string; payload: Partial<TruliooKYBFormData | TruliooPSCFormData> }
	) {
		return this.submitDirectly(params);
	}

	/**
	 * Get client data from Trulioo using session
	 * @param params Parameters including hfSession
	 * @returns Client data response
	 */
	protected async getClientData(params: { hfSession: string; queryParams?: Record<string, string> }) {
		return this.callWithErrorControl(
			async () => {
				let url = `${this.retrieveApi}/${params.hfSession}`;

				// Add query parameters if provided
				if (params.queryParams && Object.keys(params.queryParams).length > 0) {
					const queryString = new URLSearchParams(params.queryParams).toString();
					url = `${url}?${queryString}`;
				}

				const accessToken = await TruliooTokenManager.getAccessToken();
				const response = await TruliooHttpClient.get(url, {
					Authorization: `Bearer ${accessToken}`
				});

				// Log the complete Trulioo response for debugging
				logger.info({
					businessID: this.businessID,
					hfSession: params.hfSession,
					queryParams: params.queryParams,
					url: url,
					response: response.data
				}, `📊 Complete Trulioo Response for business ${this.businessID}`);

				return response.data;
			},
			{
				operation: "getClientData",
				businessID: this.businessID,
				details: { hfSession: params.hfSession, queryParams: params.queryParams }
			}
		);
	}

	/**
	 * Get transaction record from Trulioo traditional API
	 * This endpoint may provide detailed watchlist information with individual hits and URLs
	 * @param transactionRecordID Transaction record ID (may be hfSession or TransactionRecordID)
	 * @returns Transaction record response with potential WatchlistHitDetails
	 */
	protected async getTransactionRecord(transactionRecordID: string) {
		return this.callWithErrorControl(
			async () => {
				// Try the traditional API endpoint: /v3/transactions/{TransactionRecordID}
				const url = `https://api.trulioo.com/v3/transactions/${transactionRecordID}`;
				const accessToken = await TruliooTokenManager.getAccessToken();

				logger.info({
					businessID: this.businessID,
					transactionRecordID,
					url
				}, `🔍 Attempting to get transaction record from traditional API`);

				const response = await TruliooHttpClient.get(url, {
					Authorization: `Bearer ${accessToken}`
				});

				// Log the complete response for analysis
				logger.info({
					businessID: this.businessID,
					transactionRecordID,
					hasWatchlistHitDetails: !!response.data?.Record?.DatasourceResults?.some(
						(ds: any) => ds.AppendedFields?.some(
							(field: any) => field.FieldName === "WatchlistHitDetails"
						)
					),
					response: response.data
				}, `📊 Transaction Record Response for business ${this.businessID}`);

				return response.data;
			},
			{
				operation: "getTransactionRecord",
				businessID: this.businessID,
				details: { transactionRecordID }
			}
		);
	}

	/**
	 * Map form data elements by ID for Trulioo flow submission
	 * @param flowData Flow elements from Trulioo
	 * @param truliooFormData Form data to map
	 * @returns Mapped form data
	 */
	protected mapElementsById(
		flowData: FlowElement[],
		truliooFormData: Partial<TruliooKYBFormData | TruliooPSCFormData>
	): Record<string, unknown> {
		const result: Record<string, unknown> = {};

		logger.info(`Flow elements received: ${JSON.stringify(flowData, null, 2)}`);
		logger.info(`Form data to map: ${JSON.stringify(truliooFormData, null, 2)}`);

		// Map Trulioo's internal field names (keys) to our internal field names (values)
		// This mapping converts Trulioo's snake_case field names to our camelCase field names
		const truliooFieldToInternalFieldMap: Record<string, string> = {
			company_name: "companyName", // Trulioo: company_name -> Internal: companyName
			company_nr: "companyregno", // Trulioo: company_nr -> Internal: companyregno
			company_email: "companyEmail", // Trulioo: company_email -> Internal: companyEmail
			company_vat: "companyVat", // Trulioo: company_vat -> Internal: companyVat
			company_country_incorporation: "companyCountryIncorporation", // Trulioo: company_country_incorporation -> Internal: companyCountryIncorporation
			company_state: "companyState", // Trulioo: company_state -> Internal: companyState
			company_state_address: "companyStateAddress", // Trulioo: company_state_address -> Internal: companyStateAddress
			company_city: "companyCity", // Trulioo: company_city -> Internal: companyCity
			company_zip: "companyZip", // Trulioo: company_zip -> Internal: companyZip
			company_address_full: "companyAddressFull", // Trulioo: company_address_full -> Internal: companyAddressFull
			// Person-specific fields for PSC screening
			first_name: "personFirstName",
			last_name: "personLastName",
			full_name: "personName",
			date_of_birth: "personDateOfBirth",
			dob: "personDateOfBirth", // Alternative role name for date of birth
			address_line_1: "personAddress",
			city: "personCity",
			postal_code: "personPostalCode",
			country: "personCountry",
			address_country: "personCountry", // Alternative role name for country
			email: "personEmail",
			phone: "personPhone",
			title: "personTitle",
			nationality: "personNationality",
			passport_number: "personPassportNumber",
			national_id: "personNationalId",
			national_id_nr: "personNationalId" // Alternative role name for national ID
		};

		flowData.forEach(el => {
			// Map Trulioo's role field to our internal field name
			const formDataKey = truliooFieldToInternalFieldMap[el.role];
			if (formDataKey && formDataKey in truliooFormData) {
				const value = truliooFormData[formDataKey as keyof typeof truliooFormData];

				// Resolve field value with fallbacks for required fields
				const resolvedValue = resolveRequiredFieldValue(el, formDataKey, value as string | undefined, truliooFormData);

				// Check if field is required
				const validations = el.validations as Array<{ type: string }> | undefined;
				const isRequired = validations?.some((v) => v.type === "required") ?? false;

				// Determine if value should be included in payload
				if (shouldIncludeFieldValue(resolvedValue, isRequired)) {
					result[el.id] = resolvedValue!.value;

					if (resolvedValue!.usedFallback) {
						logger.info(
							`Mapped ${el.role} (${el.id}) -> ${formDataKey}: ${resolvedValue!.value} (${resolvedValue!.fallbackReason})`
						);
					} else if (isRequired && resolvedValue!.value === "") {
						logger.warn(
							`Including empty value for required field ${el.role} (${el.id}) -> ${formDataKey} (may cause validation error)`
						);
					} else {
						logger.info(`Mapped ${el.role} (${el.id}) -> ${formDataKey}: ${resolvedValue!.value}`);
					}
				} else {
					logger.info(`Skipping empty value for ${el.role} (${el.id}) -> ${formDataKey}`);
				}
			} else {
				logger.warn(`No mapping found for element role: ${el.role} (id: ${el.id})`);
			}
		});

		logger.info(`Final mapped result: ${JSON.stringify(result, null, 2)}`);
		return result;
	}

	/**
	 * Run complete verification flow
	 * @param flowId Flow ID to run
	 * @param formData Form data for the flow
	 * @returns Flow result with session and data
	 */
	public async runVerificationFlow(flowId: string, formData: Partial<TruliooKYBFormData | TruliooPSCFormData>) {
		try {
			logger.info(`Starting Trulioo verification flow: ${flowId}`);
			const { data: flowData, hfSession } = await this.getFlow({ flowId });

			if (!hfSession) {
				throw new VerificationApiError(
					"No session returned from Trulioo flow initialization",
					StatusCodes.BAD_REQUEST,
					ERROR_CODES.INVALID
				);
			}

			const mappedFormData = this.mapElementsById(flowData.elements || [], formData);
			const submitResponse = await this.submitFlow({ flowId, hfSession, payload: mappedFormData });
			// Use includeFullServiceDetails to get detailed watchlist information
			const rawClientData = await this.getClientData({
				hfSession,
				queryParams: { includeFullServiceDetails: "true" }
			});

			// Log watchlist hits if detected
			this.logWatchlistHitsIfPresent(rawClientData);

			// Extract watchlist results from the response
			const watchlistResults = this.extractWatchlistResults(rawClientData);

			// Build clientData structure with extracted watchlist results
			const clientData = {
				...rawClientData,
				watchlistResults
			};

			return {
				hfSession,
				flowData,
				submitResponse,
				clientData
			};
		} catch (error: unknown) {
			logger.error(error, `Error in Trulioo verification flow ${flowId}:`);
			throw TruliooErrorHandler.convertToControlledError(error, {
				operation: "runVerificationFlow",
				businessID: this.businessID
			});
		}
	}

	/**
	 * Log watchlist hits if detected in the response
	 * Note: Detailed watchlist hit structure is not available in synchronous response
	 * Full extraction will be implemented in webhook handlers (Phase 2)
	 */
	private logWatchlistHitsIfPresent(rawClientData: any): void {
		if (!rawClientData?.flowData) {
			return;
		}

		const flowDataItems = Object.values(rawClientData.flowData) as any[];
		for (const flowDataItem of flowDataItems) {
			if (!flowDataItem?.serviceData || !Array.isArray(flowDataItem.serviceData)) {
				continue;
			}

			// Find watchlist node - support both business (KYB) and person (PSC) watchlist types
			const watchlistNode = flowDataItem.serviceData.find((item: any) => {
				const nodeType = toShortNodeType(item?.nodeType);
				return (
					(nodeType === "business_wl" ||
						nodeType === "kyb_wl" ||
						nodeType === "person_wl") &&
					item.watchlistResults
				);
			});

			if (!watchlistNode?.watchlistResults) {
				continue;
			}

			this.logWatchlistHitsFromData(watchlistNode.watchlistResults);
		}
	}

	/**
	 * Log watchlist hits from watchlist data structure
	 */
	private logWatchlistHitsFromData(watchlistData: Record<string, any>): void {
		const watchlistNames = Object.keys(watchlistData);
		for (const watchlistName of watchlistNames) {
			const watchlistInfo = watchlistData[watchlistName];
			const hits = watchlistInfo?.watchlistHitDetails;

			if (!hits) {
				continue;
			}

			const hasHits = hits.wlHitsNumber > 0 || hits.amHitsNumber > 0 || hits.pepHitsNumber > 0;
			if (hasHits) {
				logger.info(
					{
						watchlistName,
						wlHits: hits.wlHitsNumber,
						amHits: hits.amHitsNumber,
						pepHits: hits.pepHitsNumber
					},
					`⚠️  Watchlist "${watchlistName}" has hits but detailed structure not available in this response`
				);
			}
		}
	}

	/**
	 * Extract watchlist results from Trulioo response flowData
	 * Transforms Trulioo's watchlist structure into TruliooWatchlistHit[] format
	 * @param rawClientData - Raw client data from Trulioo response
	 * @returns Array of watchlist hits or undefined if no watchlist data found
	 */
	public extractWatchlistResults(rawClientData: any): TruliooWatchlistHit[] | undefined {
		if (!rawClientData?.flowData) {
			return undefined;
		}

		const flowDataItems = Object.values(rawClientData.flowData) as any[];
		for (const flowDataItem of flowDataItems) {
			if (!flowDataItem?.serviceData || !Array.isArray(flowDataItem.serviceData)) {
				continue;
			}

			// Find watchlist node - support both business (KYB) and person (PSC) watchlist types
			const watchlistNode = flowDataItem.serviceData.find((item: any) => {
				const nodeType = toShortNodeType(item?.nodeType);
				return (
					(nodeType === "business_wl" ||
						nodeType === "kyb_wl" ||
						nodeType === "person_wl") &&
					item.watchlistResults
				);
			});

			if (!watchlistNode?.watchlistResults) {
				continue;
			}

			// Use utility function to extract watchlist results (consolidates logic)
			const { extractWatchlistResultsFromTruliooResponse } = require("./utils");
			const extracted = extractWatchlistResultsFromTruliooResponse({ flowData: { [flowDataItem.serviceData.indexOf(watchlistNode)]: flowDataItem } });
			if (extracted && extracted.length > 0) {
				return extracted;
			}
		}

		return undefined;
	}

	/**
	 * Map source region to country name for display
	 * @param sourceRegion - Source region from Trulioo (e.g., "North America", "Europe")
	 * @returns Country name or undefined
	 */
	private mapRegionToCountry(sourceRegion?: string): string | undefined {
		if (!sourceRegion) return undefined;

		const regionMap: Record<string, string> = {
			"North America": "United States of America",
			"United States": "United States of America",
			"Europe": "Europe",
			"European Union": "European Union",
			"Asia": "Asia",
			"South America": "South America",
			"Africa": "Africa",
			"Oceania": "Oceania"
		};

		return regionMap[sourceRegion] || sourceRegion;
	}

	/**
	 * Determine list type from watchlist data context
	 * @param watchlistData - Watchlist data object
	 * @returns List type
	 */
	private determineListTypeFromContext(watchlistData: any): "PEP" | "SANCTIONS" | "ADVERSE_MEDIA" | "OTHER" {
		const listName = (watchlistData.listName || "").toLowerCase();
		const watchlistStatus = (watchlistData.watchlistStatus || "").toLowerCase();

		if (listName.includes("pep") || listName.includes("politically exposed")) {
			return "PEP";
		}
		if (listName.includes("adverse") || listName.includes("media")) {
			return "ADVERSE_MEDIA";
		}
		if (listName.includes("sanction") || listName.includes("ofac") || listName.includes("sdn")) {
			return "SANCTIONS";
		}

		// Default to SANCTIONS for watchlist hits
		return "SANCTIONS";
	}

	// Expose utility methods from the refactored modules
}
