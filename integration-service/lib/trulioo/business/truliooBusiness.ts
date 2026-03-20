import { TruliooBase } from "../common/truliooBase";
import { BusinessEntityVerificationService as BusinessEntityVerification } from "#api/v1/modules/verification/businessEntityVerification";
import type { IDBConnection, IBusinessIntegrationTaskEnriched } from "#types/db";
import { INTEGRATION_ID } from "#constants";
import {
	TruliooFlows,
	TruliooKYBFormData,
	TruliooPSCFormData,
	TaskUpdateData,
	TruliooFlowResult,
	TruliooBusinessData,
	TruliooDirector
} from "../common/types";
import { TaskHandlerMap } from "#api/v1/modules/tasks/taskManager";
import { TruliooBusinessTaskHandler } from "./truliooBusinessTaskHandler";
import { TruliooBusinessKYBProcessor } from "./truliooBusinessKYBProcessor";
import { TruliooBusinessResultsStorage } from "./truliooBusinessResultsStorage";
import { TruliooUBOExtractor } from "./truliooUBOExtractor";
import { TruliooTokenManager } from "../common/truliooTokenManager";
import { getBusinessDetails, getBusinessCustomers, getCustomerCountries, type BusinessDetails } from "#helpers/api";
import { logger } from "#helpers/logger";
import { VerificationApiError } from "#api/v1/modules/verification/error";
import { StatusCodes } from "http-status-codes";
import { ERROR_CODES } from "#constants";
import type { UUID } from "crypto";
import { isTruliooCompletedStatus } from "../common/utils";
import { shouldScreenPSCsForBusiness } from "../common/pscScreeningHelpers";
import { customerIntegrationSettings } from "#api/v1/modules/customer-integration-settings/customer-integration-settings";

/**
 * Trulioo Business Verification Implementation
 * Extends BusinessEntityVerification for business entity verification (KYB flows)
 * Uses composition pattern with modular components for better maintainability
 */
export class TruliooBusiness extends BusinessEntityVerification {
	public readonly MIN_INDEX = 45;
	protected static readonly PLATFORM_ID = INTEGRATION_ID.TRULIOO;

	private truliooBase: TruliooBase;
	private taskHandler: TruliooBusinessTaskHandler;
	private kybProcessor: TruliooBusinessKYBProcessor;
	private resultsStorage: TruliooBusinessResultsStorage;
	private uboExtractor: TruliooUBOExtractor;

	// Task handler map for business entity verification
	taskHandlerMap: TaskHandlerMap;

	constructor(businessID: string, dbConnection?: IDBConnection) {
		super(dbConnection);

		// Create a concrete implementation for internal use
		this.truliooBase = new (class extends TruliooBase {
			getIntegrationId(): number {
				return INTEGRATION_ID.TRULIOO;
			}
			getFlowType(): string {
				return TruliooFlows.KYB;
			}
		})(businessID);

		// Initialize modular components
		this.uboExtractor = new TruliooUBOExtractor(this.truliooBase);
		this.resultsStorage = new TruliooBusinessResultsStorage(this.truliooBase, this.uboExtractor);
		this.kybProcessor = new TruliooBusinessKYBProcessor(this.truliooBase, this.resultsStorage, this.uboExtractor);
		this.taskHandler = new TruliooBusinessTaskHandler(this.truliooBase, this.kybProcessor);

		// Initialize task handler map with canIRun check
		this.taskHandlerMap = {
			fetch_business_entity_verification: async (taskId: string) => {
				// Check if this integration should run (KYB flow)
				const shouldRunKYB = await TruliooBusiness.canIRun(this.truliooBase["businessID"] as UUID);

				if (shouldRunKYB) {
					return this.handleKYBTask(taskId);
				}

				return this.handleUSAutomaticPSCScreening(taskId);
			}
		};
	}

	/**
	 * Handles the normal KYB task flow (non-US countries)
	 * @param taskId - Integration task ID
	 */
	private async handleKYBTask(taskId: string): Promise<boolean> {
		const handlerMap = this.taskHandler.createTaskHandlerMap(async (id: string, data: TaskUpdateData) => {
			await this.updateTask(id, data);
		});
		return handlerMap?.fetch_business_entity_verification?.(taskId as UUID) ?? true;
	}

	/**
	 * Handles automatic PSC screening for US businesses where KYB is skipped
	 * @param taskId - Integration task ID
	 */
	private async handleUSAutomaticPSCScreening(taskId: string): Promise<boolean> {
		logger.info(
			`Trulioo KYB integration skipped for business ${this.truliooBase["businessID"]} - canIRun returned false`
		);

		try {
			const businessDetails = await getBusinessDetails(this.truliooBase["businessID"] as UUID);
			if (businessDetails.status !== "success" || !businessDetails.data) {
				logger.warn(
					{ businessId: this.truliooBase["businessID"] },
					"Could not retrieve business details for automatic PSC screening check"
				);
				await this.skipTask(taskId);
				return true;
			}

			const country = businessDetails.data.address_country || "US";
			const isUS = ["US", "USA"].includes(country.toUpperCase().trim());

			if (!isUS) {
				await this.skipTask(taskId);
				return true;
			}

			const { shouldScreen } = await shouldScreenPSCsForBusiness(this.truliooBase.getBusinessId() as UUID, country);

			if (!shouldScreen) {
				logger.info(`Automatic US PSC screening not required for business ${this.truliooBase["businessID"]}`);
				await this.skipTask(taskId);
				return true;
			}

			// Create a placeholder BEV record so PSC results have a parent
			const businessName = businessDetails.data.name || "US Business";
			const hfSession = `US-AUTO-${taskId}`;

			await this.resultsStorage.storeInitialVerificationRecord(
				taskId,
				{
					companyName: businessName,
					companyCountryIncorporation: country,
					companyStateAddress: "",
					companyZip: ""
				},
				hfSession
			);

			const { generateDeterministicUUID } = await import("../common/utils");
			const uuidFormattedExternalId = generateDeterministicUUID(hfSession);
			const { db } = await import("#helpers/knex");
			const verificationRecord = await db("integration_data.business_entity_verification")
				.where({ external_id: uuidFormattedExternalId })
				.select("id")
				.first();

			if (!verificationRecord?.id) {
				throw new Error(`Failed to create/find placeholder verification record for US business ${this.truliooBase["businessID"]}`);
			}

			// Enqueue PSC screening as a deferrable task that waits for Middesk to complete.
			// This uses the DeferrableTaskManager pattern instead of coupling directly
			// to the Middesk webhook handler.
			const { TruliooPSCScreening } = await import("./truliooPSCScreening");
			await TruliooPSCScreening.enqueueForBusiness(
				this.truliooBase["businessID"] as UUID,
				verificationRecord.id,
				taskId
			);

			await this.updateTask(taskId, {
				metadata: {
					status: "skipped",
					reason: "KYB integration not needed, US PSC screening enqueued as deferrable task (waits for Middesk)"
				}
			});
		} catch (error) {
			logger.error(error, `Error in automatic US PSC screening for business ${this.truliooBase["businessID"]}`);
			await this.skipTask(taskId, "KYB skipped, PSC screening failed to enqueue");
		}

		return true;
	}

	/**
	 * Utility to mark task as skipped with a reason
	 */
	private async skipTask(taskId: string, reason = "KYB integration not needed, PSC screening triggered if applicable"): Promise<void> {
		await this.updateTask(taskId, {
			metadata: {
				status: "skipped",
				reason
			}
		});
	}

	/**
	 * Override canIRun to implement Trulioo-specific routing logic.
	 * Checks if Trulioo is enabled for the customer and if the business country is in the enabled countries list.
	 *
	 * Logic:
	 * 1. Get business country (default to 'US' if not provided)
	 * 2. Get customer ID from business ID
	 * 3. Check if Trulioo integration is enabled for the customer
	 * 4. Get enabled countries for the customer (setup ID 7 = international business)
	 * 5. Run only if Trulioo is enabled and the business country is in the enabled countries list
	 */
	public static async canIRun(businessId: UUID): Promise<boolean> {
		// Retry logic for resilience against temporary network errors
		const MAX_RETRIES = 3;
		const RETRY_DELAY_MS = 3000; // 3 seconds

		let lastError: Error | null = null;
		for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
			try {
				return await TruliooBusiness.canIRunInternal(businessId);
			} catch (error) {
				lastError = error instanceof Error ? error : new Error(String(error));
				if (attempt < MAX_RETRIES) {
					logger.warn(
						{ businessId, attempt, maxRetries: MAX_RETRIES, error: lastError.message },
						`canIRun attempt ${attempt} failed, retrying in ${RETRY_DELAY_MS}ms...`
					);
					await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
				}
			}
		}

		logger.error(lastError, `canIRun failed after ${MAX_RETRIES} attempts for business ${businessId} - defaulting to skip`);
		return false;
	}

	/**
	 * Internal implementation of canIRun logic (separated for retry wrapper)
	 */
	private static async canIRunInternal(businessId: UUID): Promise<boolean> {
		try {
			const businessDetails = await getBusinessDetails(businessId);
			logger.debug(`Trulioo canIRun entered status: ${JSON.stringify(businessDetails.status)}`);
			if (businessDetails.status === "success" && businessDetails.data) {
				const country = businessDetails.data.address_country;
				logger.debug(`Trulioo canIRun country: ${country}`);
				// Default to US if country is not provided
				const normalizedCountry = country || "US";
				logger.debug(`Trulioo canIRun normalizedCountry country: ${normalizedCountry}`);
				// Always skip Trulioo for US businesses, regardless of customer configuration
				const isUS = !!country && ["US", "USA"].includes(country.toUpperCase().trim());
				logger.debug(`Trulioo canIRun isUS: ${isUS}`);
				if (isUS) {
					logger.debug(
						{
							businessId,
							country: normalizedCountry,
							reason: "US businesses should use Middesk, not Trulioo"
						},
						"Trulioo skipped - US business"
					);
					return false;
				}

				// Get customer ID from business
				const businessCustomers = await getBusinessCustomers(businessId);
				const customerId = businessCustomers?.customer_ids?.[0];
				logger.debug(`Trulioo canIRun customerId: ${customerId}`);
				if (!customerId) {
					logger.warn({ businessId }, "Could not determine customer ID for business - defaulting to skip");
					return false;
				}

				// Check if Trulioo is enabled for the customer
				const integrationStatus = await customerIntegrationSettings.getIntegrationStatusForCustomer(customerId);
				const truliooStatus = integrationStatus.find((item: any) => item.integration_code === "trulioo");
				logger.debug(`Trulioo canIRun truliooStatus: ${JSON.stringify(truliooStatus)}`);
				if (!truliooStatus || truliooStatus.status !== "ENABLED") {
					logger.debug(
						{
							businessId,
							customerId,
							country: normalizedCountry,
							truliooEnabled: false,
							platform: "TRULIOO"
						},
						"Trulioo is not enabled for customer - skipping"
					);
					return false;
				}

				// Get enabled countries for international business setup (setup ID 7)
				// If we can't check countries or no countries are enabled, skip Trulioo (fail-closed approach)
				const INTERNATIONAL_BUSINESS_SETUP_ID = 7;
				let enabledCountries: string[] = [];

				try {
					// Try to get countries from case-service DB via helper
					const customerCountries = await getCustomerCountries(customerId as string, INTERNATIONAL_BUSINESS_SETUP_ID);
					enabledCountries = (customerCountries || [])
						.filter((c: any) => c.is_selected || c.is_enabled)
						.map((c: any) => c.jurisdiction_code?.toUpperCase())
						.filter((code: string) => code); // Remove any undefined/null values
					logger.debug(`Trulioo canIRun enabledCountries: ${JSON.stringify(enabledCountries)}`);
				} catch (error) {
					// If we can't check countries, default to skip (fail-closed approach)
					// This ensures Trulioo only runs when we can verify the country is enabled
					logger.warn(
						{
							businessId,
							customerId,
							country: normalizedCountry,
							error: error instanceof Error ? error.message : "Unknown error"
						},
						"Could not check enabled countries - defaulting to skip"
					);
					enabledCountries = []; // Empty array means skip
				}

				// If no countries are enabled (International Business toggle disabled or no countries selected), skip
				logger.debug(`Trulioo canIRun enabledCountries2: ${JSON.stringify(enabledCountries)}`);
				if (enabledCountries.length === 0) {
					logger.debug(
						{
							businessId,
							customerId,
							country: normalizedCountry,
							truliooEnabled: true,
							reason: "No enabled countries found - International Business may be disabled or no countries selected"
						},
						"Trulioo skipped - no enabled countries"
					);
					return false;
				}

				// Normalize enabled countries to handle GB/UK equivalence
				// The system may return "UK" but businesses use "GB" (ISO code)
				const normalizedEnabledCountries = enabledCountries.map((code: string) => {
					const upperCode = code.toUpperCase();
					// Map "UK" to "GB" for consistent comparison
					return upperCode === "UK" ? "GB" : upperCode;
				});

				// Normalize business country to handle GB/UK equivalence
				// Convert "UK" to "GB" for consistent comparison
				const normalizedBusinessCountry = normalizedCountry.toUpperCase();
				const normalizedBusinessCountryForComparison = normalizedBusinessCountry === "UK" ? "GB" : normalizedBusinessCountry;

				// Check if the business country is in the enabled countries list
				const shouldRun = normalizedEnabledCountries.includes(normalizedBusinessCountryForComparison);
				logger.debug(`Trulioo canIRun shouldRun: ${JSON.stringify(shouldRun)}`);
				logger.debug(`Trulioo canIRun normalizedEnabledCountries: ${JSON.stringify(normalizedEnabledCountries)}`);
				logger.debug(
					{
						businessId,
						customerId,
						country: normalizedCountry,
						enabledCountries,
						truliooEnabled: true,
						shouldRun,
						platform: "TRULIOO"
					},
					"canIRun decision for Trulioo"
				);

				return shouldRun;
			}

		// If we can't determine business details, default to false (skip)
			logger.warn({ businessId }, "Could not determine business details for canIRun - defaulting to skip");
			return false;
		} catch (error) {
			// Re-throw error so retry wrapper can handle it
			throw error;
		}
	}

	// Implement abstract methods from TruliooBase
	getIntegrationId(): number {
		return INTEGRATION_ID.TRULIOO;
	}

	getFlowType(): string {
		return TruliooFlows.KYB;
	}

	// Expose shared Trulioo methods for external use
	public async runVerificationFlow(flowId: string, formData: Partial<TruliooKYBFormData | TruliooPSCFormData>) {
		return this.truliooBase.runVerificationFlow(flowId, formData);
	}

	public async getFlow(params: { flowId: string }) {
		return this.truliooBase["getFlow"](params);
	}

	public async submitFlow(params: {
		flowId: string;
		hfSession: string;
		payload: TruliooKYBFormData | TruliooPSCFormData;
	}) {
		return this.truliooBase["submitFlow"](params);
	}

	public async getClientData(params: { hfSession: string; queryParams?: Record<string, string> }) {
		return this.truliooBase["getClientData"](params);
	}


	/**
	 * Extract and trigger PSC screening for UBOs/Directors
	 * This is typically called after KYB verification completes
	 * @param businessEntityVerificationId - Internal verification ID
	 * @param clientData - Trulioo client data response (raw)
	 * @param flowResult - Trulioo flow result
	 * @param taskId - Optional task ID from KYB verification to propagate to PSC records
	 */
	public async triggerPSCScreening(
		businessEntityVerificationId: string,
		clientData: any,
		flowResult: TruliooFlowResult,
		taskId?: string
	): Promise<void> {
		logger.info(`Triggering PSC screening for business entity verification: ${businessEntityVerificationId}`);

		let dbBusinessData: BusinessDetails | undefined = undefined;
		let primaryAddress: BusinessDetails["business_addresses"][number] | undefined = undefined;
		try {
			const businessDetails = await getBusinessDetails(this.truliooBase["businessID"] as UUID);
			dbBusinessData = businessDetails.status === "success" ? businessDetails.data : undefined;
			primaryAddress =
				dbBusinessData?.business_addresses?.find(addr => addr.is_primary) ||
				dbBusinessData?.business_addresses?.[0];
		} catch (error) {
			logger.warn(
				{
					businessId: this.truliooBase["businessID"],
					error: error instanceof Error ? error.message : String(error)
				},
				"Failed to fetch business details from case-service, continuing with Trulioo response data only"
			);
		}

		const truliooBusinessData = clientData?.businessData;
		const businessName = truliooBusinessData?.name || dbBusinessData?.name || "";
		const businessCountry = truliooBusinessData?.country || primaryAddress?.country || dbBusinessData?.address_country || "";
		const businessCity = truliooBusinessData?.city || primaryAddress?.city || "";
		const businessZip = truliooBusinessData?.postalCode || primaryAddress?.postal_code || "";
		const businessState = truliooBusinessData?.state || primaryAddress?.state || "";

		// Check if PSC screening should be performed based on customer settings and territory
		const { shouldScreen, reason } = await shouldScreenPSCsForBusiness(
			this.truliooBase.getBusinessId() as UUID,
			businessCountry
		);

		if (!shouldScreen) {
			logger.info(
				{
					businessId: this.truliooBase["businessID"],
					businessEntityVerificationId,
					country: businessCountry,
					reason
				},
				"Skipping PSC screening based on customer settings and territory"
			);
			return;
		}

		// Determine if Advanced Watchlists is enabled for US businesses
		const isUS = businessCountry?.toUpperCase().trim() === "US" || businessCountry?.toUpperCase().trim() === "USA";
		let advancedWatchlistsEnabled = false;
		if (isUS && shouldScreen) {
			// If we reached here for a US business, Advanced Watchlists must be enabled
			// (shouldScreenPSCsForBusiness already verified this)
			advancedWatchlistsEnabled = true;
		}

		// Extract directors/officers based on flow type (Advanced Watchlists vs Standard Flow)
		const { extractDirectorsForPSCScreening } = await import("./directorsExtractionHelpers");
		const directors = await extractDirectorsForPSCScreening({
			clientData,
			businessData: truliooBusinessData,
			businessState,
			advancedWatchlistsEnabled
		});

		const businessData: TruliooBusinessData = {
			...clientData.businessData,
			directors: directors && directors.length > 0 ? directors : undefined,
			// Keep ubos as-is (explicitly returned by Trulioo)
			name: businessName,
			country: businessCountry,
			state: businessState,
			city: businessCity,
			postalCode: businessZip
		};

		// Screen UBOs/Directors using enriched businessData
		// Pass taskId so PSC verification records can inherit the KYB task
		// Pass advancedWatchlistsEnabled flag to indicate if additional owners should be fetched
		const screenedPeople = await this.uboExtractor.extractAndScreenUBOsDirectors(
			businessEntityVerificationId,
			businessData,
			flowResult,
			taskId,
			advancedWatchlistsEnabled
		);
		logger.info(`PSC screening completed with ${screenedPeople.length} people screened`);
	}

	/**
	 * Process webhook "done" event
	 * Retrieves profile data using transactionId and stores the verification results
	 * @param transactionId - Trulioo transaction ID from webhook
	 * @returns Promise<void>
	 */
	public async processWebhookDoneEvent(transactionId: string): Promise<void> {
		logger.info(
			`Processing Trulioo webhook "done" event for business: ${this.truliooBase["businessID"]}, transaction: ${transactionId}`
		);

		// Retrieve profile data using transactionId as hfSession with includeFullServiceDetails for detailed watchlist info
		const rawClientData = await this.getClientData({
			hfSession: transactionId,
			queryParams: { includeFullServiceDetails: "true" }
		});

		logger.info(
			`Successfully retrieved Trulioo profile data for business: ${this.truliooBase["businessID"]}, transaction: ${transactionId}`
		);

		// Extract watchlist results from the response
		const watchlistResults = this.truliooBase.extractWatchlistResults(rawClientData);

		// Build clientData with extracted watchlist results
		const clientData = {
			...rawClientData,
			watchlistResults
		};

		// Verify that clientData.businessData is present for UBO extraction
		const isCompletedStatus = isTruliooCompletedStatus(clientData?.status);

		if (isCompletedStatus) {
			if (!clientData.businessData) {
				logger.warn(
					`Trulioo clientData missing businessData for completed transaction: ${transactionId}. UBO extraction will be skipped.`
				);
			}
		}

		// Get business details to create payload for storage
		const businessDetails = await getBusinessDetails(this.truliooBase["businessID"] as UUID);
		if (businessDetails.status !== "success" || !businessDetails.data) {
			const errorMessage = `Could not retrieve business details for storing Trulioo results for business: ${this.truliooBase["businessID"]}, transaction: ${transactionId}`;
			logger.error(errorMessage);
			throw new VerificationApiError(errorMessage, StatusCodes.INTERNAL_SERVER_ERROR, ERROR_CODES.INVALID);
		}

		// Extract business address from nested structure or flat fields (from getBusinessDetails)
		const primaryAddress =
			businessDetails.data.business_addresses?.find((addr: any) => addr.is_primary) ||
			businessDetails.data.business_addresses?.[0];

		// Prefer business data from Trulioo clientData if available, otherwise use our database
		// This ensures we use the most up-to-date information from Trulioo's verification
		const truliooBusinessData = clientData?.businessData;
		const businessName = truliooBusinessData?.name || businessDetails.data.name || "";
		// Fallback chain: Trulioo data -> primary address (nested) -> flat fields from getBusinessDetails
		const businessCountry =
			truliooBusinessData?.country ||
			primaryAddress?.country ||
			(businessDetails.data as any).address_country ||
			"";
		const businessState =
			truliooBusinessData?.state ||
			primaryAddress?.state ||
			(businessDetails.data as any).address_state ||
			"";
		const businessCity =
			truliooBusinessData?.city ||
			primaryAddress?.city ||
			(businessDetails.data as any).address_city ||
			"";
		const businessZip =
			truliooBusinessData?.postalCode ||
			primaryAddress?.postal_code ||
			(businessDetails.data as any).address_postal_code ||
			"";
		// Include address_line_2 / apartment so stored full_address matches user-submitted address (fixes verification badge for two-line addresses)
		const line1 =
			(truliooBusinessData?.address as any)?.addressLine1 ||
			(truliooBusinessData?.address as any)?.line_1 ||
			(truliooBusinessData?.address as any)?.address_line_1 ||
			(primaryAddress as any)?.line_1 ||
			(primaryAddress as any)?.address_line_1 ||
			(primaryAddress as any)?.addressLine1 ||
			undefined;
		const line2 =
			(truliooBusinessData?.address as any)?.address_line_2 ||
			(truliooBusinessData?.address as any)?.apartment ||
			(primaryAddress as any)?.address_line_2 ||
			(primaryAddress as any)?.apartment ||
			undefined;
		const businessAddressFull = [line1, line2].filter(Boolean).join(", ") || line1;

		// Create business payload for storage
		const businessPayload: TruliooKYBFormData = {
			companyName: businessName,
			companyCountryIncorporation: businessCountry,
			companyStateAddress: businessState,
			companyCity: businessCity,
			companyZip: businessZip,
			companyState: businessState || undefined,
			companyAddressFull: businessAddressFull
		};

		// Validate required business data before storing (consistent with normal flow)
		if (!businessPayload.companyName) {
			throw new VerificationApiError(
				"Business name is required for KYB verification",
				StatusCodes.BAD_REQUEST,
				ERROR_CODES.VALIDATION_ERROR
			);
		}

		if (!businessPayload.companyCountryIncorporation) {
			throw new VerificationApiError(
				"Business country is required for KYB verification",
				StatusCodes.BAD_REQUEST,
				ERROR_CODES.VALIDATION_ERROR
			);
		}

		if (!businessPayload.companyZip) {
			throw new VerificationApiError(
				"Business postal code is required for KYB verification",
				StatusCodes.BAD_REQUEST,
				ERROR_CODES.VALIDATION_ERROR
			);
		}

		// Create flow result structure for storage
		const flowResult: TruliooFlowResult = {
			hfSession: transactionId,
			flowData: { elements: [] },
			submitResponse: {},
			clientData: clientData
		};

		// Get or create task for storing results
		// First try to get/create without status restrictions
		let taskId: UUID | null = null;
		try {
			if (!this.dbConnection) {
				logger.error(
					`No dbConnection available for business: ${this.truliooBase["businessID"]}, transaction: ${transactionId}`
				);
			} else {
				logger.info(
					`Attempting to create task for connection_id=${this.dbConnection.id}, platform_id=${this.dbConnection.platform_id}, business: ${this.truliooBase["businessID"]}`
				);
			}
			taskId = await this.getOrCreateTaskForCode({
				taskCode: "fetch_business_entity_verification",
				reference_id: this.truliooBase["businessID"] as UUID
			});
		} catch (error) {
			logger.warn(
				error,
				`Could not create new task, attempting to reuse existing task for business: ${this.truliooBase["businessID"]}, transaction: ${transactionId}`
			);
		}

		// If that fails, try to get an existing task even if it's in SUCCESS state
		// We need to query directly to bypass status restrictions
		if (!taskId && this.dbConnection) {
			const { db } = await import("#helpers/knex");

			// First, verify the relationship exists
			logger.info(
				`Checking for relationship: platform_id=${this.dbConnection.platform_id}, task_code=fetch_business_entity_verification, connection_id=${this.dbConnection.id}`
			);

			const relCheck = await db("integrations.rel_tasks_integrations")
				.select("rel_tasks_integrations.id")
				.join("integrations.core_tasks", "core_tasks.id", "rel_tasks_integrations.task_category_id")
				.where("rel_tasks_integrations.platform_id", this.dbConnection.platform_id)
				.andWhere("core_tasks.code", "fetch_business_entity_verification")
				.first();

			if (!relCheck) {
				logger.error(
					`Missing relationship in rel_tasks_integrations for platform_id=${this.dbConnection.platform_id} and task_code=fetch_business_entity_verification. Cannot create or find task.`
				);
			} else {
				logger.info(`Relationship found: rel_tasks_integrations.id=${relCheck.id}. Searching for existing task...`);
				// Try to find any existing task for this connection and task code
				const existingTaskRow = await db("integrations.data_business_integrations_tasks")
					.select("data_business_integrations_tasks.id")
					.join(
						"integrations.rel_tasks_integrations",
						"data_business_integrations_tasks.integration_task_id",
						"rel_tasks_integrations.id"
					)
					.join("integrations.core_tasks", "core_tasks.id", "rel_tasks_integrations.task_category_id")
					.where("data_business_integrations_tasks.connection_id", this.dbConnection.id)
					.andWhere("core_tasks.code", "fetch_business_entity_verification")
					.orderBy("data_business_integrations_tasks.created_at", "desc")
					.limit(1)
					.first();

				if (existingTaskRow?.id) {
					taskId = existingTaskRow.id as UUID;
					logger.info(
						`Reusing existing task ${taskId} for storing Trulioo results for business: ${this.truliooBase["businessID"]}, transaction: ${transactionId}`
					);
				} else {
					logger.warn(
						`No existing task found for connection_id=${this.dbConnection.id}, task_code=fetch_business_entity_verification. Relationship exists but no task found.`
					);
				}
			}
		}

		if (!taskId) {
			const errorMessage = `Could not create or find task for storing Trulioo results for business: ${this.truliooBase["businessID"]}, transaction: ${transactionId}`;
			logger.error(errorMessage);
			throw new VerificationApiError(errorMessage, StatusCodes.INTERNAL_SERVER_ERROR, ERROR_CODES.INVALID);
		}

		// Store business verification results using the existing storage process
		await this.resultsStorage.storeBusinessVerificationResults(taskId, businessPayload, flowResult);

		logger.info(
			`Trulioo verification results stored for business: ${this.truliooBase["businessID"]}, transaction: ${transactionId}, task: ${taskId}`
		);

		// Extract and download PDF if ShareholderListDocument is available
		const pdfUrl = this.extractPdfUrlFromResponse(rawClientData);
		if (pdfUrl) {
			logger.info(
				`Found ShareholderListDocument PDF URL for business: ${this.truliooBase["businessID"]}, transaction: ${transactionId}. Starting download...`
			);

			// Download PDF asynchronously (don't block webhook response)
			this.savePdfReport(pdfUrl, transactionId).catch(ex => {
				logger.error(
					ex,
					`Could not save Trulioo PDF for business: ${this.truliooBase["businessID"]}, transaction: ${transactionId}`
				);
			});
		} else {
			logger.debug(
				`No ShareholderListDocument found in response for business: ${this.truliooBase["businessID"]}, transaction: ${transactionId}. Skipping PDF download.`
			);
		}
	}

	/**
	 * Extract PDF URL from Trulioo response
	 * Looks for ShareholderListDocument field in the response structure
	 * @param clientData - Trulioo client data response
	 * @returns PDF URL if found, null otherwise
	 */
	private extractPdfUrlFromResponse(clientData: any): string | null {
		try {
			// Navigate through the response structure to find ShareholderListDocument
			const flowData = clientData?.flowData || clientData?.clientData?.flowData;

			if (!flowData || typeof flowData !== "object") {
				return null;
			}

			// Iterate through flowData nodes (keys are node IDs)
			for (const nodeId in flowData) {
				const node = flowData[nodeId];
				const serviceData = node?.serviceData;

				if (!Array.isArray(serviceData)) {
					continue;
				}

				// Search through each service data entry
				for (const service of serviceData) {
					const fullServiceDetails = service?.fullServiceDetails;
					const datasourceResults = fullServiceDetails?.Record?.DatasourceResults;

					if (!Array.isArray(datasourceResults)) {
						continue;
					}

					// Search through datasource results
					for (const datasource of datasourceResults) {
						const appendedFields = datasource?.AppendedFields;

						if (!Array.isArray(appendedFields)) {
							continue;
						}

						// Find ShareholderListDocument field
						const shareholderDocField = appendedFields.find(
							(field: any) => field?.FieldName === "ShareholderListDocument"
						);

						if (shareholderDocField?.Data) {
							// Extract the path: e.g., "/verifications/v3/documentdownload/20cba072-e0ec-aa3d-9dbc-5fe71577a28f/ShareholderListDocument"
							const documentPath = shareholderDocField.Data;

							// Split by '/' and get last 2 elements
							const pathParts = documentPath.split("/").filter(part => part.length > 0);

							if (pathParts.length >= 2) {
								// Get last 2 elements: transactionRecordId and documentName
								const transactionRecordId = pathParts[pathParts.length - 2];
								const documentName = pathParts[pathParts.length - 1];

								// Construct full URL
								const baseUrl = "https://api.trulioo.com/v3/verifications/documentdownload";
								const fullUrl = `${baseUrl}/${transactionRecordId}/${documentName}`;

								logger.info(
									`Extracted Trulioo PDF URL: ${fullUrl} from transactionRecordId: ${transactionRecordId}`
								);

								return fullUrl;
							}
						}
					}
				}
			}

			logger.debug("ShareholderListDocument field not found in Trulioo response");
			return null;
		} catch (error) {
			logger.error(error, "Error extracting PDF URL from Trulioo response");
			return null;
		}
	}

	/**
	 * Download and save Trulioo PDF report
	 * Similar to Equifax's savePdfReport pattern
	 * Uses the same bearer token as KYB flow via TruliooTokenManager
	 * @param pdfUrl - Full URL to download PDF from Trulioo
	 * @param transactionId - Trulioo transaction ID (hfSession)
	 * @returns Promise<boolean> - true if successful
	 */
	private async savePdfReport(pdfUrl: string, transactionId: string): Promise<boolean> {
		const connection = this.getDBConnection();
		if (!connection) {
			logger.error(`No connection defined for saving Trulioo PDF, transaction: ${transactionId}`);
			return false;
		}

		const businessId = this.truliooBase["businessID"] as UUID;

		// Wait 10 seconds for PDF to be ready (similar to Equifax)
		await new Promise(resolve => setTimeout(resolve, 10 * 1000));

		try {
			// Use the same token method as KYB/PSC flows
			const tokenData = await TruliooTokenManager.requestNewToken();

			// This is a simple GET request with Bearer token authentication
			// Use TruliooHttpClient.request() to match the pattern used by KYB/PSC flows
			const { TruliooHttpClient } = await import("../common/truliooHttpClient");

			let response;
			try {
				response = await TruliooHttpClient.request(pdfUrl, {
					method: "GET",
					responseType: "arraybuffer", // CRITICAL: Tell axios to handle binary data as ArrayBuffer
					headers: {
						Authorization: `Bearer ${tokenData.access_token}`
						// Removed Accept header - let server decide content type for binary PDF
					}
				});
			} catch (error: any) {
				// Handle 401 errors with better error message parsing
				// When responseType is arraybuffer, error responses are also arraybuffer
				if (error?.status === 401 || error?.response?.status === 401) {
					let errorMessage = "Unauthorized - token may not have permission for document downloads";

					// Try to parse error message from arraybuffer response
					if (error?.response?.data) {
						try {
							if (error.response.data instanceof ArrayBuffer || Buffer.isBuffer(error.response.data)) {
								const errorText = Buffer.from(error.response.data).toString('utf-8');
								const errorJson = JSON.parse(errorText);
								errorMessage = errorJson.Message || errorJson.message || errorMessage;
							} else if (typeof error.response.data === 'string') {
								const errorJson = JSON.parse(error.response.data);
								errorMessage = errorJson.Message || errorJson.message || errorMessage;
							}
						} catch (parseError) {
							// If parsing fails, use default message
						}
					}

					logger.error(error,
						`Trulioo PDF download unauthorized (401): ${errorMessage}. URL: ${pdfUrl}`
					);
					throw new Error(`PDF download unauthorized: ${errorMessage}`);
				}
				throw error;
			}

			// Convert response data to Buffer
			// When responseType is "arraybuffer", axios returns ArrayBuffer which needs to be converted to Buffer
			let pdfData: Buffer;
			if (response.data instanceof ArrayBuffer) {
				pdfData = Buffer.from(response.data);
			} else if (Buffer.isBuffer(response.data)) {
				pdfData = response.data;
			} else {
				// Fallback: try to convert whatever we got
				pdfData = Buffer.from(response.data);
			}

			// Generate file path using BUSINESS_VERIFICATION_UPLOADS directory
			const { uploadRawFileToS3 } = await import("#common/common");
			const { DIRECTORIES } = await import("#constants");

			const fileName = "shareholder-document.pdf";
			const { path } = await uploadRawFileToS3(
				pdfData,
				businessId,
				fileName,
				DIRECTORIES.BUSINESS_VERIFICATION_UPLOADS,
				"TRULIOO_KYB_VERIFICATION"
			);

			// Save to business_entity_verification_uploads table
			const { sqlQuery } = await import("#helpers");
			const insertQuery = `
				INSERT INTO integration_data.business_entity_verification_uploads 
				(business_id, file_name, file_path)
				VALUES ($1, $2, $3)
				RETURNING *;
			`;

			await sqlQuery({
				sql: insertQuery,
				values: [businessId, fileName, path]
			});

			logger.info(
				`Trulioo PDF saved successfully for business: ${businessId}, transaction: ${transactionId}, path: ${path}`
			);
			return true;
		} catch (error) {
			logger.error(
				error,
				`Could not fetch/save Trulioo PDF report for transaction: ${transactionId}, business: ${businessId}`
			);
			return false;
		}
	}

	/**
	 * Match business using Trulioo KYB flow (following Middesk pattern)
	 * This method is called by the platform factory and provides the same interface as Middesk
	 */
	public matchBusiness = async (): Promise<IBusinessIntegrationTaskEnriched> => {
		const taskId = await this.getOrCreateTaskForCode({
			taskCode: "fetch_business_entity_verification",
			reference_id: this.dbConnection?.business_id
		});
		if (taskId) {
			await this.processTask({ taskId });
		}
		const { TaskManager } = await import("#api/v1/modules/tasks/taskManager");
		const task = await TaskManager.getEnrichedTask(taskId);
		return task;
	};
}
