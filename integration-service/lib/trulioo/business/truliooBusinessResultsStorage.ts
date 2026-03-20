import { TruliooBase } from "../common/truliooBase";
import { TruliooKYBFormData, TruliooFlowResult, TruliooScreenedPersonData, TruliooTask, TruliooBusinessData, TruliooUBO, TruliooDirector } from "../common/types";
import type { IRequestResponse, IBusinessEntityRegistration, IBusinessEntityAddressSource, IBusinessEntityName, IBusinessEntityPerson, IBusinessEntityReviewTask } from "#types/db";
import { randomUUID, createHash, type UUID } from "crypto";
import type { IntegrationPlatformId } from "#constants";
import { logger } from "#helpers/logger";
import { db } from "#helpers/knex";
import { VerificationApiError } from "#api/v1/modules/verification/error";
import { StatusCodes } from "http-status-codes";
import { ERROR_CODES } from "#constants";
import { ITruliooUBOExtractor } from "./types";
import type { IBusinessEntityVerification } from "#types/db";
import { isTruliooCompletedStatus, extractFieldFromTruliooServiceData, extractStandardizedLocationsFromTruliooResponse, extractIncorporationDateFromTrulioo , convertToUUIDFormat ,
	generateDeterministicUUID,
	extractAddressMatchStatusFromDatasourceFields,
	sanitizeTruliooLabelsFromPayload
} from "../common/utils";
import { shouldScreenPSCsForBusiness } from "../common/pscScreeningHelpers";
import { storeBusinessWatchlistResults } from "./truliooWatchlist";
import { processAndPersistTruliooAdverseMedia } from "../common/truliooAdverseMediaProcessor";

/**
 * Parse Trulioo FullAddress format into address components
 * Format example: "220 Victoria Street 1107 Toronto ON CA M5B 2R6"
 * @param fullAddress - Full address string from Trulioo
 * @returns Object with address components
 */
function parseFullAddress(fullAddress: string): Partial<TruliooDirector> {
	try {
		const parts = fullAddress.trim().split(/\s+/);

		// Last part is postal code (e.g., "M5B" or "2R6" or "M5B 2R6")
		const postalCodeParts: string[] = [];
		while (parts.length > 0 && /^[A-Z0-9]{3}$/i.test(parts[parts.length - 1])) {
			postalCodeParts.unshift(parts.pop()!);
			if (postalCodeParts.length >= 2) break;
		}
		const postalCode = postalCodeParts.join(" ");

		// Second-to-last is country code (CA, US, etc)
		const country = parts.pop();

		// Third-to-last is state/province (ON, BC, etc)
		const state = parts.pop();

		// Fourth-to-last is city
		const city = parts.pop();

		// Everything else is address line 1
		const addressLine1 = parts.join(" ");

		return {
			addressLine1: addressLine1 || undefined,
			city: city || undefined,
			state: state || undefined,
			country: country || undefined,
			postalCode: postalCode || undefined
		};
	} catch (error) {
		logger.warn(error, `Failed to parse fullAddress: ${fullAddress}`);
		return {};
	}
}

export class TruliooBusinessResultsStorage {
	private truliooBase: TruliooBase;
	private uboExtractor: ITruliooUBOExtractor;

	constructor(truliooBase: TruliooBase, uboExtractor: ITruliooUBOExtractor) {
		this.truliooBase = truliooBase;
		this.uboExtractor = uboExtractor;
	}

	/**
	 * Create an initial "placeholder" verification record before calling Trulioo.
	 * This ensures the webhook can find the business_id when it arrives (handles race conditions).
	 */
	async storeInitialVerificationRecord(
		taskId: string,
		businessPayload: TruliooKYBFormData,
		hfSession: string
	): Promise<void> {
		try {
			// For non-Trulioo IDs (like US-AUTO-...), generate a deterministic UUID
			// For Trulioo IDs (24 chars), use the existing conversion logic
			const uuidFormattedExternalId =
				hfSession.length === 24 ? convertToUUIDFormat(hfSession) : generateDeterministicUUID(hfSession);

			logger.info(`Storing initial KYB verification record for business ${this.truliooBase["businessID"]}, hfSession: ${hfSession}`);

			const initialRecord: Partial<IBusinessEntityVerification> = {
				business_id: this.truliooBase["businessID"],
				external_id: uuidFormattedExternalId as UUID,
				business_integration_task_id: taskId as UUID,
				name: businessPayload.companyName,
				status: "in_progress",
				unique_external_id: uuidFormattedExternalId as UUID
			};

			await db<IBusinessEntityVerification>("integration_data.business_entity_verification")
				.insert(initialRecord)
				.onConflict(["external_id"])
				.ignore();

		} catch (error: unknown) {
			logger.error(error, `Error storing initial KYB verification record for task ${taskId}:`);
		}
	}

	async storeBusinessVerificationResults(
		taskId: string,
		businessPayload: TruliooKYBFormData,
		flowResult: TruliooFlowResult
	): Promise<void> {
		try {
			logger.info(`Storing business verification results for task: ${taskId}`);

			const clientData = flowResult.clientData || {};
			const hfSession = flowResult.hfSession;

			let status = "open";
			const isCompletedStatus = isTruliooCompletedStatus(clientData.status);

			if (isCompletedStatus) {
				status = "approved";
			} else if (clientData.status === "failed" || clientData.status === "error" || clientData.status === "REJECTED") {
				status = "rejected";

				// Log detailed rejection information for debugging
				logger.warn({
					businessID: this.truliooBase["businessID"],
					status: clientData.status,
					reason: clientData.reason || "No reason provided",
					details: clientData,
					businessPayload: businessPayload
				}, `🚨 TRULIOO VERIFICATION REJECTED for business ${this.truliooBase["businessID"]}`);
			} else if (clientData.status === "pending" || clientData.status === "in_progress") {
				status = "in_review";
			}

			const truliooExternalId = clientData.external_id || hfSession || "";
			if (!truliooExternalId) {
				throw new Error("Missing external_id and hfSession from Trulioo response");
			}

			// For non-Trulioo IDs (like US-AUTO-...), generate a deterministic UUID
			// For Trulioo IDs (24 chars), use the existing conversion logic
			const uuidFormattedExternalId =
				truliooExternalId.length === 24
					? convertToUUIDFormat(truliooExternalId)
					: generateDeterministicUUID(truliooExternalId);

			logger.info(`Trulioo external_id: ${truliooExternalId}, UUID formatted: ${uuidFormattedExternalId}`);

			const businessVerificationRecord: Partial<IBusinessEntityVerification> = {
				business_id: this.truliooBase["businessID"],
				external_id: uuidFormattedExternalId as UUID,
				business_integration_task_id: taskId as UUID,
				name: businessPayload.companyName,
				status: status,
				tin: null,
				unique_external_id: uuidFormattedExternalId as UUID
			};

			// Use onConflict.merge() instead of .ignore() so that when the webhook fires
			// with the final status (e.g. "approved"), the existing record (which may have
			// been created during the initial flow with status "in_review") gets updated.
			const insert = await db<IBusinessEntityVerification>("integration_data.business_entity_verification")
				.insert(businessVerificationRecord)
				.onConflict(["external_id"])
				.merge({
					status: db.raw("EXCLUDED.status"),
					business_integration_task_id: db.raw("EXCLUDED.business_integration_task_id"),
					name: db.raw("EXCLUDED.name"),
				})
				.returning("*");

			const businessEntityVerificationId: UUID | undefined = insert[0]?.id;

			logger.info(`Business verification record stored: ${businessEntityVerificationId || "existing record"}`);

			if (businessEntityVerificationId) {
				await this.upsertBusinessEntityNames(
					businessPayload,
					businessEntityVerificationId,
					clientData?.status
				);
			}

			await this.storeRawTruliooResponse(hfSession || "", flowResult, taskId);

			// Store registration data first to get registrationExternalId for address association
			let registrationExternalId: UUID | undefined = undefined;
			if (businessEntityVerificationId && clientData) {
				registrationExternalId = await this.storeRegistrationData(
					businessEntityVerificationId,
					businessPayload,
					clientData
				);
				// Store people data directly from Trulioo response (following Middesk pattern)
				await this.upsertBusinessEntityPeople(
					businessEntityVerificationId,
					clientData.businessData,
					clientData.watchlistResults
				);
			}

			// Store address data after registration to associate reported addresses with SOS registration
			// Submitted address comes from businessPayload (user input), reported addresses from serviceData (StandardizedLocations)
			if (businessEntityVerificationId) {
				await this.storeAddressData(
					businessEntityVerificationId,
					businessPayload,
					clientData,
					clientData?.status,
					registrationExternalId
				);
			}

			if (businessEntityVerificationId && clientData.watchlistResults !== undefined) {
				const watchlistHits = Array.isArray(clientData.watchlistResults) ? clientData.watchlistResults : [];
				const businessName = businessPayload.companyName || "Unknown Business";
				logger.info({
					businessEntityVerificationId,
					watchlistHitsCount: watchlistHits.length
				}, `Processing watchlist results for business verification ${businessEntityVerificationId}`);
				await storeBusinessWatchlistResults(businessEntityVerificationId, businessName, watchlistHits);

				// Post-process: extract ADVERSE_MEDIA hits, score with OpenAI, persist in adverse_media_articles
				try {
					const { adverseMedia } = await import("#api/v1/modules/adverse-media/adverse-media");
					await processAndPersistTruliooAdverseMedia({
						watchlistHits,
						businessId: this.truliooBase["businessID"],
						taskId,
						entityNames: [businessName],
						individuals: [],
						deps: {
							scoreAdverseMedia: adverseMedia.scoreAdverseMedia.bind(adverseMedia),
							insertAdverseMedia: adverseMedia.insertAdverseMedia.bind(adverseMedia)
						}
					});
				} catch (error) {
					logger.error({ err: error, businessId: this.truliooBase["businessID"] }, "Error processing Trulioo adverse media for business");
				}
			}

			// UBO extraction and screening (additional process - people are already stored directly from response above)
			// This extracts UBOs/Directors and automatically screens them via PSC flow
			if (status === "approved" && clientData && businessEntityVerificationId) {
				const businessCountry = businessPayload.companyCountryIncorporation || "";

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
				// This flag determines extraction strategy:
				// - Standard flow: Use only explicitly returned owners (ubos/directors) + applicant flow
				// - Advanced Watchlists: Extract from StandardizedDirectorsOfficers + Middesk + applicant flow
				const isUS = businessCountry?.toUpperCase().trim() === "US" || businessCountry?.toUpperCase().trim() === "USA";
				const advancedWatchlistsEnabled = isUS && shouldScreen;

				// Extract directors/officers based on flow type (Advanced Watchlists vs Standard Flow)
				const { extractDirectorsForPSCScreening } = await import("./directorsExtractionHelpers");
				const directors = await extractDirectorsForPSCScreening({
					clientData,
					businessData: clientData.businessData,
					businessState: businessPayload.companyState || "",
					advancedWatchlistsEnabled,
					parseFullAddress // Include address parsing for this context
				});

				// Create businessData object with directors
				const businessData: TruliooBusinessData = {
					...clientData.businessData,
					directors: directors && directors.length > 0 ? directors : undefined,
					// Keep ubos as-is (explicitly returned by Trulioo)
					name: businessPayload.companyName,
					country: businessPayload.companyCountryIncorporation,
					state: businessPayload.companyStateAddress,
					city: businessPayload.companyCity,
					postalCode: businessPayload.companyZip
				};

				const screenedPeople = await this.uboExtractor.extractAndScreenUBOsDirectors(
					businessEntityVerificationId,
					businessData,
					flowResult,
					undefined, // taskId
					advancedWatchlistsEnabled
				);
				logger.info(`Business verification completed with ${screenedPeople.length} people screened automatically`);
			}
		} catch (error: unknown) {
			logger.error(error, `Error storing business verification results:`);

			if (error instanceof VerificationApiError) {
				throw error;
			}
			throw new VerificationApiError(
				`Failed to store business verification results: ${error instanceof Error ? error.message : "Unknown error"}`,
				StatusCodes.BAD_REQUEST,
				ERROR_CODES.INVALID
			);
		}
	}

	private async storeRawTruliooResponse(
		hfSession: string,
		flowResult: TruliooFlowResult,
		taskId: string
	): Promise<void> {
		try {
			const rawResponseData = sanitizeTruliooLabelsFromPayload({
				hfSession,
				flowData: flowResult.flowData,
				submitResponse: flowResult.submitResponse,
				clientData: flowResult.clientData,
				timestamp: new Date().toISOString(),
				flowType: "KYB"
			});

			const uuidFormattedSession = convertToUUIDFormat(hfSession);
			const { TaskManager } = await import("#api/v1/modules/tasks/taskManager");
			const task = await TaskManager.getEnrichedTask(taskId as UUID);

			await this.saveRequestResponse(task as unknown as TruliooTask, rawResponseData, uuidFormattedSession);

			logger.info(`Raw Trulioo response stored for session: ${hfSession}`);
		} catch (error: unknown) {
			logger.error(error, `Error storing raw Trulioo response: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	private async saveRequestResponse<T extends object = object>(
		task: TruliooTask,
		input: T,
		externalId: string
	): Promise<IRequestResponse> {
		const insertedRecord = await db<IRequestResponse>("integration_data.request_response")
			.insert({
				request_id: task.id as UUID,
				business_id: task.business_id as UUID,
				platform_id: task.platform_id as IntegrationPlatformId,
				external_id: externalId,
				request_type: task.task_code as string,
				request_code: task.task_code as string,
				connection_id: task.connection_id as UUID,
				response: JSON.stringify(input),
				request_received: db.raw("now()")
			})
			.onConflict("request_id")
			.merge()
			.returning("*");

		return insertedRecord[0];
	}

	private async upsertBusinessEntityNames(
		businessPayload: TruliooKYBFormData,
		businessEntityVerificationId: UUID,
		clientDataStatus?: string
	): Promise<void> {
		try {
			const names: IBusinessEntityName[] = [];

			if (businessPayload.companyName) {
				names.push({
					business_entity_verification_id: businessEntityVerificationId,
					name: businessPayload.companyName,
					submitted: true,
					source: JSON.stringify({ provider: "trulioo", source: "form_data" }),
					type: "legal",
					metadata: JSON.stringify({ provider: "trulioo", source: "form_data", field: "companyName" })
				} as IBusinessEntityName);
			}

			if (names.length === 0) {
				logger.warn(`No business names found to store for business entity verification ${businessEntityVerificationId}`);
				return;
			}

			const inserted = await db<IBusinessEntityName>("integration_data.business_entity_names")
				.insert(names)
				.returning("*")
				.onConflict(["business_entity_verification_id", "name"])
				.merge();

			logger.info(`Upserted ${inserted.length} name record(s) for business entity verification id: ${businessEntityVerificationId}`);

			// Only create business name review task when we have a definitive result.
			// When status is IN_PROGRESS/pending, the review task will be created later by the webhook.
			if (inserted.length > 0) {
				if (this.isDefinitiveResult(clientDataStatus)) {
					const taskStatus = this.deriveTaskStatus(clientDataStatus);
					await this.createReviewTask(
						businessEntityVerificationId,
						"name",
						"name",
						taskStatus,
						"Business Name",
						taskStatus === "success" ? "Verified" : "Unverified"
					);
				} else {
					logger.info(`Skipping name review task creation for verification ${businessEntityVerificationId}: status "${clientDataStatus}" is not a definitive result (will be set by webhook)`);
				}
			}
		} catch (error: unknown) {
			logger.error(error, `Error storing business entity names: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	private async storeRegistrationData(
		businessEntityVerificationId: UUID,
		businessPayload: TruliooKYBFormData,
		clientData?: TruliooFlowResult["clientData"]
	): Promise<UUID | undefined> {
		try {
			const registrationNumber = clientData ? extractFieldFromTruliooServiceData(clientData, "BusinessRegistrationNumber") : undefined;
			const incorporationDate = clientData ? extractIncorporationDateFromTrulioo(clientData) : undefined;
			const entityType = clientData ? extractFieldFromTruliooServiceData(clientData, "BusinessLegalForm") : undefined;

			// If we don't have at least a registration number, skip storing registration
			if (!registrationNumber && !incorporationDate && !entityType) {
				logger.debug("No registration data available from Trulioo - skipping registration storage");
				return undefined;
			}

			// The relationship to the verification is maintained via business_entity_verification_id
			// Reuse existing registration external_id if present
			const existingRegistration = await db<IBusinessEntityRegistration>("integration_data.business_entity_registration")
				.where({ business_entity_verification_id: businessEntityVerificationId })
				.first();
			const registrationExternalId = existingRegistration?.external_id || randomUUID();

			// Parse incorporation date safely
			let registrationDate: string | undefined = undefined;
			if (incorporationDate && typeof incorporationDate === "string") {
				try {
					const date = new Date(incorporationDate);
					if (!isNaN(date.getTime())) {
						registrationDate = date.toISOString();
					}
				} catch (e) {
					logger.warn({ incorporationDate }, "Invalid incorporation date format");
				}
			}

			// Ensure entityType and registrationNumber are strings
			const entityTypeStr = typeof entityType === "string" ? entityType : undefined;
			const registrationNumberStr = typeof registrationNumber === "string" ? registrationNumber : undefined;
			const name = businessPayload.companyName;
			const jurisdiction = businessPayload.companyCountryIncorporation;
			const registrationState = businessPayload.companyState;
			// Build registration record, only including fields with values
			// Following the same pattern as Middesk - omit undefined fields instead of setting them
			const registrationRecord: Partial<IBusinessEntityRegistration> = {
				business_entity_verification_id: businessEntityVerificationId,
				external_id: registrationExternalId as UUID,
				name: name,
				source: JSON.stringify({ provider: "trulioo" })
			};

			// Only include optional fields if they have values
			if (entityTypeStr) {
				registrationRecord.entity_type = entityTypeStr;
			}
			if (registrationNumberStr) {
				registrationRecord.file_number = registrationNumberStr;
			}
			if (jurisdiction) {
				registrationRecord.jurisdiction = jurisdiction;
			}
			if (registrationDate) {
				registrationRecord.registration_date = registrationDate;
			}
			if (registrationState) {
				registrationRecord.registration_state = registrationState;
			}

			await db<IBusinessEntityRegistration>("integration_data.business_entity_registration")
				.insert(registrationRecord)
				.onConflict(["external_id"])
				.merge()
				.returning("*");

			logger.info(
				`Registration data stored for business entity verification ${businessEntityVerificationId}: registration_number=${registrationNumber}, incorporation_date=${incorporationDate}`
			);
			return registrationExternalId as UUID;
		} catch (error: unknown) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			logger.error(error, `Error storing registration data: ${errorMessage}`);
			// Don't throw error here as this is supplementary data
		}
	}

	/**
	 * Store address data from Trulioo business verification
	 * Maps Trulioo address data to business_entity_address_source table
	 * Uses submitted address from businessPayload, and reported addresses from StandardizedLocations
	 */
	private async storeAddressData(
		businessEntityVerificationId: UUID,
		businessPayload: TruliooKYBFormData,
		clientData?: TruliooFlowResult["clientData"],
		clientDataStatus?: string,
		vendorRegistrationId?: UUID
	): Promise<void> {
		try {
			const records: Partial<IBusinessEntityAddressSource>[] = [];

			// Submitted address: from businessPayload (user input)
			// Only create one submitted address per verification (reuse existing if present)
			const existingSubmitted = await db<IBusinessEntityAddressSource>("integration_data.business_entity_address_source")
				.where({
					business_entity_verification_id: businessEntityVerificationId,
					submitted: true
				})
				.first();

			if (!existingSubmitted && (businessPayload.companyAddressFull || businessPayload.companyCity)) {
				const record = this.buildAddressRecord(businessEntityVerificationId, {
					addressLine1: businessPayload.companyAddressFull || "",
					city: businessPayload.companyCity,
					state: businessPayload.companyStateAddress || businessPayload.companyState,
					postalCode: businessPayload.companyZip,
					country: businessPayload.companyCountryIncorporation,
					submitted: true
				});
				if (record) records.push(record);
			}

			// Reported addresses from serviceData (StandardizedLocations)
			const reported = clientData
				? extractStandardizedLocationsFromTruliooResponse(clientData as Record<string, unknown>)
				: undefined;

			if (reported) {
				for (const loc of reported) {
					if (!loc.Address1 && !loc.City) continue;
					const record = this.buildAddressRecord(businessEntityVerificationId, {
						addressLine1: loc.Address1 || "",
						city: loc.City,
						state: loc.StateProvinceCode,
						postalCode: loc.PostalCode,
						country: loc.CountryCode,
						submitted: false,
						vendorRegistrationId: vendorRegistrationId
					});
					if (record) records.push(record);
				}
			}

			if (records.length > 0) {
				await db<IBusinessEntityAddressSource>("integration_data.business_entity_address_source")
					.insert(records)
					.onConflict(["external_id"])
					.merge({
						external_registration_id: db.raw("EXCLUDED.external_registration_id")
					})
					.returning("*");
				logger.info(`Address data stored for business entity verification ${businessEntityVerificationId}: ${records.length} address(es) stored`);
			}

			// Create/update the address verification review task.
			// Runs independently of new address record insertion — addresses may already exist
			// from a prior run but the review task still needs to be set when the status is definitive.
			const hasAddressSources = records.length > 0 || !!existingSubmitted;
			await this.resolveAddressVerificationTask(
				businessEntityVerificationId,
				clientData,
				clientDataStatus,
				hasAddressSources
			);
		} catch (error: unknown) {
			logger.error(error, `Error storing address data: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	/**
	 * Determine and create the address_verification review task based on Trulioo DatasourceFields.
	 *
	 * Resolution order:
	 *   1. DatasourceFields present → use Comprehensive View match/nomatch status
	 *   2. No DatasourceFields (e.g. PSC flow) → reuse result from a sibling verification
	 *   3. No sibling task either → fall back to the overall clientData status
	 *
	 * This handles the common case where a business has multiple Trulioo transactions
	 * (KYB + PSC screening) that each produce a separate verification record.
	 */
	private async resolveAddressVerificationTask(
		businessEntityVerificationId: UUID,
		clientData: TruliooFlowResult["clientData"] | undefined,
		clientDataStatus: string | undefined,
		hasAddressSources: boolean
	): Promise<void> {
		if (!hasAddressSources) {
			logger.info(`Skipping address review task for verification ${businessEntityVerificationId}: no address sources found`);
			return;
		}

		if (!this.isDefinitiveResult(clientDataStatus)) {
			logger.info(`Skipping address review task for verification ${businessEntityVerificationId}: status "${clientDataStatus}" is not definitive (will be set by webhook)`);
			return;
		}

		const addressMatchStatus = extractAddressMatchStatusFromDatasourceFields(
			clientData as Record<string, unknown> | undefined
		);

		if (addressMatchStatus === "nomatch" || addressMatchStatus === "match") {
			const taskStatus = addressMatchStatus === "match" ? "success" : "failure";
			const sublabel = taskStatus === "success" ? "Verified" : "Unverified";
			logger.info(`Address verification for ${businessEntityVerificationId}: Comprehensive View → "${addressMatchStatus}" — marking as ${sublabel}`);
			await this.createAddressVerificationTask(businessEntityVerificationId, taskStatus, sublabel);
			return;
		}

		// No DatasourceFields found (e.g. PSC screening response without KYB data).
		// Try reusing the result from a sibling verification of the same business.
		const siblingTask = await this.findSiblingAddressTask(businessEntityVerificationId);

		if (siblingTask && (siblingTask.status === "success" || siblingTask.status === "failure")) {
			logger.info(`Address verification for ${businessEntityVerificationId}: no DatasourceFields, reusing sibling task (status="${siblingTask.status}", sublabel="${siblingTask.sublabel}")`);
			await this.createAddressVerificationTask(businessEntityVerificationId, siblingTask.status, siblingTask.sublabel ?? (siblingTask.status === "success" ? "Verified" : "Unverified"));
			return;
		}

		// Last resort: derive from overall Trulioo status
		const taskStatus = this.deriveTaskStatus(clientDataStatus);
		const sublabel = taskStatus === "success" ? "Verified" : "Unverified";
		logger.info(`Address verification for ${businessEntityVerificationId}: no DatasourceFields and no sibling task, falling back to overall status "${clientDataStatus}" → ${sublabel}`);
		await this.createAddressVerificationTask(businessEntityVerificationId, taskStatus, sublabel);
	}

	/**
	 * Look for an existing address_verification review task from ANY verification
	 * of the same business. The KYB flow creates a DatasourceFields-derived task on
	 * a different verification_id, and we want to reuse that result for subsequent
	 * transactions (e.g. PSC screening) that lack DatasourceFields.
	 */
	private async findSiblingAddressTask(
		businessEntityVerificationId: UUID
	): Promise<IBusinessEntityReviewTask | undefined> {
		return db<IBusinessEntityReviewTask>("integration_data.business_entity_review_task")
			.where({ key: "address_verification" })
			.whereIn("business_entity_verification_id",
				db("integration_data.business_entity_verification")
					.select("id")
					.where("business_id",
						db("integration_data.business_entity_verification")
							.select("business_id")
							.where("id", businessEntityVerificationId)
							.first()
					)
			)
			.orderBy("created_at", "desc")
			.first();
	}

	/** Shorthand for creating/updating the address_verification review task. */
	private async createAddressVerificationTask(
		businessEntityVerificationId: UUID,
		status: "success" | "failure",
		sublabel: string
	): Promise<void> {
		await this.createReviewTask(
			businessEntityVerificationId,
			"address",
			"address_verification",
			status,
			"Address Verification",
			sublabel
		);
	}

	/**
	 * Check if a Trulioo clientData status represents a definitive (final) result.
	 * Definitive means the verification has completed or explicitly failed — not still in progress.
	 * Used to decide whether to create review tasks immediately or defer to the webhook.
	 */
	private isDefinitiveResult(clientDataStatus?: string): boolean {
		return isTruliooCompletedStatus(clientDataStatus)
			|| clientDataStatus === "failed" || clientDataStatus === "error" || clientDataStatus === "REJECTED";
	}

	/**
	 * Derive the review task status from a definitive clientData status.
	 * Must only be called when isDefinitiveResult() returns true.
	 */
	private deriveTaskStatus(clientDataStatus?: string): "success" | "failure" {
		return (clientDataStatus === "failed" || clientDataStatus === "error" || clientDataStatus === "REJECTED")
			? "failure"
			: "success";
	}

	/**
	 * Create or update a review task
	 */
	private async createReviewTask(
		businessEntityVerificationId: UUID,
		category: string,
		key: IBusinessEntityReviewTask["key"],
		status: "success" | "failure",
		label: string,
		sublabel: string
	): Promise<void> {
		await db<IBusinessEntityReviewTask>("integration_data.business_entity_review_task")
			.insert({
				business_entity_verification_id: businessEntityVerificationId,
				category,
				key,
				status,
				label,
				sublabel
			})
			.onConflict(["business_entity_verification_id", "key"])
			.merge({
				status: db.raw("EXCLUDED.status"),
				label: db.raw("EXCLUDED.label"),
				sublabel: db.raw("EXCLUDED.sublabel")
			});
	}

	/**
	 * Generate a deterministic UUID from a string input
	 * Uses SHA-256 hash to ensure same input produces same UUID
	 */
	private generateDeterministicUUID(input: string): UUID {
		const hash = createHash("sha256").update(input).digest();
		// Convert first 16 bytes to UUID format (v4 style)
		const hex = hash.toString("hex").substring(0, 32);
		return `${hex.substring(0, 8)}-${hex.substring(8, 12)}-4${hex.substring(13, 16)}-${(parseInt(hex.substring(16, 18), 16) & 0x3f | 0x80).toString(16)}${hex.substring(18, 20)}-${hex.substring(20, 32)}` as UUID;
	}

	/**
	 * Build address record from address data
	 */
	private buildAddressRecord(
		businessEntityVerificationId: UUID,
		address: { addressLine1: string; addressLine2?: string | null; city?: string | null; state?: string | null; postalCode?: string | null; country?: string | null; submitted?: boolean; vendorRegistrationId?: UUID }
	): Partial<IBusinessEntityAddressSource> | null {
		if (!address.addressLine1 || typeof address.addressLine1 !== "string") {
			return null;
		}

		const addressParts = [
			address.addressLine1,
			address.addressLine2,
			address.city,
			address.state,
			address.postalCode,
			address.country
		].filter(Boolean);
		const fullAddress = addressParts.join(", ");

		const addressRecord: Partial<IBusinessEntityAddressSource> = {
			business_entity_verification_id: businessEntityVerificationId,
			external_id: generateDeterministicUUID(
				`${businessEntityVerificationId}|${fullAddress.toLowerCase().trim()}|${address.submitted ?? false}`
			) as UUID,
			address_line_1: address.addressLine1,
			submitted: address.submitted ?? false
		};

		if (fullAddress) addressRecord.full_address = fullAddress;
		if (typeof address.addressLine2 === "string" && address.addressLine2) addressRecord.address_line_2 = address.addressLine2;
		if (typeof address.city === "string" && address.city) addressRecord.city = address.city;
		if (typeof address.state === "string" && address.state) addressRecord.state = address.state;
		if (typeof address.postalCode === "string" && address.postalCode) addressRecord.postal_code = address.postalCode;
		if (address.vendorRegistrationId) addressRecord.external_registration_id = address.vendorRegistrationId;
		return addressRecord;
	}

	/**
	 * Store people data directly from Trulioo response (following Middesk pattern)
	 * This stores ALL people from ubos and directors arrays, regardless of screening status
	 */
	private async upsertBusinessEntityPeople(
		businessEntityVerificationId: UUID,
		clientData?: TruliooFlowResult["clientData"],
		watchlistResults?: unknown
	): Promise<void> {
		try {
			const mappedPeople: IBusinessEntityPerson[] = [];

			// Process UBOs and Directors arrays
			// Note: ubos and directors may not be available in Trulioo response
			const ubos = (clientData as any)?.ubos;
			const directors = (clientData as any)?.directors;

			if (ubos && Array.isArray(ubos)) {
				for (const ubo of ubos) {
					const person = this.buildPersonRecord(businessEntityVerificationId, ubo, "UBO", "trulioo_ubo");
					if (person) mappedPeople.push(person);
				}
			}

			if (directors && Array.isArray(directors)) {
				for (const director of directors) {
					const person = this.buildPersonRecord(businessEntityVerificationId, director, "DIRECTOR", "trulioo_director");
					if (person) mappedPeople.push(person);
				}
			}
			if (mappedPeople.length === 0) {
				logger.debug(`No people data found in Trulioo response for business entity verification ${businessEntityVerificationId}`);
				return;
			}

			// Store people in database (following Middesk pattern with onConflict merge)
			const inserted = await db<IBusinessEntityPerson>("integration_data.business_entity_people")
				.insert(mappedPeople)
				.returning("*")
				.onConflict(["business_entity_verification_id", "name"])
				.merge();

			logger.info(
				`Upserted ${inserted.length} people records for business entity verification id: ${businessEntityVerificationId}`
			);
		} catch (error: unknown) {
			logger.error(error, `Error storing business entity people: ${error instanceof Error ? error.message : String(error)}`);
			// Don't throw error here as this is supplementary data
		}
	}

	/**
	 * Build person record from UBO or Director data
	 */
	private buildPersonRecord(
		businessEntityVerificationId: UUID,
		person: TruliooUBO | TruliooDirector,
		controlType: "UBO" | "DIRECTOR",
		type: "trulioo_ubo" | "trulioo_director"
	): IBusinessEntityPerson | null {
		const personName = this.extractPersonName(person);
		if (!personName) {
			logger.warn(`${controlType} missing name information, skipping: ${JSON.stringify(person)}`);
			return null;
		}

		return {
			business_entity_verification_id: businessEntityVerificationId,
			name: personName,
			submitted: false, // People come from Trulioo response, not user submission
			source: JSON.stringify([{ type, provider: "trulioo", id: person.fullName || personName, controlType }]),
			titles: person.title ? [person.title] : [],
			metadata: JSON.stringify({ ...person, controlType, provider: "trulioo", source: "business_verification_response" })
		} as IBusinessEntityPerson;
	}

	/**
	 * Extract person name from UBO or Director data
	 * Prioritizes fullName, then constructs from firstName/lastName
	 */
	private extractPersonName(person: TruliooUBO | TruliooDirector): string | null {
		if (person.fullName) {
			return person.fullName.trim();
		}
		if (person.name) {
			return person.name.trim();
		}
		if (person.firstName || person.lastName) {
			return `${person.firstName || ""} ${person.lastName || ""}`.trim();
		}
		return null;
	}
}
