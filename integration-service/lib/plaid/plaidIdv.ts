/**
 * Implementation for Identity Verification (IDV) with Plaid: https://plaid.com/docs/api/products/identity-verification/
 *
 * Extends TaskManager to inherit the functionality to manage tasks.
 */
import { envConfig } from "#configs/index";
import {
	IDV_STATUS,
	INTEGRATION_ID,
	IdvStatusId,
	ScoreTrigger,
	TASK_STATUS,
	kafkaEvents,
	kafkaTopics,
	type IdvStatus,
	ERROR_CODES,
	FEATURE_FLAGS,
	STAGE_FIELDS,
	ENABLE_IDENTITY_VERIFICATION_SUB_FIELDS,
	CONNECTION_STATUS
} from "#constants";
import { getFlagValue, logger, producer, updateConnectionByConnectionId } from "#helpers";
import { db } from "#helpers/knex";
import type {
	IBusinessIntegrationTask,
	IBusinessIntegrationTaskEnriched,
	ICoreIdentityVerificationTemplates,
	IDBConnection,
	IIdentityVerification,
	IIdentityVerificationEgg
} from "#types/db";
import type { Owner, OwnerWithRel } from "#types/worthApi";
import { decryptData, encryptData } from "#utils/encryption";
import { randomUUID, type UUID } from "crypto";
import {
	Configuration,
	CountryCode,
	IDNumberType,
	IdentityVerificationCreateRequest,
	IdentityVerificationGetResponse,
	IdentityVerificationRetryRequest,
	PlaidApi,
	PlaidEnvironments,
	Products,
	Strategy,
	type UserAddress,
	type UserIDNumber
} from "plaid";
import { TaskManager } from "../../src/api/v1/modules/tasks/taskManager";
import { convertPlaidToWorth, convertWorthToPlaid, formatPostalCode } from "./convert";
import { AxiosError } from "axios";
import axios from "axios";
import type { IPlaidIDV } from "./types";
import { uploadFile, getCachedSignedUrl } from "#utils/s3";
import { DIRECTORIES } from "#constants";
import { verifyAndFormatNumber } from "#utils/phoneNumber";
import type { TDateISO } from "#types/datetime";
import {
	getCustomerOnboardingStagesSettings,
	getOnboardingCustomerSettings,
	getOwnersUnencrypted,
	InternalApiError
} from "#helpers/api";
import { CUSTOM_ONBOARDING_SETUP } from "#constants";
import { VerificationApiError } from "#api/v1/modules/verification/error";
import { StatusCodes } from "http-status-codes";
import { constrainInput, findIDNumberType, getInputValidationForCountry } from "./idvInputValidation";
import type { LDContext } from "@launchdarkly/node-server-sdk";
import { IntegrationMode, IntegrationSetting } from "#api/v1/modules/customer-integration-settings/types";
import { customerIntegrationSettings } from "#api/v1/modules/customer-integration-settings/customer-integration-settings";
import { checkIfUserInfoHasChanged } from "./util/checkIfUserInfoHasChanged";

type StrategyConfig = {
	clientId: string;
	secret: string;
	plaidEnv: string;
	mode?: IntegrationMode;
};

type SDKRoutingFeatureFlag = Record<string /*CustomerId*/, SDKRoutingOption>;
type SDKRoutingOption = Record<
	keyof OwnerWithRel,
	Record<string | number /*Value or RegEx To Match */, string /*TemplateId*/>
>;

export class PlaidIdv extends TaskManager {
	plaidClient: PlaidApi;
	public static readonly PLATFORM_ID = INTEGRATION_ID.PLAID_IDV;
	public customerId: UUID | undefined;
	private readonly ENCRYPTED_PROPERTIES = {
		owners: ["date_of_birth"],
		identity_verification: ["date_of_birth"],
		request_response: ["date_of_birth", "value"]
	};
	private scoreTriggerId: UUID | undefined;
	//Needs to match the entry in the rel_task_integrations table
	private static readonly IDV_TASK_ID = 43;
	// The default phone number to use if the phone number is not provided or cannot be parsed. This is a general phone number owned by Worth.
	// PlaidIDV **needs** a phone number or it will sit in a pending state forever
	private static readonly DEFAULT_PHONE_NUMBER: string = "+14076641508";
	protected readonly strategyConfig: StrategyConfig;
	protected readonly configuration: Configuration;

	// We should always instantiate PlaidIdv through the strategyPlatformFactory helper instead of directly using the constructor.
	// This will ensure that the PlaidIdv class is initialized with the correct configuration based on the strategy and customer settings.
	constructor(dbConnection?: IDBConnection, strategyConfig?: StrategyConfig) {
		super(dbConnection);

		this.strategyConfig = strategyConfig || {
			clientId: envConfig.PLAID_CLIENT_ID!,
			secret: envConfig.PLAID_SECRET!,
			plaidEnv: envConfig.PLAID_ENV!
		};

		this.configuration = new Configuration({
			basePath: PlaidEnvironments[this.strategyConfig.plaidEnv],
			baseOptions: {
				headers: {
					"PLAID-CLIENT-ID": this.strategyConfig.clientId,
					"PLAID-SECRET": this.strategyConfig.secret
				}
			}
		});

		this.plaidClient = new PlaidApi(this.configuration);
	}

	/**
	 * Get the strategy configuration for testing and debugging purposes
	 * @returns The strategy configuration object
	 */
	public getStrategyConfig(): StrategyConfig {
		return this.strategyConfig;
	}

	/**
	 * Get the Plaid API configuration for testing and debugging purposes
	 * @returns The Plaid API configuration object
	 */
	public getConfiguration(): Configuration {
		return this.configuration;
	}

	public static getTasksForIdentityVerificationId(
		idvId: IdentityVerificationGetResponse["id"]
	): Promise<IBusinessIntegrationTask[]> {
		return db<IBusinessIntegrationTask>("integrations.data_business_integrations_tasks")
			.select("data_business_integrations_tasks.*")
			.join(
				"integration_data.identity_verification",
				"data_business_integrations_tasks.id",
				"identity_verification.business_integration_task_id"
			)
			.where({ "identity_verification.external_id": idvId, integration_task_id: PlaidIdv.IDV_TASK_ID });
	}

	public static getTasksForIdentityVerificationByApplicantId(
		applicantID: UUID,
		businessID?: UUID
	): Promise<IBusinessIntegrationTask> {
		const query = db<IBusinessIntegrationTask>("integration_data.identity_verification")
			.select("integrations.data_business_integrations_tasks.*")
			.join(
				"integrations.data_business_integrations_tasks",
				"integrations.data_business_integrations_tasks.id",
				"integration_data.identity_verification.business_integration_task_id"
			)
			.where({
				"integration_data.identity_verification.applicant_id": applicantID,
				"integrations.data_business_integrations_tasks.integration_task_id": PlaidIdv.IDV_TASK_ID
			});

		// Filter by business_id if provided for security and correctness
		if (businessID) {
			query.andWhere("integration_data.identity_verification.business_id", businessID);
		}

		return query.orderBy("data_business_integrations_tasks.created_at", "desc").first();
	}

	private async getIdvTemplatesForEnvironment(): Promise<ICoreIdentityVerificationTemplates[]> {
		return db<ICoreIdentityVerificationTemplates>("integrations.core_identity_verification_templates")
			.select("integrations.core_identity_verification_templates.*")
			.where("platform", this.strategyConfig.plaidEnv || "sandbox")
			.orderBy("created_at", "asc");
	}

	private async getDefaultIdvTemplateForEnvironment(): Promise<ICoreIdentityVerificationTemplates> {
		return db<ICoreIdentityVerificationTemplates>("integrations.core_identity_verification_templates")
			.select("integrations.core_identity_verification_templates.*")
			.where("platform", this.strategyConfig.plaidEnv || "sandbox")
			.where("steps", "{kyc_check}")
			.first();
	}

	public static getIdentityVerificatonTemplateById(templateId: string): Promise<ICoreIdentityVerificationTemplates> {
		return db<ICoreIdentityVerificationTemplates>("integrations.core_identity_verification_templates")
			.select("integrations.core_identity_verification_templates.*")
			.where("template_id", templateId)
			.orderBy("created_at", "asc")
			.first();
	}

	/**
	 * Initializes and configures the Plaid IDV connection with the appropriate template based on customer settings.
	 *
	 * **IMPORTANT**: This method must be called AFTER PlaidIdv has been properly initialized through
	 * `strategyPlatformFactory` to ensure the correct Plaid environment (sandbox/production) is used.
	 * Direct instantiation of PlaidIdv bypasses the strategy configuration and can result in incorrect
	 * template fetching and potential runtime errors.
	 *
	 * @param customerID - Optional UUID of the customer to configure IDV templates for
	 * @returns Promise<PlaidIdv> - The configured PlaidIdv instance
	 *
	 * @throws {Error} When no database connection exists for the PlaidIdv instance
	 *
	 * @example
	 * // ✅ CORRECT: Initialize through strategyPlatformFactory first
	 * const plaidIdvWithStrategy = await strategyPlatformFactory<PlaidIdv>({
	 *   businessID: "business-uuid",
	 *   platformID: INTEGRATION_ID.PLAID_IDV,
	 *   customerID: "customer-uuid"
	 * });
	 *
	 * // Now safely call initializePlaidIdvConnectionConfiguration
	 * const configuredPlaidIdv = await plaidIdvWithStrategy.initializePlaidIdvConnectionConfiguration(customerID);
	 *
	 * ❌ INCORRECT: Never instantiate PlaidIdv directly
	 * const plaidIdv = new PlaidIdv(); // This bypasses strategy configuration!
	 * await plaidIdv.initializePlaidIdvConnectionConfiguration(customerID); // Will use wrong environment
	 */
	public async initializePlaidIdvConnectionConfiguration(customerID?: UUID): Promise<PlaidIdv> {
		const existingConnection = this.dbConnection;
		if (!existingConnection) {
			throw new Error("PlaidIDV connection not found");
		}

		const idvTemplates = await this.getIdvTemplatesForEnvironment();
		const defaultTemplate = idvTemplates.find(t => t.steps === "{kyc_check}");
		const fallbackTemplate = idvTemplates.find(t => t.steps === "{kyc_check_without_ssn}");

		let connectionConfiguration;

		if (!customerID) {
			// If no customer ID, use the default template
			connectionConfiguration = {
				idv_enabled: true,
				template_id: defaultTemplate?.template_id || null,
				idv_id: defaultTemplate?.id || null,
				custom_template_used: false,
				background_verification_only: true,
				fallback_template_id: fallbackTemplate?.template_id || null,
				fallback_idv_id: fallbackTemplate?.id || null
			};
		} else {
			const customerIdvIntegrationSettings = await this.getCustomerIntegrationIdvSettings(customerID);
			const isIdvIntegrationEnabled = customerIdvIntegrationSettings?.status === "ACTIVE";

			let customerTemplateSettings;

			if (isIdvIntegrationEnabled) {
				customerTemplateSettings = await this.processCustomerSettings(customerID, idvTemplates);
			}

			// Single fallback point - use template from settings or fall back to default
			const externalTemplateId = customerTemplateSettings?.idvTemplateId || defaultTemplate?.template_id || null;
			const internalIdvTemplateId = idvTemplates.find(t => t.template_id === externalTemplateId)?.id || null;

			connectionConfiguration = {
				idv_enabled: isIdvIntegrationEnabled,
				template_id: externalTemplateId,
				idv_id: internalIdvTemplateId,
				custom_template_used: customerTemplateSettings?.isCustomIdvTemplate || false,
				// if template id based on customer settings does not have selfie_check or documentary_verification, then background_verification_only is true
				background_verification_only: externalTemplateId === defaultTemplate?.template_id || false,
				...(externalTemplateId === defaultTemplate?.template_id && isIdvIntegrationEnabled
					? {
							fallback_template_id: fallbackTemplate?.template_id,
							fallback_idv_id: fallbackTemplate?.id
						}
					: {})
			};
		}

		const updatedConnection = await updateConnectionByConnectionId(existingConnection.id, CONNECTION_STATUS.SUCCESS, {
			...existingConnection.configuration,
			...connectionConfiguration
		});

		this.dbConnection = updatedConnection;

		logger.info(
			{
				connection: this.dbConnection
			},
			"PlaidIDV connection updated with template config"
		);

		return this;
	}

	private async getCustomerIntegrationIdvSettings(customerID: UUID): Promise<IntegrationSetting | undefined> {
		const settings = await customerIntegrationSettings.findById(customerID);
		const idvIntegrationSettings = settings?.settings?.["identity_verification"];
		return idvIntegrationSettings;
	}

	private async processCustomerSettings(
		customerID: UUID,
		idvTemplates: ICoreIdentityVerificationTemplates[]
	): Promise<{
		idvTemplateId: string | null;
		isCustomIdvTemplate: boolean;
	}> {
		const customOnboardingSettings = await getOnboardingCustomerSettings(customerID);

		const isCustomOnboardingEnabled = customOnboardingSettings?.find(
			item => item.code === CUSTOM_ONBOARDING_SETUP.MODIFY_PAGES_FIELDS_SETUP && item.is_enabled
		);

		if (!isCustomOnboardingEnabled) {
			return {
				idvTemplateId: null,
				isCustomIdvTemplate: false
			};
		}

		const customerOnboardingStagesSettings = await getCustomerOnboardingStagesSettings(
			customerID,
			CUSTOM_ONBOARDING_SETUP.MODIFY_PAGES_FIELDS_SETUP
		);

		const ownershipStage = customerOnboardingStagesSettings.find(stage => stage.stage_code === "ownership");

		if (!ownershipStage) {
			throw new Error("The Ownership stage settings not found.");
		}

		const idvConfig = this.extractIdvConfiguration(ownershipStage);

		// Customer onboarding ownership stage being enabled/disabled is updated by the integration settings via kafka event
		// There shouldn't be a mismatch, but if so, log a warning and return the default template
		if (idvConfig.isIdvDisabled) {
			logger.warn(
				{
					customerID
				},
				`Mismatching IDV configuration for customerId ${customerID}. Enabled in integration settings, but disabled in customer onboarding settings.`
			);
			return {
				idvTemplateId: null,
				isCustomIdvTemplate: false
			};
		}

		if (idvConfig.isCustomTemplateEnabled) {
			return {
				idvTemplateId: idvConfig.customPlaidTemplateID || null,
				isCustomIdvTemplate: true
			};
		}

		// Template selection based on customer settings
		const templateId = this.selectTemplateBasedOnSettings(
			idvConfig.isDrivingLicenseEnabled,
			idvConfig.isSelfieCheckEnabled,
			idvTemplates
		);

		return {
			idvTemplateId: templateId,
			isCustomIdvTemplate: false
		};
	}

	private extractIdvConfiguration(ownershipStage: any) {
		const fields = ownershipStage?.config?.fields || [];

		const isIdvDisabled =
			fields.find((f: { name: string }) => f.name === STAGE_FIELDS.DISABLE_IDENTITY_VERIFICATION)?.status || false;

		const idvEnabledField = fields.find((f: { name: string }) => f.name === STAGE_FIELDS.IDENTITY_VERIFICATION);

		const isCustomTemplateEnabled =
			idvEnabledField?.sub_fields?.find(
				(sf: { name: string }) => sf.name === ENABLE_IDENTITY_VERIFICATION_SUB_FIELDS.CUSTOM_PLAID_TEMPLATE
			)?.status || false;

		const customPlaidTemplateID =
			idvEnabledField?.sub_fields?.find(
				(sf: { name: string }) => sf.name === ENABLE_IDENTITY_VERIFICATION_SUB_FIELDS.PLAID_TEMPLATE_ID
			)?.status || "";

		const isDrivingLicenseEnabled =
			idvEnabledField?.sub_fields?.find(
				(sf: { name: string }) => sf.name === ENABLE_IDENTITY_VERIFICATION_SUB_FIELDS.COLLECT_DRIVER_LICENSE
			)?.status || false;

		const isSelfieCheckEnabled =
			idvEnabledField?.sub_fields?.find(
				(sf: { name: string }) => sf.name === ENABLE_IDENTITY_VERIFICATION_SUB_FIELDS.CONDUCT_LIVELINESS_CHECK
			)?.status || false;

		return {
			isIdvDisabled,
			isCustomTemplateEnabled,
			customPlaidTemplateID,
			isDrivingLicenseEnabled,
			isSelfieCheckEnabled
		};
	}

	private selectTemplateBasedOnSettings(
		isDrivingLicenseEnabled: boolean,
		isSelfieCheckEnabled: boolean,
		idvTemplates: ICoreIdentityVerificationTemplates[]
	): string | null {
		// Both license and selfie enabled - use comprehensive template
		if (isDrivingLicenseEnabled && isSelfieCheckEnabled) {
			return (
				idvTemplates.find(t => t.steps === "{kyc_check,documentary_verification,selfie_check}")?.template_id || null
			);
		}

		// Only license enabled - use documentary verification template
		if (isDrivingLicenseEnabled) {
			return idvTemplates.find(t => t.steps === "{kyc_check,documentary_verification}")?.template_id || null;
		}

		// Only selfie enabled - use selfie check template
		if (isSelfieCheckEnabled) {
			return idvTemplates.find(t => t.steps === "{kyc_check,selfie_check}")?.template_id || null;
		}

		// Neither enabled - parent will use default template
		return null;
	}

	public async enrollBusinessInPlaidIdv({
		businessID,
		scoreTrigger,
		scoreTriggerVersion,
		owners
	}: {
		businessID: UUID;
		scoreTrigger?: ScoreTrigger;
		scoreTriggerVersion?: number;
		owners: Owner[];
	}) {
		if (scoreTrigger) {
			if (!scoreTriggerVersion) {
				scoreTriggerVersion = 1;
			}
			const scoreTriggerRecord = await db("integrations.business_score_triggers")
				.select("id")
				.where({ business_id: businessID, trigger_type: scoreTrigger, version: scoreTriggerVersion })
				.first();
			if (scoreTriggerRecord && scoreTriggerRecord.id) {
				this.scoreTriggerId = scoreTriggerRecord.id;
			}
			if (!this.scoreTriggerId) {
				const insertedScoreTriggerRecord = await db("integrations.business_score_triggers")
					.insert({ business_id: businessID, trigger: scoreTrigger, version: scoreTriggerVersion })
					.returning("id");
				if (insertedScoreTriggerRecord && insertedScoreTriggerRecord[0]) {
					this.scoreTriggerId = insertedScoreTriggerRecord[0].id;
				}
			}
		}
		const out = { applicants: {} };
		const ownerPromises = owners.map(async owner => {
			const enrolled = await this.enrollApplicantOrGetExistingIdvRecord(owner);
			out.applicants[owner.id] = enrolled;
		});
		await Promise.all(ownerPromises);
		return out;
	}

	static async getLocalIdentityVerificationRecordsForApplicant<T = any>(
		applicantID: UUID
	): Promise<IIdentityVerification<T>[]> {
		return await db<IIdentityVerification<T>>("integration_data.identity_verification")
			.select("*")
			.where({ applicant_id: applicantID })
			.orderBy("status", "updated_at");
	}
	static async getLatestLocalIdentityVerificationRecordsForApplicant(
		applicantID: UUID
	): Promise<IIdentityVerification | undefined> {
		return await db<IIdentityVerification>("integration_data.identity_verification")
			.select("*")
			.where({ applicant_id: applicantID })
			.orderBy("created_at", "desc")
			.first();
	}
	static async getLocalIdentityVerificationRecordsForBusiness(businessID: UUID): Promise<IIdentityVerification<any>[]> {
		return await db<IIdentityVerification>("integration_data.identity_verification")
			.select("*")
			.where({ business_id: businessID });
	}

	/**
	 * Maps Plaid document category to human-readable document type name
	 */
	private static mapDocumentCategoryToType(category: string | undefined | null): string {
		if (!category) {
			return "Identity Document";
		}

		const categoryMap: Record<string, string> = {
			drivers_license: "Driver's License",
			id_card: "ID Card",
			passport: "Passport",
			residence_permit_card: "Residence Permit Card",
			resident_card: "Resident Card",
			visa: "Visa"
		};

		// If the category is not found in the categoryMap, return the category with the first letter capitalized and the rest of the letters lowercase
		return categoryMap[category] || category.charAt(0).toUpperCase() + category.slice(1).replace(/_/g, " ");
	}

	/**
	 * Generates a signed URL from an S3 key
	 */
	private static async generateSignedUrl(s3Key: string | undefined | null): Promise<string | null> {
		if (!s3Key) return null;

		try {
			const result = await getCachedSignedUrl(s3Key, "");
			return result.signedRequest;
		} catch (error) {
			logger.error({ error }, `Failed to generate signed URL for ${s3Key}`);
			return null;
		}
	}

	// returns ApplicantRiskCheckResult object from IDV metadata
	private static buildApplicantRiskCheckResult(
		meta: IIdentityVerification<any>["meta"]
	): IPlaidIDV.ApplicantRiskCheckResult {
		const ssnVerificationStatus = meta?.kyc_check?.id_number?.summary ?? undefined;
		const syntheticRiskScore = meta?.risk_check?.identity_abuse_signals?.synthetic_identity?.score ?? undefined;

		return {
			name: meta?.kyc_check?.name?.summary,
			address: meta?.kyc_check?.address,
			dob: meta?.kyc_check?.date_of_birth?.summary,
			ssn: PlaidIdv.getSSNVerificationStatus(ssnVerificationStatus, syntheticRiskScore),
			phone: {
				...(meta?.kyc_check?.phone_number ? meta?.kyc_check?.phone_number : {}),
				...(meta?.risk_check?.phone ? meta?.risk_check?.phone : {})
			},
			email: meta?.risk_check?.email,
			user_interactions: meta?.risk_check?.behavior?.user_interactions ?? null,
			fraud_ring_detected: meta?.risk_check?.behavior?.fraud_ring_detected ?? null,
			bot_detected: meta?.risk_check?.behavior?.bot_detected ?? null,
			synthetic_identity_risk_score: meta?.risk_check?.identity_abuse_signals?.synthetic_identity.score ?? null,
			stolen_identity_risk_score: meta?.risk_check?.identity_abuse_signals?.stolen_identity.score ?? null,
			steps: meta?.steps ?? null,
			ip_spam_list_count: meta?.risk_check?.devices?.[0]?.ip_spam_list_count ?? null,
			documents_verification: meta?.documentary_verification?.status ?? null,
			error: meta?.error
		};
	}

	// returns a transformed IDV applicant response for downstream consumption
	static async getApplicantVerificationResponse(applicantID: UUID): Promise<IPlaidIDV.GetApplicantResponse[]> {
		const record = (await PlaidIdv.getLatestLocalIdentityVerificationRecordsForApplicant(applicantID)) as
			| IIdentityVerification<any>
			| undefined;
		const out: IPlaidIDV.GetApplicantResponse[] = [];
		if (record) {
			// pull out the relevant risk assessment data for the response
			const riskCheckResult = PlaidIdv.buildApplicantRiskCheckResult(record.meta);

			// Extract identity documents (only if verification passed)
			const documents: IPlaidIDV.IdentityDocument[] = [];
			const docVerification = record.meta?.documentary_verification;
			const isVerificationSuccessful = docVerification?.status === "success";

			// Get S3 keys directly from the record (already fetched via select *)
			const s3Keys = record.document_s3_keys;

			// Show documents if verification passed
			if (isVerificationSuccessful) {
				const docs = docVerification?.documents;
				// Handle both array format and object format (e.g., { "0": {...}, "1": {...} })
				const docArray = docs
					? ((Array.isArray(docs) ? docs : Object.values(docs)) as IPlaidIDV.DocumentaryVerificationDocument[])
					: undefined;

				// Find the latest successful document
				let successfulDoc: IPlaidIDV.DocumentaryVerificationDocument | undefined;
				if (docArray && docArray.length > 0) {
					successfulDoc = docArray
						.filter(doc => doc.status === "success")
						.sort((a, b) => (b.attempt || 0) - (a.attempt || 0))[0];
				}

				// Build base document object
				const document: IPlaidIDV.IdentityDocument = {
					type: PlaidIdv.mapDocumentCategoryToType(successfulDoc?.extracted_data?.category),
					status: "success",
					document_id: record.external_id,
					extracted_data: successfulDoc?.extracted_data
				};

				// Add URLs if S3 keys exist
				if (s3Keys?.front || s3Keys?.back) {
					const [frontUrl, backUrl] = await Promise.all([
						PlaidIdv.generateSignedUrl(s3Keys.front),
						PlaidIdv.generateSignedUrl(s3Keys.back)
					]);
					document.original_front_url = frontUrl;
					document.original_back_url = backUrl;
				}

				documents.push(document);
			}

			out.push({
				applicant: {
					id: record.applicant_id,
					status: (Object.keys(IDV_STATUS).find(key => IDV_STATUS[key] == record.status) || "PENDING") as IdvStatus,
					updated_at: record.updated_at as TDateISO,
					risk_check_result: riskCheckResult
				},
				identity_verification_attempted: true,
				documents: documents.length > 0 ? documents : undefined
			});
		}
		return out;
	}

	public async enrollApplicantOrGetExistingIdvRecord(ownerInfo: Owner): Promise<IPlaidIDV.EnrollApplicantResponse> {
		logger.info(
			{ ownerId: ownerInfo.id },
			"PlaidIdv.enrollApplicantOrGetExistingIdvRecord: Checking for existing record"
		);
		const latestRecord = await PlaidIdv.getLatestLocalIdentityVerificationRecordsForApplicant(ownerInfo.id);

		let isOwnerInfoChanged = true; // default to true if no record found
		let existingTask: IBusinessIntegrationTask | undefined;

		if (latestRecord) {
			existingTask = await TaskManager.getTaskById(latestRecord.business_integration_task_id);
			isOwnerInfoChanged = checkIfUserInfoHasChanged(ownerInfo, latestRecord);
		}

		const returnExistingSuccessTask =
			existingTask?.task_status === TASK_STATUS.SUCCESS &&
			latestRecord?.status === IDV_STATUS.SUCCESS &&
			!isOwnerInfoChanged;

		if (returnExistingSuccessTask) {
			logger.info(
				{
					ownerId: ownerInfo.id,
					taskId: existingTask?.id,
					taskStatus: existingTask?.task_status,
					recordStatus: latestRecord?.status
				},
				"PlaidIdv.enrollApplicantOrGetExistingIdvRecord: Returning existing success task for unchanged owner"
			);
			return {
				taskId: existingTask?.id!,
				taskStatus: existingTask?.task_status!,
				previousSuccess: true,
				record: latestRecord
			};
		}

		const useExistingInProgressTask =
			existingTask?.task_status === TASK_STATUS.IN_PROGRESS &&
			latestRecord?.status === IDV_STATUS.PENDING &&
			!isOwnerInfoChanged;

		if (useExistingInProgressTask) {
			logger.info(
				{
					ownerId: ownerInfo.id,
					taskId: existingTask?.id,
					taskStatus: existingTask?.task_status,
					recordStatus: latestRecord?.status
				},
				"PlaidIdv.enrollApplicantOrGetExistingIdvRecord: Using existing task in progress task for unchanged owner"
			);
			return {
				taskId: existingTask?.id!,
				taskStatus: existingTask?.task_status!,
				record: latestRecord
			};
		}
		logger.info(
			{ ownerId: ownerInfo.id },
			"PlaidIdv.enrollApplicantOrGetExistingIdvRecord: No existing record found or owner info changed, enrolling applicant"
		);
		return await this.enrollApplicant(ownerInfo);
	}

	public async enrollApplicant(
		owner: Owner
	): Promise<Pick<IPlaidIDV.EnrollApplicantResponse, "taskId" | "taskStatus">> {
		let taskId: UUID | undefined;
		try {
			logger.info({ ownerId: owner.id }, "PlaidIdv.enrollApplicant: Attempting to find unsatisfied score trigger");
			const unfinishedScoreTrigger = await this.findUnsatisfiedScoreTriggerId();
			taskId = unfinishedScoreTrigger.id;
			logger.info(
				{ ownerId: owner.id, taskId },
				"PlaidIdv.enrollApplicant: Found unsatisfied score trigger, updating task"
			);
			await db<IBusinessIntegrationTask>("integrations.data_business_integrations_tasks")
				.update({ reference_id: owner.id, metadata: { ownerInfo: owner }, updated_at: db.raw("now()") })
				.where({ id: taskId });
		} catch (err) {
			logger.info(
				{ ownerId: owner.id, error: err instanceof Error ? err.message : String(err) },
				"PlaidIdv.enrollApplicant: Creating new task"
			);
			// check for customer score trigger id first
			const scoreTrigger = await this.findCustomerScoreTriggerId();
			// if score id available at instance creation, use it else use findCustomerScoreTriggerId
			taskId = await this.getOrCreateTaskForCode({
				taskCode: "fetch_identity_verification",
				metadata: { ownerInfo: owner },
				reference_id: owner.id,
				conditions: [{ column: "reference_id", operator: "=", value: owner.id }],
				scoreTriggerId: this.scoreTriggerId ? this.scoreTriggerId : scoreTrigger?.id
			});
		} finally {
			if (!taskId) throw new Error("Could not find a task to satisfy the score trigger");
			logger.info({ ownerId: owner.id, taskId }, "PlaidIdv.enrollApplicant: Processing task");
			const task = await TaskManager.getEnrichedTask(taskId);
			logger.info(
				{ ownerId: owner.id, taskId, taskStatus: task?.task_status },
				"PlaidIdv.enrollApplicant: Task retrieved, status before processing"
			);
			const updatedTask = await this.processTask({ task });
			logger.info(
				{ ownerId: owner.id, taskId, finalStatus: updatedTask.task_status },
				"PlaidIdv.enrollApplicant: Task processing completed"
			);
			return { taskId, taskStatus: updatedTask.task_status };
		}
	}

	private async findUnsatisfiedScoreTriggerId(): Promise<
		Pick<IBusinessIntegrationTask, "business_score_trigger_id" | "id">
	> {
		const connection = this.getDBConnection();
		if (connection) {
			const query = db("integrations.data_business_integrations_tasks")
				.select("integrations.data_business_integrations_tasks.id", "business_score_trigger_id")
				.join(
					"integrations.business_score_triggers",
					"integrations.data_business_integrations_tasks.business_score_trigger_id",
					"integrations.business_score_triggers.id"
				)
				.whereNotNull("business_score_trigger_id")
				.where("connection_id", connection.id)
				.where("integration_task_id", PlaidIdv.IDV_TASK_ID)
				.whereIn("task_status", TaskManager.PENDING_TASK_STATUSES)
				.whereNull("reference_id")
				.orderBy("integrations.data_business_integrations_tasks.created_at", "asc")
				.first();
			// select Score id that having customer id first
			if (this.customerId) {
				query.where("integrations.business_score_triggers.customer_id", this.customerId);
			}
			return query;
		}
		throw new Error("Could not find a task to satisfy the score trigger");
	}

	// finds the latest score trigger for the customer
	private async findCustomerScoreTriggerId(): Promise<Pick<{ id: UUID }, "id"> | undefined> {
		const connection = this.getDBConnection();
		if (this.customerId) {
			return db<{ id: UUID }>("integrations.business_score_triggers")
				.select("id")
				.where("customer_id", this.customerId)
				.orderBy("integrations.business_score_triggers.created_at", "desc")
				.first();
		}
		return undefined;
	}
	/**
	 * Generates a mocked Identity Verification Create Request object.
	 * This is intended to be used for forcing a passing request in a Plaid IDV Sandbox Environment
	 * @param {Object} ownerInfo - An object containing information about the owner.
	 * @param {string} templateId - Plaid template id to use for the mocked request.
	 * @returns {IdentityVerificationCreateRequest} - The mocked Identity Verification Create Request.
	 */
	private async getMockedIdentityVerificationCreateRequest(
		ownerInfo: Owner,
		templateId: string
	): Promise<IdentityVerificationCreateRequest> {
		if (!templateId) {
			const template = await this.getDefaultIdvTemplateForEnvironment();
			templateId = template.template_id;
		}
		return {
			client_user_id: ownerInfo.id,
			is_shareable: false,
			is_idempotent: true,
			template_id: templateId,
			gave_consent: true,
			user: {
				name: { given_name: "Leslie", family_name: "Knope" },
				address: {
					city: "Pawnee",
					region: "IN",
					street: "123 Main St.",
					country: "US",
					street2: null,
					postal_code: "46001"
				},
				id_number: { type: IDNumberType.UsSsnLast4, value: "6789" },
				date_of_birth: "1975-01-18",
				email_address: ownerInfo.email ?? "",
				phone_number: "+12345678909"
			}
		};
	}

	/**
	 * If the plaidEnv is sandbox and the last name includes "__test" or "__success", return true
	 * This is used to determine if the user should be passed through to Plaid for a successful identity verification.
	 * @param {Object} ownerInfo - An object containing information about the owner.
	 * @returns {boolean} - Returns true if the conditions are met, otherwise false.
	 */
	public isPassThrough(ownerInfo): boolean {
		return (
			this.strategyConfig.plaidEnv === "sandbox" &&
			(ownerInfo.last_name.includes("__success") || ownerInfo.last_name.includes("__test"))
		);
	}

	public updateBusinessIntegrationTask(taskId: UUID, body: Partial<IBusinessIntegrationTask>) {
		return db<IBusinessIntegrationTask>("integrations.data_business_integrations_tasks")
			.where({ id: taskId })
			.update(body);
	}

	/* this is the task handler for fetch_identity_verification */
	public async fetch_identity_verification(task: IBusinessIntegrationTaskEnriched) {
		logger.info({ taskId: task.id, taskStatus: task.task_status }, "PlaidIdv.fetch_identity_verification: Starting");
		const connection = this.getDBConnection();
		if (!connection) {
			logger.error({ taskId: task.id }, "PlaidIdv.fetch_identity_verification: No connection available");
			throw new Error("No connection available");
		}
		logger.info(
			{ taskId: task.id, connectionId: connection.id, idvEnabled: connection?.configuration?.idv_enabled },
			"PlaidIdv.fetch_identity_verification: Connection retrieved"
		);

		if (!connection?.configuration?.idv_enabled) {
			logger.info({ taskId: task.id }, "PlaidIdv.fetch_identity_verification: IDV disabled, marking SUCCESS");
			await this.updateTaskStatus(task.id, TASK_STATUS.SUCCESS, "IDV is disabled for this business");
			return;
		}

		let rawOwnerInfo = task.metadata?.ownerInfo as Owner;
		if (!rawOwnerInfo) {
			logger.error({ taskId: task.id }, "PlaidIdv.fetch_identity_verification: No owner info");
			throw new Error("Could not find owner");
		}

		const ownerInfo: Owner = this.decrypt("owners", rawOwnerInfo);
		try {
			if (
				!ownerInfo ||
				!ownerInfo.address_line_1 ||
				!ownerInfo.address_city ||
				!ownerInfo.first_name ||
				!ownerInfo.last_name
			) {
				logger.error(
					{ taskId: task.id, ownerId: ownerInfo.id },
					`PlaidIdv.fetch_identity_verification: Incomplete data for ownerId: ${ownerInfo.id} to perform Identity verification`
				);
				throw new InternalApiError(
					`Incomplete data for ownerId: ${ownerInfo.id} to perform Identity verification`,
					StatusCodes.BAD_REQUEST,
					"INVALID_OWNER_INFO"
				);
			}
			const createRequest: IdentityVerificationCreateRequest = await this.generateRequest(
				ownerInfo as OwnerWithRel,
				task
			);
			logger.info(
				{ taskId: task.id, ownerId: ownerInfo.id },
				"PlaidIdv.fetch_identity_verification: Generating request"
			);

			logger.info(
				{ taskId: task.id, ownerId: ownerInfo.id },
				"PlaidIdv.fetch_identity_verification: IDV enabled, proceeding"
			);
			let result;
			const previousLatestRecord = await (
				this.constructor as typeof PlaidIdv
			).getLatestLocalIdentityVerificationRecordsForApplicant(ownerInfo.id);
			logger.info(
				{
					taskId: task.id,
					ownerId: ownerInfo.id,
					hasPreviousRecord: !!previousLatestRecord,
					previousStatus: previousLatestRecord?.status
				},
				"PlaidIdv.fetch_identity_verification: Checked previous records"
			);

			const shouldRetry = previousLatestRecord && checkIfUserInfoHasChanged(ownerInfo, previousLatestRecord);

			logger.info(
				{ taskId: task.id, ownerId: ownerInfo.id, shouldRetry },
				"PlaidIdv.fetch_identity_verification: Determined retry strategy"
			);

			if (shouldRetry) {
				logger.info(
					{ taskId: task.id, ownerId: ownerInfo.id, previousStatus: previousLatestRecord.status },
					"PlaidIdv.fetch_identity_verification: Using identityVerificationRetry due to previous terminal state or changed user information"
				);
				try {
					const retryRequest: IdentityVerificationRetryRequest = {
						...createRequest,
						client_user_id: ownerInfo.id,
						strategy: Strategy.Reset
					};
					result = await this.plaidClient.identityVerificationRetry(retryRequest);
					logger.info(
						{ taskId: task.id, ownerId: ownerInfo.id, resultId: result.data?.id },
						"PlaidIdv.fetch_identity_verification: Retry successful"
					);
				} catch (error) {
					if (
						error instanceof AxiosError &&
						(error.response?.data?.error_message || error.message)?.includes(
							"No Identity Verification sessions found associated with the Flow template ID and customer_reference provided."
						)
					) {
						let message = error.response?.data?.error_message || error.message;
						logger.warn(
							{ taskId: task.id, ownerId: ownerInfo.id, error: message },
							"PlaidIdv.fetch_identity_verification: identityVerificationRetry failed, falling back to identityVerificationCreate"
						);
						result = await this.plaidClient.identityVerificationCreate(createRequest);
						logger.info(
							{ taskId: task.id, ownerId: ownerInfo.id, resultId: result.data?.id },
							"PlaidIdv.fetch_identity_verification: Create after retry successful"
						);
					} else {
						throw error;
					}
				}
			} else {
				logger.info(
					{ taskId: task.id, ownerId: ownerInfo.id },
					"PlaidIdv.fetch_identity_verification: Using identityVerificationCreate for new verification"
				);
				result = await this.plaidClient.identityVerificationCreate(createRequest);
				logger.info(
					{ taskId: task.id, ownerId: ownerInfo.id, resultId: result.data?.id },
					"PlaidIdv.fetch_identity_verification: Create successful"
				);
			}

			if (!connection?.configuration?.background_verification_only || connection?.configuration?.custom_template_used) {
				const tokenResponse = await this.plaidClient.linkTokenCreate({
					user: { client_user_id: ownerInfo.id },
					identity_verification: { template_id: connection?.configuration?.template_id },
					client_name: "Worth",
					products: [Products.IdentityVerification],
					language: "en",
					country_codes: [CountryCode.Us]
				});

				await this.updateBusinessIntegrationTask(task.id, {
					metadata: db.raw(
						`jsonb_set(COALESCE(metadata::jsonb, '{}'::jsonb), '{linkTokenData}', '${JSON.stringify(tokenResponse.data)}')`
					)
				});
			}

			// For storing the request, put it back to the encrypted format
			const encryptedRequest = this.ENCRYPTED_PROPERTIES["request_response"].reduce((acc, key) => {
				acc = this.encryptNestedProperty(acc, key);
				return acc;
			}, createRequest);

			await this.updateBusinessIntegrationTask(task.id, {
				metadata: db.raw(
					`jsonb_set(COALESCE(metadata::jsonb, '{}'::jsonb), '{plaidRequest}', '${JSON.stringify(encryptedRequest)}')`
				)
			});

			logger.info(
				{ taskId: task.id, plaidIdvId: result.data?.id },
				"PlaidIdv.fetch_identity_verification: Updating to IN_PROGRESS"
			);
			await this.updateTaskStatus(task.id, TASK_STATUS.IN_PROGRESS, result.data);
			if (result.data?.id) {
				logger.info(
					{ taskId: task.id, plaidIdvId: result.data.id },
					"PlaidIdv.fetch_identity_verification: Fetching status from Plaid"
				);
				const response = await this.getIdvStatusFromPlaid(result.data.id, task);
				const status: IdvStatusId = convertPlaidToWorth("status", response.status) || IDV_STATUS.PENDING;
				logger.info(
					{ taskId: task.id, plaidIdvId: result.data.id, plaidStatus: response.status, convertedStatus: status },
					"PlaidIdv.fetch_identity_verification: Status retrieved"
				);
				if (status != IDV_STATUS.PENDING) {
					logger.info(
						{ taskId: task.id, plaidIdvId: result.data.id, status },
						"PlaidIdv.fetch_identity_verification: Status terminal, updating to SUCCESS"
					);
					await this.updateTaskStatus(task.id, TASK_STATUS.SUCCESS, response);
				} else {
					logger.info(
						{ taskId: task.id, plaidIdvId: result.data.id },
						"PlaidIdv.fetch_identity_verification: Status still PENDING, task remains IN_PROGRESS"
					);
				}
			} else {
				logger.error({ taskId: task.id }, "PlaidIdv.fetch_identity_verification: No ID from Plaid");
				throw new Error("No id returned from Plaid");
			}
			return result.data;
		} catch (ex: unknown) {
			let message = ex instanceof Error ? ex.message : ex;
			if (ex instanceof AxiosError) {
				message = ex.response?.data?.error_message || ex.message;
				logger.error(
					`taskId=${task.id} | PlaidIdv.fetch_identity_verification: Failure in creating identity verification request: ${message}`
				);
				const errorEgg: IIdentityVerificationEgg = {
					business_integration_task_id: task.id,
					business_id: connection.business_id,
					platform_id: connection.platform_id,
					applicant_id: ownerInfo.id,
					status: IDV_STATUS.FAILED,
					meta: { error: message } as any,
					external_id: ex.response?.data.request_id || randomUUID(),
					template_id: connection?.configuration?.idv_id || null,
					shareable_url: null
				};
				logger.info(
					{ taskId: task.id, ownerId: ownerInfo.id },
					"PlaidIdv.fetch_identity_verification: Saving error response"
				);
				this.saveIdvResponse(errorEgg, task.id);
				PlaidIdv.saveRawResponseToDB(
					errorEgg,
					connection.business_id,
					task,
					connection.platform_id,
					"fetch_identity_verification"
				);
			} else if (ex instanceof InternalApiError && ex.errorCode === "INVALID_OWNER_INFO") {
				const errorEgg: IIdentityVerificationEgg = {
					business_integration_task_id: task.id,
					business_id: connection.business_id,
					platform_id: connection.platform_id,
					applicant_id: ownerInfo.id,
					status: IDV_STATUS.FAILED,
					meta: { error: message } as any,
					external_id: randomUUID(),
					template_id: connection?.configuration?.idv_id || null,
					shareable_url: null
				};
				this.saveIdvResponse(errorEgg, task.id);
			} else {
				logger.error(
					{
						taskId: task.id,
						ownerId: ownerInfo.id,
						error: message,
						errorStack: ex instanceof Error ? ex.stack : undefined
					},
					"PlaidIdv.fetch_identity_verification: Unexpected error"
				);
			}
			throw ex;
		}
	}

	/**
	 * Downloads and stores document images from Plaid's temporary URLs to permanent S3 storage.
	 * Only stores images from the latest successful document submission.
	 * @param result - The Plaid Identity Verification response
	 * @param businessID - The business ID
	 * @param applicantID - The applicant/owner ID
	 * @returns Object with S3 keys (original_front, original_back) for generating signed URLs later
	 */
	private async downloadAndStoreDocumentImages(
		result: IdentityVerificationGetResponse,
		businessID: UUID,
		applicantID: UUID
	): Promise<{ original_front?: string; original_back?: string }> {
		try {
			const documents = result.documentary_verification?.documents as
				| IPlaidIDV.DocumentaryVerificationDocument[]
				| undefined;
			if (!documents || documents.length === 0) {
				return {};
			}

			// Find the latest successful document (sorted by attempt number descending)
			const latestSuccessfulDoc = documents
				.filter(doc => doc.status === "success")
				.sort((a, b) => (b.attempt || 0) - (a.attempt || 0))[0];

			const images = latestSuccessfulDoc?.images;
			if (!images) {
				return {};
			}

			const directory = DIRECTORIES.BUSINESS_VERIFICATION_UPLOADS.replace(":businessID", businessID);
			const timestamp = Date.now();

			// Download and store images in parallel
			const [frontKey, backKey] = await Promise.all([
				this.downloadAndStoreImage(images.original_front, result.id, applicantID, "front", directory, timestamp),
				this.downloadAndStoreImage(images.original_back, result.id, applicantID, "back", directory, timestamp)
			]);

			const storedKeys: { original_front?: string; original_back?: string } = {};
			if (frontKey) storedKeys.original_front = frontKey;
			if (backKey) storedKeys.original_back = backKey;

			return storedKeys;
		} catch (error) {
			logger.error(
				`Error in downloadAndStoreDocumentImages for applicant ${applicantID}, business ${businessID}: ${(error as Error).message}`
			);
			return {};
		}
	}

	/**
	 * Downloads an image from a URL and stores it in S3
	 * @returns The S3 key if successful, null otherwise
	 */
	private async downloadAndStoreImage(
		imageUrl: string | undefined,
		resultId: string,
		applicantID: UUID,
		side: "front" | "back",
		directory: string,
		timestamp: number
	): Promise<string | null> {
		if (!imageUrl) return null;

		try {
			const response = await axios.get(imageUrl, { responseType: "arraybuffer" });
			const buffer = Buffer.from(response.data);
			const fileName = `idv_${resultId}_${applicantID}_${side}_${timestamp}.jpeg`;

			await uploadFile({ buffer }, fileName, "image/jpeg", directory);
			logger.info(`Stored ${side} document image for applicant ${applicantID}`);

			return `${directory}/${fileName}`;
		} catch (error) {
			logger.error({ error }, `Failed to download/store ${side} image for applicant ${applicantID}`);
			return null;
		}
	}

	/**
	 * Process the incoming webhook for identity status changing. Not currently authenticated, but we only use this as an event to trigger Getting the status directly from Plaid
	 *  Updatess task & identity_verification row with results from Plaid
	 * @param task
	 * @param id
	 * @returns
	 */
	public async processIdentityVerificationWebhook(
		task: IBusinessIntegrationTask,
		id: IdentityVerificationGetResponse["id"]
	): Promise<IdentityVerificationGetResponse> {
		logger.debug(`Got webhook for idv ${id}, task ${task.id}`);
		const verificationResponse = await this.getIdvStatusFromPlaid(id, task);
		await this.updateTaskStatus(task.id, TASK_STATUS.SUCCESS, verificationResponse);
		return verificationResponse;
	}

	async getIdvStatusFromPlaid(
		id: IdentityVerificationGetResponse["id"],
		task: IBusinessIntegrationTask
	): Promise<IdentityVerificationGetResponse> {
		logger.info({ taskId: task.id, plaidIdvId: id }, "PlaidIdv.getIdvStatusFromPlaid: Fetching status");
		const connection = this.getDBConnection();
		if (connection) {
			const result = await this.plaidClient.identityVerificationGet({ identity_verification_id: id });
			logger.info(
				{ taskId: task.id, plaidIdvId: id, plaidStatus: result.data?.status },
				"PlaidIdv.getIdvStatusFromPlaid: Received from Plaid"
			);
			const idvTemplates = await this.getIdvTemplatesForEnvironment();
			if (result && result.data) {
				// Download and store document images immediately (before Plaid's signed URLs expire after 60 seconds)
				logger.info({ taskId: task.id, plaidIdvId: id }, "PlaidIdv.getIdvStatusFromPlaid: Downloading document images");
				const storedS3Keys = await this.downloadAndStoreDocumentImages(
					result.data,
					connection.business_id,
					result.data.client_user_id as UUID
				);

				const convertedStatus = convertPlaidToWorth("status", result.data.status) || IDV_STATUS.PENDING;
				logger.info(
					{ taskId: task.id, plaidIdvId: id, plaidStatus: result.data.status, convertedStatus },
					"PlaidIdv.getIdvStatusFromPlaid: Status converted"
				);

				const egg: IIdentityVerificationEgg = {
					business_integration_task_id: task.id,
					business_id: connection.business_id,
					platform_id: connection.platform_id,
					external_id: id,
					applicant_id: result.data.client_user_id as UUID,
					status: convertedStatus,
					meta: result.data,
					template_id: idvTemplates.find(t => t.template_id === result.data.template.id)?.id || null,
					shareable_url: result.data.shareable_url
				};

				this.ENCRYPTED_PROPERTIES["request_response"].forEach(key => {
					egg.meta = this.encryptNestedProperty(egg.meta, key);
				});
				logger.info(
					{ taskId: task.id, plaidIdvId: id, status: egg.status },
					"PlaidIdv.getIdvStatusFromPlaid: Saving to database"
				);
				const savedIdv = await this.saveIdvResponse(egg, task.id);

				// Save document S3 keys to the documents table
				if (storedS3Keys.original_front || storedS3Keys.original_back) {
					logger.info(
						{ taskId: task.id, identityVerificationId: savedIdv.id },
						"PlaidIdv.getIdvStatusFromPlaid: Saving document keys"
					);
					await PlaidIdv.saveDocumentKeys(savedIdv.id, storedS3Keys);
				}
				logger.info({ taskId: task.id, plaidIdvId: id }, "PlaidIdv.getIdvStatusFromPlaid: Saving to request_response");
				PlaidIdv.saveRawResponseToDB(
					egg,
					connection.business_id,
					task,
					connection.platform_id,
					"fetch_identity_verification"
				);

				if (egg.status === IDV_STATUS.FAILED || egg.status === IDV_STATUS.CANCELED) {
					const message = { case_id: "", integration_category: "Identity Verification" };
					const connection = this.getDBConnection();
					if (connection) {
						const row = await db("public.data_cases")
							.select(db.raw("public.data_cases.id as case_id"))
							.join(
								"integrations.data_business_integrations_tasks",
								"integrations.data_business_integrations_tasks.business_score_trigger_id",
								"public.data_cases.score_trigger_id"
							)
							.where("integrations.data_business_integrations_tasks.id", task.id)
							.limit(1)
							.first();
						if (row && row.case_id) {
							message.case_id = row.case_id;
						}
					}
					if (message.case_id) {
						await producer.send({
							topic: kafkaTopics.CASES,
							messages: [
								{
									key: egg.business_id,
									value: {
										event: kafkaEvents.INTEGRATION_TASK_FAILED,
										...message
									}
								}
							]
						});
					}
				}
				logger.info(
					{ taskId: task.id, plaidIdvId: id, status: egg.status },
					"PlaidIdv.getIdvStatusFromPlaid: Completed successfully"
				);
				return result.data;
			} else {
				logger.error(
					{ taskId: task.id, plaidIdvId: id, hasResult: !!result, hasData: !!result?.data },
					"PlaidIdv.getIdvStatusFromPlaid: No data in response"
				);
			}
		} else {
			logger.error({ taskId: task.id, plaidIdvId: id }, "PlaidIdv.getIdvStatusFromPlaid: No connection");
		}
		logger.error({ taskId: task.id, plaidIdvId: id }, "PlaidIdv.getIdvStatusFromPlaid: Failed to get status");
		throw new Error("Could not get idv status");
	}

	async saveIdvResponse<T = any>(
		idvStatus: IIdentityVerification<T> | IIdentityVerificationEgg,
		taskId?: UUID
	): Promise<IIdentityVerification<T>> {
		const idv = await db<IIdentityVerification<T>>("integration_data.identity_verification")
			.insert(idvStatus as IIdentityVerification<T>)
			.returning("*")
			.onConflict(["business_id", "platform_id", "external_id", "business_integration_task_id"])
			.merge({
				applicant_id: db.raw("excluded.applicant_id"),
				status: db.raw("excluded.status"),
				meta: db.raw("excluded.meta"),
				updated_at: db.raw("now()")
			});
		if (taskId) {
			await db<IBusinessIntegrationTask>("integrations.data_business_integrations_tasks")
				.where({ id: taskId })
				.update({
					metadata: db.raw(
						`jsonb_set(
						COALESCE(metadata::jsonb, '{}'::jsonb),
						'{plaidResponse}',
						?
					  )`,
						[JSON.stringify(idvStatus.meta)]
					)
				});
		}
		return idv[0];
	}

	/**
	 * Saves document S3 keys to the identity_verification record
	 * Keys are stored as JSONB: { "front": "s3/key", "back": "s3/key", ... }
	 */
	static async saveDocumentKeys(
		identityVerificationId: UUID,
		keys: { original_front?: string; original_back?: string }
	): Promise<void> {
		const s3Keys: Record<string, string> = {};

		if (keys.original_front) {
			s3Keys.front = keys.original_front;
		}
		if (keys.original_back) {
			s3Keys.back = keys.original_back;
		}

		if (Object.keys(s3Keys).length > 0) {
			await db("integration_data.identity_verification").where("id", identityVerificationId).update({
				document_s3_keys: s3Keys,
				documents_uploaded_at: new Date()
			});
		}
	}

	static async getVerificationForBusinessOwners(businessID: UUID) {
		const owners = await getOwnersUnencrypted(businessID);
		if (!owners || !owners.length) {
			throw new VerificationApiError(`No owners found!`, StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
		}

		for (let i = 0; i < owners.length; i++) {
			const applicantId = owners[i].id;
			const record = await PlaidIdv.getLatestLocalIdentityVerificationRecordsForApplicant(applicantId);
			if (record && record.meta?.kyc_check) {
				owners[i].kyc_check = record.meta?.kyc_check;
				// If we ran ID Number && it shows a match, we need to check to see if it needs to be overridden
				if (owners[i].kyc_check?.id_number?.summary === "match") {
					const syntheticRiskScore =
						record.meta?.risk_check?.identity_abuse_signals?.synthetic_identity?.score ?? undefined;
					owners[i].kyc_check.id_number.summary = PlaidIdv.getSSNVerificationStatus(
						owners[i].kyc_check.id_number.summary,
						syntheticRiskScore
					);
				}

				// pull out the relevant risk assessment data for the response
				owners[i].risk_check_result = PlaidIdv.buildApplicantRiskCheckResult(record.meta);
				owners[i].identity_verification_attempted = true;
			} else {
				owners[i].kyc_check = { status: "failed" };
				owners[i].identity_verification_attempted = false;
			}
		}
		return owners;
	}

	/*
		Override from the base class
		In this case, the handler for a task is just a method with the task code as its name
	*/
	public async processTask({
		taskId,
		task
	}: {
		taskId?: UUID;
		task?: IBusinessIntegrationTaskEnriched;
	}): Promise<IBusinessIntegrationTaskEnriched> {
		logger.info({ taskId, hasTask: !!task }, "PlaidIdv.processTask: Starting");
		if (taskId && !task) {
			task = await TaskManager.getEnrichedTask(taskId);
			logger.info({ taskId, taskStatus: task?.task_status }, "PlaidIdv.processTask: Fetched task by ID");
		}
		if (!task) {
			logger.error({ taskId }, "PlaidIdv.processTask: Could not fetch task");
			throw new Error(`Could not fetch task ${taskId}`);
		}
		logger.info(
			{
				taskId: task.id,
				taskStatus: task.task_status,
				taskCode: task.task_code,
				pendingStatuses: TaskManager.PENDING_TASK_STATUSES
			},
			"PlaidIdv.processTask: Checking pending status"
		);
		if (!TaskManager.PENDING_TASK_STATUSES.includes(task.task_status)) {
			logger.warn({ taskId: task.id, taskStatus: task.task_status }, "PlaidIdv.processTask: Task not in pending state");
			throw new Error("Task is not in a pending state");
		}
		const taskCode = task.task_code;
		const handler = this[taskCode];
		if (!handler || typeof handler !== "function") {
			logger.error({ taskId: task.id, taskCode }, "PlaidIdv.processTask: No handler found");
			this.updateTaskStatus(task.id, TASK_STATUS.FAILED, {
				error: `No task handler is defined for ${taskCode} for platform ${this.getPlatform()}`
			});
			throw new Error(`No handler for task`);
		}
		logger.info({ taskId: task.id, taskCode }, "PlaidIdv.processTask: Executing handler");
		try {
			//we need to call the method with bind(this) to keep the "this" context of the class
			await handler.bind(this)(task);
			logger.info({ taskId: task.id, taskCode }, "PlaidIdv.processTask: Handler completed");
		} catch (error: any) {
			logger.error(
				{ taskId: task.id, taskCode, error: error instanceof Error ? error.message : String(error) },
				"PlaidIdv.processTask: Handler error"
			);
			if (error instanceof AxiosError) {
				await this.updateTaskStatus(task.id, TASK_STATUS.FAILED, { error: error.response?.data });
			} else {
				await this.updateTaskStatus(task.id, TASK_STATUS.FAILED, { error: error.message });
			}
		} finally {
			const completedTask = await TaskManager.getEnrichedTask(task.id as UUID);
			logger.info({ taskId: task.id, finalStatus: completedTask?.task_status }, "PlaidIdv.processTask: Completed");
			await this.sendTaskCompleteMessage(completedTask);
			return completedTask;
		}
	}

	/**
	 * Return a new calculated ssn verification status enum if the synthetic risk score is greater than the defined threshold
	 * @param ssnVerificationStatus - The current status of the SSN verification
	 * @param syntheticRiskScore - The synthetic risk score
	 * @returns Either "no_match" if greater than or equal to the threshold, or the original status if less than the threshold
	 */
	private static getSSNVerificationStatus(
		ssnVerificationStatus: "match" | "no_match" | string | undefined,
		syntheticRiskScore: number | undefined
	): "match" | "no_match" | string | undefined {
		// Anything greater than this risk score will override ssn verification status to 'no_match'
		const SYNTHETIC_RISK_SCORE_THRESHOLD = 60;

		const isRiskScoreTooHigh =
			typeof syntheticRiskScore === "number" &&
			!Number.isNaN(syntheticRiskScore) &&
			syntheticRiskScore >= SYNTHETIC_RISK_SCORE_THRESHOLD;
		return isRiskScoreTooHigh ? "no_match" : ssnVerificationStatus;
	}

	private decrypt<T extends Object>(type: keyof typeof this.ENCRYPTED_PROPERTIES, input: T): T {
		const obj = { ...input };
		this.ENCRYPTED_PROPERTIES[type].forEach(key => {
			if (obj.hasOwnProperty(key) && obj[key]) {
				obj[key] = decryptData(obj[key]);
			}
		});
		return obj;
	}

	private async getSDKRouting(): Promise<SDKRoutingFeatureFlag | null> {
		const sdkRouting = await getFlagValue<SDKRoutingFeatureFlag>(FEATURE_FLAGS.SDK_IDV_ROUTING, null, false);
		if (sdkRouting && Object.keys(sdkRouting).length > 0) {
			return sdkRouting as SDKRoutingFeatureFlag;
		}
		return null;
	}

	private parseRegEx(value: string): RegExp | null {
		try {
			if (!value.startsWith("/")) return null;
			const lastSlash = value.lastIndexOf("/");
			if (lastSlash === 0) return null;

			const pattern = value.slice(1, lastSlash);
			const flags = value.slice(lastSlash + 1);
			return new RegExp(pattern, flags);
		} catch {
			return null;
		}
	}
	/**
	 * Extracts a template ID to use based on attributes of the given owner.
	 *
	 * The `SDKRoutingOption` configuration is evaluated in the order of its keys as
	 * returned by `Object.entries(SDKRoutingOption)`. For each key that also exists
	 * on `ownerInfo`, the corresponding owner field value is converted to a string
	 * and tested against each entry in the mapping for that key.
	 *
	 * For every mapping entry, the mapping key is first interpreted as a regular
	 * expression, using the `/pattern/flags` format (for example: `"/^US$/"` or
	 * `"/^\\+1\\d{10}$/i"`). If the value is a valid regex and it matches the
	 * owner field value, the associated template ID is returned. If the value is
	 * not a valid regex or does not match, a simple string equality check is
	 * performed between the owner field value and the mapping key. The first match
	 * found (regex or exact string) is returned. If no mappings match, `undefined`
	 * is returned.
	 *
	 * @param ownerInfo - The owner information object whose fields are used to
	 * determine the appropriate template ID.
	 * @param SDKRoutingOption - The routing configuration mapping owner field names
	 * to value tests (regex or string) and their associated template IDs.
	 * @returns The first matching template ID, or `undefined` if no match is found.
	 */
	private extractTemplateForOwner(ownerInfo: OwnerWithRel, SDKRoutingOption: SDKRoutingOption): string | undefined {
		for (const [key, templateEvaluation] of Object.entries(SDKRoutingOption)) {
			if (key in ownerInfo) {
				const ownerValue = (ownerInfo as any)[key] as unknown;
				if (ownerValue === null || ownerValue === undefined) continue;

				const ownerValueStr = String(ownerValue);
				for (const [valueTest, templateId] of Object.entries(templateEvaluation)) {
					const regex = this.parseRegEx(valueTest);
					if (regex && regex.test(ownerValueStr)) {
						return templateId;
					}
					if (ownerValueStr === String(valueTest)) {
						return templateId;
					}
				}
			}
		}
	}

	/**
	 * Get the template ID for the IDV request from the connection configuration
	 * @param ownerInfo
	 * @param task
	 * @returns The template ID for the IDV request
	 */
	private async getTemplateId(ownerInfo: OwnerWithRel, task: IBusinessIntegrationTaskEnriched): Promise<string> {
		const customerId = task?.customer_id;
		if (customerId) {
			const sdkRouting = await this.getSDKRouting();
			if (sdkRouting?.[customerId]) {
				const templateId = this.extractTemplateForOwner(ownerInfo, sdkRouting[customerId]);
				if (templateId) {
					return templateId;
				}
			}
		}

		// Fall through to the old logic!
		const connection = this.getDBConnection();
		const ownerCountry = convertWorthToPlaid<"country">("country", ownerInfo.address_country || "US", true) as string;
		const idNumber = this.generateIDNumber(ownerInfo, ownerCountry);
		if (!idNumber?.type && connection?.configuration?.background_verification_only) {
			return connection.configuration?.fallback_template_id as string;
		}
		return connection?.configuration?.template_id as string;
	}

	/**
	 * Generate a Plaid UserIDNumber object for the IDV request
	 * @param ownerInfo - The owner information
	 * @param countryCode - The country code of the owner
	 * @returns The ID number for the IDV request
	 */
	private generateIDNumber(ownerInfo: Owner, countryCode: string): UserIDNumber | null {
		try {
			if (ownerInfo.ssn) {
				let plainNumber = ownerInfo.ssn;
				try {
					plainNumber = decryptData(ownerInfo.ssn) ?? ownerInfo.ssn;
				} catch (ex) {
					// swallow exception, couldn't decrypt the SSN likely fine -- decryptData will log its own context etc
				}
				const digits = String(plainNumber).replace(/\D/g, "");
				// Padded last-4 (e.g. 000002335): send last 4 as UsSsnLast4 for Plaid
				if (countryCode === "US" && digits.length === 9 && digits.startsWith("00000")) {
					return { value: digits.slice(-4), type: IDNumberType.UsSsnLast4 };
				}
				// If we have a hardcoded ID Number Type for a country code use it, otherwise use the first ID Number Type from the input validation
				const inputValidation = getInputValidationForCountry(countryCode);
				const idNumberType = findIDNumberType(plainNumber, inputValidation!);
				if (idNumberType) {
					return { value: plainNumber, type: idNumberType as IDNumberType };
				}
			}
			// Handle if this is just a last 4 of SSN for US
			if (ownerInfo.last_four_of_ssn && countryCode === "US" && ownerInfo.last_four_of_ssn.toString().length === 4) {
				return { value: ownerInfo.last_four_of_ssn.toString(), type: IDNumberType.UsSsnLast4 };
			}
		} catch (ex) {
			logger.error(ex, `Could not generate ID number for ownerId: ${ownerInfo.id}`);
		}
		return null;
	}

	/**
	 * Sanitize a phone number to Plaid's expected format
	 * @param phoneNumber - The phone number to sanitize
	 * @returns The sanitized phone number or null if the phone number is invalid
	 */
	private sanitizePhoneNumber(phoneNumber: string): string | null {
		try {
			// Get rid of all non-numeric characters and then prefix the string with a + if it already starts with a +
			if (phoneNumber.startsWith("+")) {
				phoneNumber = phoneNumber.replace(/[^0-9]/g, "").replace(/^/, "+");
			}
			// truncate to a max of 15 characters
			phoneNumber = phoneNumber.length > 15 ? phoneNumber.slice(0, 15) : phoneNumber;
			return verifyAndFormatNumber(phoneNumber);
		} catch (ex) {
			logger.warn(`Could not verify and format phone number ${phoneNumber}`);
		}
		return null;
	}

	private sanitizeAddress(ownerInfo: Owner, ownerCountry: string): UserAddress {
		return {
			street: ownerInfo.address_line_1?.toUpperCase(),
			street2: ownerInfo.address_line_2?.toUpperCase() ?? ownerInfo.address_apartment?.toUpperCase() ?? null,
			city: ownerInfo.address_city?.toUpperCase(),
			region: (convertWorthToPlaid("states", ownerInfo.address_state ?? undefined, true) as string) || null,
			postal_code: formatPostalCode(ownerInfo.address_postal_code, ownerCountry) ?? ownerInfo.address_postal_code,
			country: ownerCountry
		};
	}

	/**
	 * Generates the request objectfor the identity verification.
	 * @param ownerInfo - The owner information.
	 * @param task - The (optional) task information.
	 * @returns The request for the identity verification.
	 */
	private async generateRequest(
		ownerInfo: OwnerWithRel,
		task: IBusinessIntegrationTaskEnriched
	): Promise<IdentityVerificationCreateRequest> {
		const connection: IDBConnection | undefined = this.getDBConnection();
		if (!connection) {
			throw new Error("Object not properly initialized with a connection reference");
		}
		try {
			if (!ownerInfo.first_name || !ownerInfo.last_name || !ownerInfo.address_line_1 || !ownerInfo.address_city) {
				throw new Error("Owner info is missing required fields");
			}

			const templateId = await this.getTemplateId(ownerInfo, task);

			if (this.isPassThrough(ownerInfo)) {
				return this.getMockedIdentityVerificationCreateRequest(ownerInfo, templateId);
			}

			const ownerCountry = convertWorthToPlaid<"country">("country", ownerInfo.address_country || "US", true) as string;
			const idNumber = this.generateIDNumber(ownerInfo, ownerCountry);
			const phoneNumber = this.sanitizePhoneNumber(ownerInfo.mobile?.toString() ?? "");
			const sanitizedAddress = this.sanitizeAddress(ownerInfo, ownerCountry);

			let request: IdentityVerificationCreateRequest = {
				client_user_id: ownerInfo.id,
				is_shareable: true,
				is_idempotent: true,
				template_id: templateId,
				gave_consent: true,
				user: {
					email_address: (ownerInfo.email as string) || undefined,
					date_of_birth: ownerInfo.date_of_birth || undefined,
					name: { given_name: ownerInfo.first_name, family_name: ownerInfo.last_name },
					address: sanitizedAddress,
					id_number: idNumber,
					phone_number: phoneNumber ?? PlaidIdv.DEFAULT_PHONE_NUMBER
				}
			};

			const originalCreateRequest = structuredClone(request);

			// Apply IDV sanitization by default
			try {
				request = constrainInput(request);
			} catch (ex) {
				logger.error(ex, `Could not constrain IDV inputs due to exception`);
			}
			// If running in a customer context, check if we have a flag to bypass IDV sanitization
			if (await this.isIdvSanitizationDisabled(task?.customer_id ?? null)) {
				logger.info(`IDV Sanitization is disabled for customer: ${task?.customer_id}`);
				// Restore original unconstrained inputs if the flag is enabled
				Object.assign(request, originalCreateRequest);
			}

			return request;
		} catch (ex) {
			logger.error(ex, `Could not generate request for ownerId: ${ownerInfo.id}`);
			throw ex;
		}
	}

	private async isIdvSanitizationDisabled(customerID: UUID | null): Promise<boolean> {
		const customerContext: LDContext | null = customerID
			? { key: "customer", kind: "customer", customer_id: customerID }
			: null;
		const isIdvSanitizationDisabled: boolean =
			(await getFlagValue(FEATURE_FLAGS.BEST_91_DISABLE_IDV_SANITIZATION, customerContext, false)) ?? false;
		return isIdvSanitizationDisabled;
	}
	private encryptNestedProperty(input: any, targetKey: string): any {
		const obj = { ...input };
		for (const key in obj) {
			if (obj.hasOwnProperty(key)) {
				if (key === targetKey) {
					// Only encrypt if the value is a primitive (string, number) and not an object
					if (typeof obj[key] === "string" || typeof obj[key] === "number") {
						logger.debug(`Encrypting ${key} from ${obj[key]}`);
						obj[key] = encryptData(obj[key]);
					}
				} else if (typeof obj[key] === "object" && obj[key] !== null) {
					obj[key] = this.encryptNestedProperty(obj[key], targetKey);
				}
			}
		}
		return obj;
	}
}
