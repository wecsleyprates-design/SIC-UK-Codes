import { TaskManager } from "#api/v1/modules/tasks/taskManager";
import { db } from "#helpers/knex";
import type { IBusinessIntegrationTaskEnriched, IDBConnection, IRequestResponse } from "#types/db";
import { decryptData, encryptData } from "#utils/encryption";
import { logger } from "#helpers/logger";
import BullQueue from "#helpers/bull-queue";
import { randomUUID, type UUID } from "crypto";
import { EVENTS, INTEGRATION_ID, QUEUES, TASK_STATUS } from "#constants";
import { getOrCreateConnection } from "#helpers/platformHelper";
import { KyxStrategyFactory } from "./strategies";
import type { IntegrationMode } from "#api/v1/modules/customer-integration-settings/types";
import { IKyxStrategy, KYXVerificationResponse, KYXVerificationOptions, KYXUserBody, Details } from "./types";
import { VerificationApiError } from "#api/v1/modules/verification/error";
import { normalizeString } from "#utils/normalizer";

export class KYX extends TaskManager {
	protected PLATFORM_ID = INTEGRATION_ID.KYX;
	private readonly strategy: IKyxStrategy;
	private body: object;

	constructor(dbConnection: IDBConnection, body: object, integrationMode?: IntegrationMode) {
		super(dbConnection);
		this.strategy = KyxStrategyFactory.createStrategy(integrationMode) as IKyxStrategy;
		if (!this.strategy) {
			throw new Error(`No valid KYX strategy available for integration mode: ${integrationMode}`);
		}
		this.body = body;
	}

	protected taskHandlerMap = {
		fetch_identity_verification: async (taskId, enrichedTask) => this.fetchKyxReview(taskId, enrichedTask)
	};

	/**
	 * Add queue for KYX integration
	 */
	static enqueueKyxRequest = async (requestId: UUID, request: Record<string, any>) => {
		const queue = new BullQueue(QUEUES.TASK);
		const jobId = `${requestId}::${randomUUID()}`;
		return queue.addJob(EVENTS.KYX_MATCH, { requestId, request }, { jobId, removeOnComplete: false, removeOnFail: false });
	};

	/**
	 * Process KYX task when the taskManager is ready to run.
	 * @returns The updated task
	 */
	static processJobRequest = async (job: any): Promise<any> => {
		const { business_id: businessID, body } = job?.request;
		try {
			const updatedTask = await this.runKyxMatch(businessID, body);
			logger.info(`Status: ${updatedTask.task_status} for KYX task for businessId=${businessID}`);
			return updatedTask;
		} catch (error) {
			logger.error(error,`Failed to runKYX task for businessId=${businessID}`);
			throw new VerificationApiError(`Failed to process KYX integration: ${error}`);
		}
	};

	/**
	 * Run KYX task.
	 * @returns The Enriched Task
	 */
	public static async runKyxMatch(businessID: UUID, body: object): Promise<IBusinessIntegrationTaskEnriched> {
		let taskId;
		try {
			const dbConnection = await getOrCreateConnection(businessID, INTEGRATION_ID.KYX, {
				connection_status: "SUCCESS",
				configuration: null
			});
			const platform = new KYX(dbConnection, body);
			taskId = await platform.getOrCreateTaskForCode({
				taskCode: "fetch_identity_verification",
				reference_id: businessID,
				metadata: {}
			});
			return await platform.processTask({ taskId });
		} catch (error) {
			logger.error(
				error,
				`${taskId ? `TaskID: ${taskId} ` : ""} There is an error in KYX integration`
			);
			throw new VerificationApiError(`Failed to run KYX integration: ${error}`);
		}
	}

	async fetchKyxReview(taskId: UUID, enrichedTask?: IBusinessIntegrationTaskEnriched): Promise<boolean> {
		try {
			if (!enrichedTask) {
				logger.error(`KYX: Error in fetchKyxReview for task ${taskId}`);
				return false;
			}
			
			const body: KYXUserBody = this.body;
			const response = await this.verifyIdentity(body, body.options);
			const prefill = response?.prefillExpress ?? response?.prefill

			if (prefill?.status !== 'pass') {
				// Update DB
				await this.upsertRequestResponse(enrichedTask, response, JSON.stringify(response));
				return false;
			}

			// Evaluate if the response matches the firstName and lastName body
			const resultFound = KYX.filterResponseByName(body, response);

			if(!resultFound) {
				return false
			}
			// Encrypt only the values in prefillExpress.details while keeping the structure
			const encryptedResponse = this.encryptDetailsValues(resultFound);

			// Save the response with encrypted details in DB
			await this.upsertRequestResponse(enrichedTask, response, JSON.stringify(encryptedResponse));

			const resultFoundPrefill = resultFound?.prefillExpress ?? resultFound?.prefill
			if (resultFoundPrefill?.details?.person === null) {
				return false;
			}

			// Update task with encrypted metadata
			await this.updateTask(taskId, { metadata: JSON.stringify(encryptedResponse) });
			await this.updateTaskStatus(taskId, TASK_STATUS.SUCCESS);
			
			return true;
		} catch (error) {
			logger.error(error, `KYX: Error in fetchKyxReview for task ${taskId}`);
			await this.updateTaskStatus(taskId, TASK_STATUS.FAILED);
			return false;
		}
	}

	async getAccessToken(): Promise<string> {
		return this.strategy.getAccessToken();
	}

	/**
	 * Performs KYX identity verification by calling the /v2/verify endpoint
	 * @param body - The user body provided by the user
	 * @param options - Optional verification options
	 * @returns Promise<KYXVerificationResponse> - KYX verification response
	 */
	async verifyIdentity(body: KYXUserBody, options?: KYXVerificationOptions): Promise<KYXVerificationResponse> {
		return this.strategy.verifyIdentity(body, options);
	}

	/**
	 * Get the current strategy mode
	 * @returns The current integration mode
	 */
	getMode(): "PRODUCTION" | "SANDBOX" | "MOCK" {
		return this.strategy.getMode();
	}

	/**
	 * Check if the current strategy is available
	 * @returns True if the strategy can be used, false otherwise
	 */
	isAvailable(): boolean {
		return this.strategy.isAvailable();
	}

	/**
	 * Encrypts only the values within prefillExpress.details while keeping the JSON structure
	 * @param response - The KYX verification response
	 * @returns Response with encrypted values in prefillExpress.details
	 */
	private encryptDetailsValues(response: KYXVerificationResponse): KYXVerificationResponse {
		// Deep clone with fallback
		const encryptedResponse: KYXVerificationResponse = structuredClone(response);

		// Prefer prefillExpress if present; otherwise use prefill
		const prefill = encryptedResponse.prefillExpress ?? encryptedResponse.prefill ?? null;

		if (prefill?.details) {
			prefill.details = KYX.transformObjectValues(prefill.details, encryptData);
		}
		return encryptedResponse;
	}


	/**
	 * Decrypts only the values within prefillExpress.details while keeping the JSON structure
	 * @param response - The KYX verification response with encrypted values
	 * @returns Response with decrypted values in prefillExpress.details
	 */
	
	private static decryptDetailsValues(response: KYXVerificationResponse): KYXVerificationResponse {
		// Deep clone: structuredClone preferred, fallback for older Node
		const decryptedResponse: KYXVerificationResponse = structuredClone(response);

		// Determine which branch is present (never both per your note)
		const hasExpress = !!decryptedResponse.prefillExpress;
		const prefillRef = hasExpress ? decryptedResponse.prefillExpress : decryptedResponse.prefill;

		if (prefillRef?.details) {
			const decryptedDetails = KYX.transformObjectValues(
			prefillRef.details,
				(value: any) => {
					try {
						return decryptData(value);
					} catch {
						return value; // If not encrypted, keep original
					}
				}
			);

			// Write back to the same branch
			if (hasExpress) {
				decryptedResponse.prefillExpress!.details = decryptedDetails;
			} else if (decryptedResponse.prefill) {
				decryptedResponse.prefill.details = decryptedDetails;
			}
		}
		return decryptedResponse;
	}

	/**
	 * Recursively Generic Transformer in an object
	 * @param obj - Object to decrypt/decrypted values in
	 * @param transformFn - Function to decrypt/decrypted
	 * @returns Object with decrypt/decrypted values
	 */
	private static transformObjectValues(obj: Details, transformFn) {
		if (obj === null || obj === undefined) return obj;

		if (Array.isArray(obj)) {
			return obj.map(item => this.transformObjectValues(item, transformFn));
		}

		if (typeof obj === 'string' || typeof obj === 'number' || typeof obj === 'boolean') {
			return transformFn(obj);
		}

		if (typeof obj === 'object') {
			const transformed = {};
			for (const key in obj) {
				if (Object.prototype.hasOwnProperty.call(obj, key)) {
					const value = obj[key];
					if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
						transformed[key] = transformFn(value);
					} else {
						transformed[key] = this.transformObjectValues(value, transformFn);
					}
				}
			}
			return transformed;
		}

		return obj;
	}

	/**
	 * Upsert raw response into DB
	 * @returns Promise and record saved
	 */
	private async upsertRequestResponse<T = any>(
		task: IBusinessIntegrationTaskEnriched<T>,
		input: KYXVerificationResponse,
		encryptedResponse?: string
	): Promise<IRequestResponse> {
		// Check if a record already exists for this business_id and platform_id
		const existingRecord = await db<IRequestResponse>("integration_data.request_response")
			.where({
				business_id: task.business_id,
				platform_id: task.platform_id
			})
			.orderBy("request_received", "desc")
			.first();

		if (existingRecord) {
			// Update existing record using request_id (primary key)
			const updatedRecord = await db<IRequestResponse>("integration_data.request_response")
				.where({ request_id: existingRecord.request_id })
				.update({
					external_id: input.txId,
					request_type: task.task_code,
					request_code: task.task_code,
					connection_id: task.connection_id,
					response: encryptedResponse || JSON.stringify(input),
					request_received: db.raw("now()")
				})
				.returning("*");
			return updatedRecord[0];
		} else {
			// Insert new record
			const insertedRecord = await db<IRequestResponse>("integration_data.request_response")
				.insert({
					request_id: task.id,
					business_id: task.business_id,
					platform_id: task.platform_id,
					external_id: input.txId,
					request_type: task.task_code,
					request_code: task.task_code,
					connection_id: task.connection_id,
					response: encryptedResponse || JSON.stringify(input),
					request_received: db.raw("now()")
				})
				.returning("*");
			return insertedRecord[0];
		}
	}
	
	/**
	 * Get raw response into DB
	 * @returns Promise and record found
	 */
	static async getKYXResult(params: { businessId: UUID }): Promise<KYXVerificationResponse | any> {
		try {
			const kyxResult = await db("integration_data.request_response")
				.select("integration_data.request_response.*")
				.where("integration_data.request_response.platform_id", INTEGRATION_ID.KYX)
				.andWhere("integration_data.request_response.business_id", params.businessId)
				.orderBy("requested_at", "desc");
			
			if (kyxResult.length === 0) {
				logger.info(`KYX result: Record not found for owner: ${params.businessId}`);
				return {};
			}
			const request_response = kyxResult[0];
			
			// Parse the response (it's stored as JSON string)
			let parsedResponse: any;
			try {
				parsedResponse = typeof request_response.response === 'string' 
					? JSON.parse(request_response.response) 
					: request_response.response;
			} catch (parseError) {
				logger.warn(`KYX result: Failed to parse response for businessID: ${params.businessId}`);
				return request_response.response;
			}
			const parsedDetails = parsedResponse?.prefillExpress ?? parsedResponse?.prefill;
			
			if (parsedDetails?.details?.person !== null && parsedDetails?.status === "pass") {
				// Decrypt only the values in prefillExpress.details
				return KYX.decryptDetailsValues(parsedResponse);				
			}
			
			logger.info(`KYX result: Record not found for owner: ${params.businessId}`);
			return {};
		} catch (error) {
			logger.error(error, `KYX result: Error while fetching businessID: ${params.businessId}: ${error}`);
			throw error;
		}
	}

	/**
	 * Check if a person's firstName and lastName match the input.
	 */
	static personMatches(
		input: { firstName: string; lastName: string },
		person: { firstName: string; lastName: string } | null | undefined
	) {
		if (!person) return false;
		return (
			normalizeString(person.firstName) === normalizeString(input.firstName) &&
			normalizeString(person.lastName) === normalizeString(input.lastName)
		);
	}

	/**
	 * Filter the response:
	 * - If details.person matches, keep it.
	 * - Else, check additionalProfiles for a match and promote it.
	 * - Remove additionalProfiles entirely.
	 */
	static filterResponseByName(body: KYXUserBody, response: KYXVerificationResponse) {
		const input = {
			firstName: body?.firstName || "",
			lastName: body?.lastName || ""
		};

		// Deep clone 
		const pruned = structuredClone(response || {})

		const details = pruned?.prefillExpress?.details ?? pruned?.prefill?.details;
		if (!details) {
			return null;
		} 

		// 1) If top-level person matches, keep as-is and drop additionalProfiles.
		if (this.personMatches(input, details.person)) {
			details.additionalProfiles = [];
			return pruned;
		}

		// 2) Otherwise look for a match in additionalProfiles.
		let promoted: any = null;
		if (Array.isArray(details.additionalProfiles)) {
			promoted = details.additionalProfiles.find(p => this.personMatches(input, p?.person)) || null;
		}

		if (promoted) {
			// Promote person, and bring emails/addresses up
			details.person = promoted.person || null;
			details.emails = Array.isArray(promoted.emails) ? promoted.emails : null;
			details.addresses = Array.isArray(promoted.addresses) ? promoted.addresses : null;
		} else {
			// No match found anywhere: set all to null
			details.person = null;
			details.emails = null;
			details.addresses = null;
		}

		// 3) Always remove additionalProfiles
		details.additionalProfiles = [];

		return pruned;
	}
}
