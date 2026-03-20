import { TruliooBase } from "../common/truliooBase";
import { BusinessEntityVerificationService as BusinessEntityVerification } from "#api/v1/modules/verification/businessEntityVerification";
import type { IDBConnection } from "#types/db";
import { INTEGRATION_ID } from "#constants";
import { TruliooFlows, TruliooPSCFormData, TruliooUBOPersonData, TaskUpdateData } from "../common/types";
import { TruliooPersonInquiryManager } from "./truliooPersonInquiryManager";
import { TruliooPersonDataStorage } from "./truliooPersonDataStorage";
import { TruliooPersonVerificationProcessor } from "./truliooPersonVerificationProcessor";
import { TruliooPersonScreeningProcessor } from "./truliooPersonScreeningProcessor";
import { TruliooPersonTaskHandler } from "./truliooPersonTaskHandler";
import { VerificationApiError } from "#api/v1/modules/verification/error";
import { StatusCodes } from "http-status-codes";
import { ERROR_CODES } from "#constants";
import { logger } from "#helpers/logger";
import type { UUID } from "crypto";
import type { IRequestResponse } from "#types/db";
import { convertToUUIDFormat, extractPersonNameFromTruliooResponse, sanitizeTruliooLabelsFromPayload } from "../common/utils";
import { processAndPersistTruliooAdverseMedia } from "../common/truliooAdverseMediaProcessor";

/**
 * Trulioo Person Verification Implementation
 * Extends BusinessEntityVerification for person verification (PSC flows)
 * Uses composition pattern with modular components for better maintainability
 */
export class TruliooPerson extends BusinessEntityVerification {
	public readonly MIN_INDEX = 45;
	protected static readonly PLATFORM_ID = INTEGRATION_ID.TRULIOO;

	private truliooBase: TruliooBase;
	private inquiryManager: TruliooPersonInquiryManager;
	private dataStorage: TruliooPersonDataStorage;
	private verificationProcessor: TruliooPersonVerificationProcessor;
	private screeningProcessor: TruliooPersonScreeningProcessor;
	private taskHandler: TruliooPersonTaskHandler;

	// Task handler map for person verification
	taskHandlerMap: Record<string, (taskId: string, data: TaskUpdateData) => Promise<void>>;

	constructor(businessID: string, dbConnection?: IDBConnection) {
		super(dbConnection);

		// Create a concrete implementation for internal use
		this.truliooBase = new (class extends TruliooBase {
			getIntegrationId(): number {
				return INTEGRATION_ID.TRULIOO;
			}
			getFlowType(): string {
				return TruliooFlows.PSC;
			}
		})(businessID);

		// Initialize modular components
		this.screeningProcessor = new TruliooPersonScreeningProcessor(this.truliooBase);
		this.dataStorage = new TruliooPersonDataStorage();
		this.verificationProcessor = new TruliooPersonVerificationProcessor(this.truliooBase, this.screeningProcessor, this.dataStorage);
		this.inquiryManager = new TruliooPersonInquiryManager(
			this.truliooBase,
			businessID,
			this.dataStorage,
			this.verificationProcessor
		);
		this.taskHandler = new TruliooPersonTaskHandler(this.truliooBase, this.verificationProcessor);

		// Initialize task handler map
		this.taskHandlerMap = this.taskHandler.createTaskHandlerMap(async (taskId: string, data: TaskUpdateData) => {
			await this.updateTask(taskId, data);
		});
	}

	// Implement abstract methods from TruliooBase
	getIntegrationId(): number {
		return INTEGRATION_ID.TRULIOO;
	}

	getFlowType(): string {
		return TruliooFlows.PSC;
	}

	// Expose shared Trulioo methods for external use
	public async runVerificationFlow(flowId: string, formData: Partial<TruliooPSCFormData>) {
		return this.truliooBase.runVerificationFlow(flowId, formData);
	}

	public async getFlow(params: { flowId: string }) {
		return this.truliooBase["getFlow"](params);
	}

	public async submitFlow(params: { flowId: string; hfSession: string; payload: TruliooPSCFormData }) {
		return this.truliooBase["submitFlow"](params);
	}

	public async getClientData(params: { hfSession: string; queryParams?: Record<string, string> }) {
		return this.truliooBase["getClientData"](params);
	}

	/**
	 * Create person verification inquiry (legacy method for backward compatibility)
	 * @param personData Person data to verify
	 * @param businessData Business context data
	 * @param businessEntityVerificationId Optional business entity verification ID for integration
	 * @param taskId Optional task ID from KYB verification to propagate to PSC records
	 * @returns Verification inquiry response
	 */
	async createPersonInquiry(
		personData: TruliooUBOPersonData,
		businessData: TruliooPSCFormData,
		businessEntityVerificationId?: string,
		taskId?: string
	) {
		return this.inquiryManager.createPersonInquiry(personData, businessData, businessEntityVerificationId, taskId);
	}

	/**
	 * Get person verification details (legacy method for backward compatibility)
	 * @returns Person verification details
	 */
	async getPersonVerificationDetails() {
		return this.inquiryManager.getPersonVerificationDetails();
	}

	/**
	 * Complete person verification inquiry (legacy method for backward compatibility)
	 */
	async completePersonInquiry() {
		return this.inquiryManager.completePersonInquiry();
	}

	/**
	 * Process webhook "done" event for PSC flows
	 * Retrieves client data and saves to request_response table with request_type = 'fetch_business_person_verification'
	 * @param transactionId - Trulioo transaction ID (hfSession)
	 * @param requestType - Request type to use when saving to request_response (default: 'fetch_business_person_verification')
	 */
	public async processWebhookDoneEvent(transactionId: string, requestType: string = "fetch_business_person_verification"): Promise<void> {
		logger.info(
			`Processing Trulioo PSC webhook "done" event for business: ${this.truliooBase["businessID"]}, transaction: ${transactionId}`
		);

		// Retrieve profile data using transactionId as hfSession
		const rawClientData = await this.getClientData({
			hfSession: transactionId,
			queryParams: { includeFullServiceDetails: "true" }
		});

		logger.info(
			`Successfully retrieved Trulioo PSC profile data for business: ${this.truliooBase["businessID"]}, transaction: ${transactionId}`
		);

		// Extract watchlist results from the response
		const watchlistResults = this.truliooBase.extractWatchlistResults(rawClientData);
		logger.info(
			`Extracted ${watchlistResults?.length ?? 0} watchlist results for business: ${this.truliooBase["businessID"]}, transaction: ${transactionId}`
		);

		// Get task ID and person name from business_entity_verification and business_entity_people records
		// Since PSC is part of the same verification process, we reuse the KYB task ID
		// This avoids needing to create a new task code for PSC flows
		let taskId: UUID | null = null;
		let personName: string | undefined;
		let personFirstName: string | undefined;
		let personLastName: string | undefined;
		const uuidFormattedSession = convertToUUIDFormat(transactionId);
		let verificationRecord: { id: UUID; business_integration_task_id?: string | null } | undefined;
		let kybVerificationRecord: { id: UUID; business_integration_task_id?: string | null } | undefined;
		const { db: dbHelper } = await import("#helpers/knex");

		try {

			// Try to find person name from business_entity_people using transactionId (inquiryId)
			// The transactionId is the same as the inquiryId stored in business_entity_people.source
			try {
				const personRecord = await dbHelper("integration_data.business_entity_people")
					.select("integration_data.business_entity_people.name", "integration_data.business_entity_people.metadata")
					.join(
						"integration_data.business_entity_verification",
						"integration_data.business_entity_people.business_entity_verification_id",
						"integration_data.business_entity_verification.id"
					)
					.where("integration_data.business_entity_verification.business_id", this.truliooBase["businessID"] as UUID)
					// Use andWhere with callback to properly group OR conditions
					// This ensures: WHERE business_id = X AND (source LIKE Y OR source LIKE Z)
					// Without this, the OR would be at the top level, potentially returning records from other businesses
					.andWhere(function () {
						this.whereRaw("integration_data.business_entity_people.source::text LIKE ?", [`%${transactionId}%`])
							.orWhereRaw("integration_data.business_entity_people.source::text LIKE ?", [`%${uuidFormattedSession}%`]);
					})
					.first();

				if (personRecord) {
					personName = personRecord.name;
					// Try to get firstName/lastName from metadata if available
					try {
						const metadata = typeof personRecord.metadata === "string" ? JSON.parse(personRecord.metadata) : personRecord.metadata;
						if (metadata?.personData) {
							personFirstName = metadata.personData.firstName;
							personLastName = metadata.personData.lastName;
						}
					} catch (e) {
						// Ignore metadata parsing errors
					}
					logger.info(
						`Found person name "${personName}" from business_entity_people for transaction ${transactionId}`
					);
				}
			} catch (error) {
				logger.debug(
					error,
					`Could not fetch person name from business_entity_people for transaction ${transactionId}, will rely on fact engine lookup`
				);
			}

			// Fallback: extract person name from Trulioo response so Watchlists tab and fact engine can show the person
			if (!personName && rawClientData) {
				const extractedName = extractPersonNameFromTruliooResponse(rawClientData);
				if (extractedName) {
					personName = extractedName.personName;
					personFirstName = personFirstName ?? extractedName.firstName;
					personLastName = personLastName ?? extractedName.lastName;
					logger.info(
						`Using person name "${personName}" from Trulioo response for transaction ${transactionId}`
					);
				}
			}

			// Find the business_entity_verification record for this PSC flow
			verificationRecord = await dbHelper("integration_data.business_entity_verification")
				.where({ external_id: uuidFormattedSession })
				.first() as typeof verificationRecord;

			if (verificationRecord?.business_integration_task_id) {
				taskId = verificationRecord.business_integration_task_id as UUID;
				logger.info(
					`Using task ID ${taskId} from business_entity_verification record for PSC webhook results, business: ${this.truliooBase["businessID"]}, transaction: ${transactionId}`
				);
			} else {
				// Fallback: try to find the KYB verification record for the same business
				kybVerificationRecord = await dbHelper("integration_data.business_entity_verification")
					.where({ business_id: this.truliooBase["businessID"] as UUID })
					.whereNotNull("business_integration_task_id")
					.orderBy("created_at", "desc")
					.first() as typeof kybVerificationRecord;

				if (kybVerificationRecord?.business_integration_task_id) {
					taskId = kybVerificationRecord.business_integration_task_id as UUID;
					logger.info(
						`Using task ID ${taskId} from KYB verification record for PSC webhook results, business: ${this.truliooBase["businessID"]}, transaction: ${transactionId}`
					);
				}
			}
		} catch (error) {
			logger.warn(
				error,
				`Could not find task ID from business_entity_verification for business: ${this.truliooBase["businessID"]}, transaction: ${transactionId}`
			);
		}

		if (!taskId) {
			const errorMessage = `Could not find task ID for storing PSC webhook results for business: ${this.truliooBase["businessID"]}, transaction: ${transactionId}. Please ensure the business_entity_verification record exists with a business_integration_task_id.`;
			logger.error(errorMessage);
			throw new VerificationApiError(errorMessage, StatusCodes.INTERNAL_SERVER_ERROR, ERROR_CODES.INVALID);
		}

		// Build clientData structure with extracted watchlist results and person name
		// Include person name so fact engine can use it directly without lookup
		// Only save essential fields to avoid JSON size issues - fact engine can extract from fullServiceDetails if needed
		const clientData = {
			id: rawClientData?.id,
			status: rawClientData?.status,
			watchlistResults,
			// Include person name if found - this helps the fact engine group hits correctly
			...(personName && { fullName: personName }),
			...(personFirstName && { firstName: personFirstName }),
			...(personLastName && { lastName: personLastName }),
			screenedAt: new Date().toISOString(),
			provider: "trulioo"
		};

		// Try to save to request_response table (optional - fact engine can use business_entity_people fallback)
		try {
			// Get connection_id from verification record if not available from dbConnection
			let connectionId: UUID | undefined = this.dbConnection?.id as UUID | undefined;
			if (!connectionId && taskId) {
				// Resolve connection_id from task_id because business_entity_verification
				// does not store a connection_id column.
				const taskWithConnection = await dbHelper("integrations.data_business_integrations_tasks")
					.select("connection_id")
					.where("id", taskId)
					.first();

				if (taskWithConnection?.connection_id) {
					connectionId = taskWithConnection.connection_id as UUID;
				}
			}

			if (connectionId) {
				const payloadForDb = sanitizeTruliooLabelsFromPayload(clientData);
				await dbHelper<IRequestResponse>("integration_data.request_response")
					.insert({
						request_id: uuidFormattedSession as UUID, // UNIQUE: Use session ID as request_id for PSC to avoid overwriting KYB or other PSC results
						business_id: this.truliooBase["businessID"] as UUID,
						platform_id: INTEGRATION_ID.TRULIOO,
						external_id: uuidFormattedSession,
						request_type: requestType,
						request_code: requestType,
						connection_id: connectionId,
						response: JSON.stringify(payloadForDb),
						request_received: dbHelper.raw("now()")
					})
					.onConflict("request_id")
					.merge()
					.returning("*");

				logger.info(
					`PSC webhook results saved to request_response for business: ${this.truliooBase["businessID"]}, transaction: ${transactionId}, request_type: ${requestType}`
				);
			} else {
				logger.warn(
					`No connection_id available for saving PSC results to request_response for business: ${this.truliooBase["businessID"]}, transaction: ${transactionId}. Results will be available via business_entity_people fallback.`
				);
			}
		} catch (error) {
			logger.warn(
				error,
				`Failed to save PSC results to request_response for business: ${this.truliooBase["businessID"]}, transaction: ${transactionId}. Results will be available via business_entity_people fallback.`
			);
			// Don't throw - continue to update business_entity_people
		}

		// Update or create business_entity_people with watchlist results so the Watchlists tab shows the person
		if (watchlistResults && watchlistResults.length > 0 && personName) {
			try {
				// Find the person record - try multiple strategies:
				// 1. By transactionId/inquiryId in source field
				// 2. By person name and business_id (most recent record)
				let personRecord = await dbHelper("integration_data.business_entity_people")
					.select("integration_data.business_entity_people.*")
					.join(
						"integration_data.business_entity_verification",
						"integration_data.business_entity_people.business_entity_verification_id",
						"integration_data.business_entity_verification.id"
					)
					.where("integration_data.business_entity_verification.business_id", this.truliooBase["businessID"] as UUID)
					.where("integration_data.business_entity_people.name", personName)
					// Use andWhere with callback to properly group OR conditions
					// This ensures: WHERE business_id = X AND name = Y AND (source LIKE Z OR source LIKE W)
					// Without this, the OR would be at the top level, potentially returning records from other businesses
					.andWhere(function () {
						this.whereRaw("integration_data.business_entity_people.source::text LIKE ?", [`%${transactionId}%`])
							.orWhereRaw("integration_data.business_entity_people.source::text LIKE ?", [`%${uuidFormattedSession}%`]);
					})
					.orderBy("integration_data.business_entity_people.created_at", "desc")
					.first();

				// If not found by transactionId, try to find by name and business_id (most recent)
				if (!personRecord) {
					personRecord = await dbHelper("integration_data.business_entity_people")
						.select("integration_data.business_entity_people.*")
						.join(
							"integration_data.business_entity_verification",
							"integration_data.business_entity_people.business_entity_verification_id",
							"integration_data.business_entity_verification.id"
						)
						.where("integration_data.business_entity_verification.business_id", this.truliooBase["businessID"] as UUID)
						.where("integration_data.business_entity_people.name", personName)
						.orderBy("integration_data.business_entity_people.created_at", "desc")
						.first();
				}

				const watchlistSources = watchlistResults.map((hit: any) => ({
					type: "watchlist_result",
					provider: "trulioo",
					listType: hit.listType,
					listName: hit.listName,
					confidence: hit.confidence,
					matchDetails: hit.matchDetails,
					url: hit.url,
					sourceAgencyName: hit.sourceAgencyName,
					sourceRegion: hit.sourceRegion,
					sourceListType: hit.sourceListType,
					listCountry: hit.listCountry
				}));

				if (personRecord) {
					// Parse existing metadata and source, then update
					const existingMetadata = typeof personRecord.metadata === "string"
						? JSON.parse(personRecord.metadata)
						: personRecord.metadata || {};
					const existingSource = typeof personRecord.source === "string"
						? JSON.parse(personRecord.source)
						: personRecord.source || [];
					const filteredSources = existingSource.filter((s: any) => s.type !== "watchlist_result");
					const updatedSources = [...filteredSources, ...watchlistSources];
					const updatedMetadata = {
						...existingMetadata,
						sources: updatedSources,
						watchlistResults,
						screeningResults: {
							watchlistHits: watchlistResults,
							provider: "trulioo",
							screenedAt: new Date().toISOString()
						}
					};

					await dbHelper("integration_data.business_entity_people")
						.where("id", personRecord.id)
						.update({
							metadata: JSON.stringify(updatedMetadata),
							source: JSON.stringify(updatedSources)
						});

					logger.info(
						`Updated business_entity_people record for "${personName}" with ${watchlistResults.length} watchlist results`
					);
				} else {
					// No existing record: upsert so the Watchlists tab shows this person (e.g. PSC-only flow or record missing)
					const businessEntityVerificationId =
						verificationRecord?.id ?? kybVerificationRecord?.id
							? (verificationRecord?.id ?? kybVerificationRecord?.id)
							: await dbHelper("integration_data.business_entity_verification")
									.where({ business_id: this.truliooBase["businessID"] as UUID })
									.whereNotNull("business_integration_task_id")
									.orderBy("created_at", "desc")
									.first()
									.then((row: { id: UUID } | undefined) => row?.id);

					if (businessEntityVerificationId) {
						const sourceObject = {
							type: "trulioo_psc",
							provider: "trulioo",
							id: transactionId,
							inquiryId: transactionId
						};
						const newMetadata = {
							sources: watchlistSources,
							watchlistResults,
							screeningResults: {
								watchlistHits: watchlistResults,
								provider: "trulioo",
								screenedAt: new Date().toISOString()
							},
							...(personFirstName && personLastName && {
								personData: { firstName: personFirstName, lastName: personLastName }
							})
						};
						await dbHelper("integration_data.business_entity_people")
							.insert({
								business_entity_verification_id: businessEntityVerificationId as UUID,
								name: personName,
								submitted: true,
								source: JSON.stringify([sourceObject]),
								titles: [],
								metadata: JSON.stringify(newMetadata)
							})
							.onConflict(["business_entity_verification_id", "name"])
							.merge({
								metadata: JSON.stringify(newMetadata),
								source: JSON.stringify([sourceObject])
							});

						logger.info(
							`Upserted business_entity_people for "${personName}" with ${watchlistResults.length} watchlist results (Watchlists tab will show hits)`
						);
					} else {
						logger.debug(
							`No business_entity_verification found for business ${this.truliooBase["businessID"]}, cannot create business_entity_people record for "${personName}"`
						);
					}
				}
			} catch (error) {
				logger.error(
					error,
					`Error updating business_entity_people with watchlist results for transaction ${transactionId}`
				);
				// Don't throw error - this is supplementary to the main webhook processing
			}
		}

		// Post-process: extract ADVERSE_MEDIA hits from PSC webhook results, score with OpenAI, persist.
		// This mirrors the same logic in truliooPersonVerificationProcessor.ts but covers the
		// asynchronous webhook path where results arrive after initial PSC submission.
		if (watchlistResults && watchlistResults.length > 0 && taskId) {
			try {
				const { adverseMedia } = await import("#api/v1/modules/adverse-media/adverse-media");
				await processAndPersistTruliooAdverseMedia({
					watchlistHits: watchlistResults,
					businessId: this.truliooBase["businessID"],
					taskId,
					entityNames: [],
					individuals: personName ? [personName] : [],
					deps: {
						scoreAdverseMedia: adverseMedia.scoreAdverseMedia.bind(adverseMedia),
						insertAdverseMedia: adverseMedia.insertAdverseMedia.bind(adverseMedia)
					}
				});
			} catch (error) {
				logger.error(
					{ err: error, businessId: this.truliooBase["businessID"], transactionId },
					"Error processing person-level adverse media from PSC webhook"
				);
			}
		}
	}
}
