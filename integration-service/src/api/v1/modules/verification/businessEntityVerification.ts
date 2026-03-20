import { randomUUID, UUID } from "crypto";
import { StatusCodes } from "http-status-codes";
import { match } from "ts-pattern";
import states from "us-state-codes";

import { TaskHandlerMap, TaskManager } from "#api/v1/modules/tasks/taskManager";
import {
	CONNECTION_STATUS,
	DIRECTORIES,
	ERROR_CODES,
	EVENTS,
	FEATURE_FLAGS,
	INTEGRATION_ID,
	INTEGRATION_TASK,
	IntegrationPlatformId,
	QUEUES,
	ROLES,
	TASK_STATUS,
	TaskCode,
	kafkaEvents,
	kafkaTopics,
	type EventEnum,
	type QueueEnum
} from "#constants";
import {
	getBusinessApplicants,
	getBusinessDetails,
	internalGetBusinessNamesAndAddresses,
	type BusinessAddress
} from "#helpers/api";
import { getFlagValue, getFlagValueByToken, logger, producer, sqlQuery } from "#helpers/index";
import { db } from "#helpers/knex";
import {
	BusinessEntityVerificationParams,
	BusinessEntityVerificationResponse,
	BusinessEntityVerificationUserInfo,
	BusinessEntityWebsiteResponse,
	InternalBusinessEntityVerification,
	UpdateBusinessEntityPayload,
	VerificationRreviewWebhookEvent as VerificationReviewWebhookEvent,
	middesk
} from "#lib/middesk";
import {
	IBusinessEntityAddressSource,
	IBusinessEntityName,
	IBusinessEntityReviewTask,
	IBusinessEntityVerification,
	IBusinessIntegrationTaskEnriched,
	IDBConnection,
	IRequestResponse,
	type IBusinessEntityPerson,
	type IBusinessEntityRegistration,
	type IBusinessIntegrationTask
} from "#types/db";
import { decryptData, encryptData } from "#utils/encryption";
import { isNonEmptyArray } from "@austinburns/type-guards";
import { VerificationApiError } from "./error";
import { getRawIntegrationDataFromS3, uploadRawIntegrationDataToS3 } from "#common/index";
import { HydrateFromWarehouse } from "#decorators/hydrateFromWarehouse";
import dayjs from "dayjs";
import { buildInsertQuery } from "#utils/queryBuilder";
import {
	BulkUpdateMiddeskData,
	BusinessEntityWebsiteDetails,
	BusinessWebsiteDetailsResponse,
	MiddeskCreateBusinessPayload,
	MiddeskUpdateBusinessPayload,
	PAGES,
	PeopleResponse,
	WatchlistPersonResult
} from "./types";
import { transformTruliooHitToWatchlistMetadata } from "#lib/facts/kyb/watchlistHelpers";
import { WATCHLIST_ENTITY_TYPE, WATCHLIST_HIT_TYPE } from "#lib/facts/kyb/types";
import type { TruliooWatchlistHit } from "#lib/trulioo/common/types";
import { getDummyMiddeskResponse } from "#utils/faker";
import { v4 as uuid } from "uuid";
import { executeAndUnwrapRedshiftQuery } from "#helpers/redshift";
import type { TDateISO } from "#types/datetime";
import axios from "axios";
import BullQueue from "#helpers/bull-queue";
import { platformFactory } from "#helpers/platformHelper";
import type { Job } from "bull";
import { envConfig } from "#configs";
import type { EntityMatchTask } from "#lib/entityMatching/types";
import { toYMD } from "#utils";
import { FirmographicsEvent } from "@joinworth/types/dist/types/kafka/entity_matching.v1/FirmographicsEvent";
import { sanitizeBusinessName } from "./util";
// Lazy import to avoid circular dependency: businessEntityVerification -> facts -> businessDetails -> sources -> businessEntityVerification
// Import types only, functions will be imported when needed
import type { FactEngineWithDefaultOverrides as FactEngineWithDefaultOverridesType } from "#lib/facts";

export const MINIMUM_PREDICTION_SCORE = 0.81;

export class BusinessEntityVerificationService extends TaskManager {
	public static BULK_NAMED_JOB: EventEnum = EVENTS.BUSINESS_MATCH;
	/** Queue for enqueueMatchRequest; subclasses (ZoomInfo, OpenCorporates, NPI) set their own. */
	protected static BULK_NAMED_QUEUE?: QueueEnum;
	static SCHEMA = "integration_data";
	// tables
	static BUSINESS_ENTITY_VERIFICATION = "business_entity_verification";
	static BUSINESS_ENTITY_REVIEW_TASK = "business_entity_review_task";
	static BUSINESS_ENTITY_REGISTRATION = "business_entity_registration";
	static BUSINESS_ENTITY_ADDRESS_SOURCE = "business_entity_address_source";
	protected static PLATFORM_ID: IntegrationPlatformId = INTEGRATION_ID.MIDDESK;
	// Override the minimum prediction score for the platform in classes that extend this one
	protected static MINIMUM_PREDICTION_SCORE = MINIMUM_PREDICTION_SCORE;
	taskHandlerMap: TaskHandlerMap = {
		/**
		 * Task handler for fetch_business_entity_verification.
		 *
		 * Note:
		 * The business entity verification logic is not normally executed via this task handler.
		 * Normally, the business entity verification logic is executed via the verification HTTP endpoints.
		 * However, if needed, this task handler can be used with the `forceRun` metadata flag to bypass
		 * this restriction and run the business entity verification logic via the task handler.
		 *
		 * Currently, this force run functionality is only used for the rerunIntegrations feature.
		 */
		fetch_business_entity_verification: async (taskId?: UUID, task?: IBusinessIntegrationTaskEnriched) => {
			if (!task) {
				const staticRef = this.constructor as typeof BusinessEntityVerificationService;
				task = await staticRef.getEnrichedTask(taskId!);
			}

			const metadata = task.metadata as (MiddeskCreateBusinessPayload & { forceRun?: boolean }) | undefined;

			/** Only run if metadata.forceRun is true */
			if (!metadata?.forceRun) return true;

			try {
				await this._submitBusinessEntityWithPayload({
					businessID: task.business_id,
					payload: metadata,
					taskID: task.id
				});
				return true;
			} catch (error) {
				logger.error(
					error,
					`Failed to process business entity verification for task ${task.id}: ${error instanceof Error ? error.message : "Unknown error"}`
				);
				throw error;
			}
		}
	};

	/**
	 * Determines if this integration should run based on business data and customer settings.
	 * Default implementation: US businesses with Extended KYB enabled (Middesk behavior).
	 * Override this method in subclasses to implement specific routing logic.
	 */
	public static async canIRun(businessId: UUID): Promise<boolean> {
		try {
			// Default Middesk behavior: US businesses with Extended KYB enabled
			const businessDetails = await getBusinessDetails(businessId);

			if (businessDetails.status === "success" && businessDetails.data) {
				const country = businessDetails.data.address_country;
				const isUS = !!country && ["US", "USA"].includes(country.toUpperCase().trim());

				// TODO: Check actual customer settings for Extended KYB
				// For now, default to true for US businesses (maintain existing behavior)
				const extendedKybEnabled = true; // This should come from customer settings

				const shouldRun = isUS && extendedKybEnabled;

				logger.debug(
					{
						businessId,
						country,
						isUS,
						extendedKybEnabled,
						shouldRun,
						platform: "MIDDESK"
					},
					"canIRun decision for Middesk"
				);

				return shouldRun;
			}

			// If we can't determine business details, default to true (run)
			logger.warn({ businessId }, "Could not determine business details for canIRun - defaulting to true");
			return true;
		} catch (error) {
			logger.error(error, `Error in canIRun for business ${businessId} - defaulting to true`);
			return true;
		}
	}

	async createConnection({ business_id, options }: { business_id: UUID; options: any }): Promise<IDBConnection> {
		// check if we already have a connection for this business entity and platform id
		let connection = await db<IDBConnection>("integrations.data_connections")
			.select("*")
			.where({
				business_id,
				platform_id: BusinessEntityVerificationService.PLATFORM_ID
			})
			.orderBy("created_at", "desc")
			.first();

		if (connection) {
			logger.debug("Returning existing connection for business entity verification");
			this.dbConnection = connection;
			return connection;
		}

		logger.info(`Creating connection for business entity verification, business_id: ${business_id}`);
		const insertedConnection = await db<IDBConnection>("integrations.data_connections")
			.insert({
				business_id,
				platform_id: BusinessEntityVerificationService.PLATFORM_ID,
				connection_status: CONNECTION_STATUS.CREATED,
				configuration: options
			})
			.onConflict(["business_id", "platform_id"])
			.merge({ updated_at: new Date().toISOString() as TDateISO })
			.returning("*");
		logger.debug(insertedConnection);

		if (insertedConnection && insertedConnection[0]) {
			logger.debug(`returning business entity verification connection ${JSON.stringify(insertedConnection[0])}`);
			this.dbConnection = insertedConnection[0];
			return insertedConnection[0];
		}
		logger.error(`businessId=${business_id} Could not create or retrieve connection for business entity verification,`);
		throw new Error("Could not initialize connection", connection);
	}

	public static async getOrCreateConnection(businessID: UUID): Promise<IDBConnection> {
		const upsertedConnection = await db<IDBConnection>("integrations.data_connections")
			.insert({
				business_id: businessID,
				platform_id: this.PLATFORM_ID,
				connection_status: CONNECTION_STATUS.CREATED,
				configuration: {}
			})
			.returning("*")
			.onConflict(["business_id", "platform_id"])
			// The merge is used to update the updated_at field to the current date to ensure that we return a row even if we don't create a new row
			.merge({ updated_at: new Date().toISOString() as TDateISO });
		return upsertedConnection[0];
	}

	/**
	 * This method is responsible for submitting a business entity for review with Middesk.
	 * Middesk will then perform the necessary checks to verify the business entity is legitimate.
	 * The full response from Middesk happens asynchronously via a webhook.
	 * We then consume that webhook (via handleBusinessEntityReviewUpdate) and update our database accordingly.
	 */
	async submitBusinessEntityForReview(params: BusinessEntityVerificationParams, authorization: string) {
		// get business details - this is a helper function that makes an API call to our case service
		const businessDetails = await getBusinessDetails(params.businessID, authorization);
		let taskID: UUID;
		return match(businessDetails)
			.with({ status: "success" }, async ({ data }) => {
				// create task entry
				taskID = await this.getOrCreateTaskForCode({
					taskCode: "fetch_business_entity_verification",
					reference_id: params.businessID
				});

				const middeskData: any = {
					name: data.name,
					addresses: [
						{
							address_line1: data.address_line_1,
							address_line2: data?.address_line_2 ?? undefined,
							postal_code: data.address_postal_code,
							city: data.address_city,
							// todo - remove this package in favor of our own DB table mapping of state codes
							// getStateCodeByStateName returns null if the state name is not found (E.g.: an abbreviation is actually passed in)
							state: (states.getStateCodeByStateName(data.address_state) ?? data.address_state ?? "")
								.substring(0, 2)
								.toUpperCase()
						}
					],
					tin: {
						tin: data.tin
					}
				};
				if (data.official_website) {
					middeskData.website = {
						url: data.official_website
					};
				}
				if (data.owners && isNonEmptyArray(data.owners)) {
					const peopleData: { name: string; dob?: string }[] = [];
					data.owners.forEach(owner => {
						const ownerName = [owner.first_name, owner.last_name].filter(Boolean).join(" ");
						const ownerDOB = toYMD(owner.date_of_birth);
						if (ownerName) {
							peopleData.push({
								name: ownerName,
								...(ownerDOB && { dob: ownerDOB })
							});
						}
					});
					middeskData.people = peopleData;
				}

				const uniqueExternalId = uuid();
				logger.info(`businessId=${params.businessID} uniqueExternalId=${uniqueExternalId}`);

				// submit the business entity for verification with our vendor
				const middeskResponse = await middesk.orderBusinessEntityVerification(
					{ businessID: uniqueExternalId },
					middeskData
				);

				const insert = await db<IBusinessEntityVerification>("integration_data.business_entity_verification")
					.insert({
						business_id: params.businessID,
						external_id: middeskResponse.id,
						business_integration_task_id: taskID,
						name: data.name,
						status: middeskResponse.status,
						tin: data.tin ? encryptData(data.tin) : null,
						unique_external_id: uniqueExternalId
					})
					.onConflict(["external_id"])
					.ignore()
					.returning("*");

				return insert[0];
			})
			.with({ status: "fail" }, async ({ message, errorCode }) => {
				const payload = {
					case_id: "",
					integration_category: "Business Entity Verification"
				};
				const connection = this.getDBConnection();
				if (connection) {
					const row = await db("public.data_cases")
						.select(db.raw("public.data_cases.id as case_id"))
						.join(
							"integrations.data_business_integrations_tasks",
							"integrations.data_business_integrations_tasks.business_score_trigger_id",
							"public.data_cases.score_trigger_id"
						)
						.where("integrations.data_business_integrations_tasks.id", taskID)
						.limit(1)
						.first();
					if (row && row.case_id) {
						payload.case_id = row.case_id;
					}
				}
				if (payload.case_id) {
					await producer.send({
						topic: kafkaTopics.CASES,
						messages: [
							{
								key: payload.case_id,
								value: {
									event: kafkaEvents.INTEGRATION_TASK_FAILED,
									...payload
								}
							}
						]
					});
				}

				throw new VerificationApiError(message, StatusCodes.BAD_REQUEST, errorCode);
			})
			.exhaustive();
	}

	/**
	 * Core business logic for submitting a business entity verification to Middesk.
	 */
	private async _submitBusinessEntityWithPayload(params: {
		businessID: UUID;
		payload: MiddeskCreateBusinessPayload;
		taskID: UUID;
	}): Promise<IBusinessEntityVerification> {
		const { businessID, payload, taskID } = params;
		const uniqueExternalId = uuid();
		logger.info(`businessId=${businessID} uniqueExternalId=${uniqueExternalId}`);

		/** Submit the business entity for verification with Middesk */
		const middeskResponse = await middesk.orderBusinessEntityVerification({ businessID: uniqueExternalId }, payload);

		const insert = await db<IBusinessEntityVerification>("integration_data.business_entity_verification")
			.insert({
				business_id: businessID,
				external_id: middeskResponse.id,
				business_integration_task_id: taskID,
				name: payload.name,
				status: middeskResponse.status,
				tin: payload.tin?.tin ? encryptData(payload.tin.tin) : null,
				unique_external_id: uniqueExternalId
			})
			.onConflict(["external_id"])
			.ignore()
			.returning("*");

		return insert[0];
	}

	/**
	 * This method is responsible for submitting a business entity for review with Middesk.
	 * Middesk will then perform the necessary checks to verify the business entity is legitimate.
	 * The full response from Middesk happens asynchronously via a webhook.
	 * We then consume that webhook (via handleBusinessEntityReviewUpdate) and update our database accordingly.
	 */
	async internalSubmitBusinessEntityForReview(
		params: BusinessEntityVerificationParams,
		body: InternalBusinessEntityVerification,
		authorization: string
	) {
		try {
			/** Transform the request body into Middesk payload format */
			const middeskData: MiddeskCreateBusinessPayload = {
				name: body.name,
				addresses: body.addresses.map(address => {
					return {
						address_line1: address.address_line_1,
						address_line2: address.address_line_2 ?? undefined,
						city: address.address_city,
						state: states.getStateCodeByStateName(address.address_state) ?? address.address_state,
						postal_code: address.address_postal_code
					};
				}),
				...(body.tin && { tin: { tin: body.tin } }),
				...(body.dba_names &&
					body.dba_names.length && { names: body.dba_names.map(name => ({ name, name_type: "dba" })) }),
				...(body.people && body.people.length && { people: body.people })
			};

			/**
			 * If no subproducts are specified and a website URL is provided,
			 * both web_analysis and industry_classification will be ordered.
			 * If no subproducts are specified and no website URL is included, only
			 * industry_classification will be ordered.
			 * https://docs.middesk.com/reference/order#website-order
			 */
			if (body.official_website) {
				middeskData.website = {
					url: body.official_website
				};
			}

			const taskID = await this.getOrCreateTaskForCode({
				taskCode: "fetch_business_entity_verification",
				reference_id: params.businessID
			});

			const isEasyFlow =
				authorization && (await getFlagValueByToken(FEATURE_FLAGS.WIN_1152_EASY_ONBOARDING_FLOW, { authorization }));

			/** For EasyFlow, generate dummy response without calling Middesk */
			if (isEasyFlow) {
				const uniqueExternalId = uuid();
				logger.warn(
					`businessId=${params.businessID} EasyFlow enabled, skipping Middesk order for business entity verification with external_id: ${uniqueExternalId}`
				);

				const insert = await db<IBusinessEntityVerification>("integration_data.business_entity_verification")
					.insert({
						business_id: params.businessID,
						external_id: uniqueExternalId,
						business_integration_task_id: taskID,
						name: body.name,
						status: "open",
						tin: body.tin ? encryptData(body.tin) : null,
						unique_external_id: uniqueExternalId
					})
					.onConflict(["external_id"])
					.ignore()
					.returning("*");

				const dummyMiddeskResponse = getDummyMiddeskResponse({
					unique_external_id: params.businessID,
					tin: body.tin || null,
					business_name: body.name,
					business_id: uniqueExternalId
				});
				await this.handleBusinessEntityReviewUpdate({ businessID: params.businessID }, dummyMiddeskResponse);

				return insert[0];
			}

			/** Normal flow: submit to Middesk */
			return await this._submitBusinessEntityWithPayload({
				businessID: params.businessID as UUID,
				payload: middeskData,
				taskID
			});
		} catch (error) {
			logger.error({ error }, 'Error submitting business to middesk');
			throw error;
		}
	}

	async internalVerifyBusinessEntityAndCreateOrUpdateOrder(
		params: BusinessEntityVerificationParams,
		body: InternalBusinessEntityVerification,
		authorization: string
	) {
		// fetch latest business entity verification record for given business_id
		const businessEntityVerification = await db<IBusinessEntityVerification>(
			"integration_data.business_entity_verification"
		)
			.select("*")
			.where({ business_id: params.businessID })
			.orderBy("created_at", "desc")
			.first();

		// if no business entity verification record exists, submit the business entity for review
		if (!businessEntityVerification || !businessEntityVerification?.external_id) {
			return this.internalSubmitBusinessEntityForReview(params, body, authorization);
		}

		// if business entity verification record exists, and we are not updating TIN, so no need to create new order, just re-order with new data
		if (businessEntityVerification && !body.tin) {
			const updateEntityBody: UpdateBusinessEntityPayload = {
				name: body.name,
				addresses: body.addresses,
				...(body.official_website && { website: { url: body.official_website } }),
				...(body.dba_names && body.dba_names.length && { dba_names: body.dba_names }),
				...(body.people && body.people.length && { people: body.people })
			};

			return this.updateBusinessEntityDetails(params, updateEntityBody);
		}

		// if business entity verification record exists, and TIN needs to update, then need to create new order with new TIN
		return this.internalSubmitBusinessEntityForReview(params, body, authorization);
	}

	/**
	 * This method is responsible for updating the details of a business entity with Middesk.
	 * For example, if the business initially inserted the wrong TIN or if the business entity has changed its name,
	 * we would call this method to update the details with Middesk.
	 */
	async updateBusinessEntityDetails(
		params: BusinessEntityVerificationParams,
		payload: Partial<UpdateBusinessEntityPayload>,
		isLightningVerification: boolean = false
	) {
		// get external_id from the businessID which in this context will be the business_id middesk uses
		const businessEntityVerification = await db<IBusinessEntityVerification>(
			"integration_data.business_entity_verification"
		)
			.select("*")
			.where({ business_id: params.businessID })
			.orderBy("created_at", "desc")
			.first();

		// if the business entity verification record doesn't exist, we need to create it
		// and submit the business instead of updating
		if (!businessEntityVerification?.external_id && isLightningVerification) {
			if (!payload.name || !payload.addresses?.length) {
				throw new VerificationApiError(
					"Data not sufficient to create business in middesk",
					StatusCodes.BAD_REQUEST,
					ERROR_CODES.INVALID
				);
			}
			const reorderPayload: MiddeskCreateBusinessPayload = {
				name: payload.name,
				addresses: payload.addresses.map(address => {
					return {
						address_line1: address.address_line_1,
						address_line2: address.address_line_2 ?? undefined,
						city: address.address_city,
						state: states.getStateCodeByStateName(address.address_state) ?? address.address_state,
						postal_code: address.address_postal_code
					};
				}),
				...(payload?.tin?.tin && { tin: { tin: payload.tin.tin } }),
				...(payload?.website?.url && { website: { url: payload.website.url } }),
				...(payload?.dba_names &&
					payload.dba_names.length && { names: payload.dba_names.map(name => ({ name, name_type: "dba" })) }),
				...(payload?.people && payload.people.length && { people: payload.people })
			};
			const submitResult = await this._reorderMiddeskBusiness(params, reorderPayload);
			return submitResult;
		}

		if (!businessEntityVerification?.external_id) {
			throw new VerificationApiError(
				`Business entity verification not found for ${params.businessID}`,
				StatusCodes.NOT_FOUND,
				ERROR_CODES.NOT_FOUND
			);
		}

		try {
			const { dba_names, tin, name, addresses, website, people } = payload;

			if (!name && dba_names?.length) {
				throw new VerificationApiError(
					"Name is required when dba_names are provided",
					StatusCodes.BAD_REQUEST,
					ERROR_CODES.INVALID
				);
			}

			const updateBusinessPayload: Partial<MiddeskUpdateBusinessPayload> = {
				...(name && { name }),
				...(tin && tin.tin && { tin }),
				...(addresses &&
					addresses.length && {
						addresses: addresses.map(address => ({
							address_line1: address.address_line_1,
							address_line2: address.address_line_2 ?? undefined,
							city: address.address_city,
							state: states.getStateCodeByStateName(address.address_state) ?? address.address_state,
							postal_code: address.address_postal_code
						}))
					}),
				...(dba_names && dba_names.length && { names: dba_names.map(name => ({ name, name_type: "dba" })) }),
				...(website && { website }),
				...(people && people.length && { people })
			};

			// if dba-names are present, then one legal name is compulsory
			if (updateBusinessPayload.name && updateBusinessPayload?.names && updateBusinessPayload.names.length) {
				updateBusinessPayload.names.push({
					name: updateBusinessPayload.name,
					name_type: "legal"
				});
			}

			// update the business entity with our vendor
			const middeskResponse = await middesk.updateBusinessEntityDetails(
				{ external_id: businessEntityVerification.external_id },
				updateBusinessPayload as MiddeskUpdateBusinessPayload
			);

			logger.info(
				`Business entity updated for business: ${middeskResponse.name} response: ${JSON.stringify(middeskResponse)}`
			);

			const upsert = await db<IBusinessEntityVerification>("integration_data.business_entity_verification")
				.where("external_id", businessEntityVerification.external_id)
				.update({
					name: middeskResponse.name,
					business_integration_task_id: businessEntityVerification.business_integration_task_id,
					business_id: params.businessID,
					...(isLightningVerification && { status: "in_review" }),
					// middesk stores TINs formatted with dashes, so we remove them here to be consistent with how they're stored in our DB
					tin: this.tinSanity(middeskResponse)
				})
				.returning("*");

			// we don't need to mark task status as success here, as the webhook event will do that for us
			// instead mark it as in progress
			await this.updateTaskStatus(businessEntityVerification.business_integration_task_id, TASK_STATUS.IN_PROGRESS, {
				event: "business_entity_verification details updated"
			});

			// Delete old data as it is not needed. We will check for the latest data
			await this.deleteVerificationData(businessEntityVerification.id);

			// Make order for business_verification_verify package
			const orderPayload = {
				package: "business_verification_verify",
				subproducts: []
			};

			const orderResponse = await middesk.createOrder(businessEntityVerification.external_id as UUID, orderPayload);
			logger.info(
				`Middesk order created for business: ${middeskResponse.name} response: ${JSON.stringify(orderResponse)}`
			);

			const websiteOrderPayload = {
				package: "website",
				subproducts: ["web_analysis"]
			};

			if (payload?.website?.url) {
				// Make order for website package
				const websiteOrderResponse = await middesk.createOrder(
					businessEntityVerification.external_id as UUID,
					websiteOrderPayload
				);
				logger.info(
					`Middesk website order created for business: ${middeskResponse.name} response: ${JSON.stringify(websiteOrderResponse)}`
				);
			}

			return upsert[0];
		} catch (error) {
			// If middesk business stored in db is not present on Middesk for business. then resubmit
			if (axios.isAxiosError(error)) {
				const resubmitFlag = await getFlagValue(FEATURE_FLAGS.DOS_84_RESUBMIT_ON_NOT_FOUND);
				if (error.code === "404" && resubmitFlag) {
					await db<IBusinessEntityVerification>("integration_data.business_entity_verification")
						.update({ external_id: "" })
						.where({ business_id: params.businessID });
					if (!payload.name || !payload?.addresses?.length) {
						throw new VerificationApiError(
							"Data not sufficient to create business in middesk",
							StatusCodes.BAD_REQUEST,
							ERROR_CODES.INVALID
						);
					}
					const reorderPayload: MiddeskCreateBusinessPayload = {
						name: payload.name,
						addresses: payload.addresses.map(address => {
							return {
								address_line1: address.address_line_1,
								address_line2: address.address_line_2 ?? undefined,
								city: address.address_city,
								state: states.getStateCodeByStateName(address.address_state) ?? address.address_state,
								postal_code: address.address_postal_code
							};
						}),
						...(payload?.tin?.tin && { tin: { tin: payload.tin.tin } }),
						...(payload?.website?.url && { website: { url: payload.website.url } }),
						...(payload?.dba_names &&
							payload.dba_names.length && { names: payload.dba_names.map(name => ({ name, name_type: "dba" })) }),
						...(payload?.people && payload.people.length && { people: payload.people })
					};
					const submitResult = await this._reorderMiddeskBusiness(params, reorderPayload);
					return submitResult;
				}
			}
			logger.error({ error }, 'Error updating business to middesk');
			throw error;
		}
	}

	/**
	 * This method is responsible for deleting the old verification data for a business entity.
	 * This is done to ensure that we are only storing the latest data for a business entity.
	 * @param businessEntityVerificationId - The ID of the business entity verification record to delete data for
	 * @returns - A promise that resolves when the data has been deleted
	 */
	private async deleteVerificationData(businessEntityVerificationId: UUID): Promise<void> {
		Promise.allSettled([
			db("integration_data.business_entity_review_task")
				.where({ business_entity_verification_id: businessEntityVerificationId })
				.delete(),
			db("integration_data.business_entity_address_source")
				.where({ business_entity_verification_id: businessEntityVerificationId })
				.delete(),
			db("integration_data.business_entity_registration")
				.where({ business_entity_verification_id: businessEntityVerificationId })
				.delete(),
			db("integration_data.business_entity_people")
				.where({ business_entity_verification_id: businessEntityVerificationId })
				.delete(),
			db("integration_data.business_entity_names")
				.where({ business_entity_verification_id: businessEntityVerificationId })
				.delete()
		]);
	}

	async _reorderMiddeskBusiness(params: BusinessEntityVerificationParams, payload: MiddeskCreateBusinessPayload) {
		const taskID = await this.getOrCreateTaskForCode({
			taskCode: "fetch_business_entity_verification",
			reference_id: params.businessID
		});

		if (payload.addresses) {
			payload.addresses[0].state = states.getStateCodeByStateName(payload.addresses[0].state) as string;
		}

		const uniqueExternalId = uuid();
		logger.info(`businessId=${params.businessID} uniqueExternalId=${uniqueExternalId}`);

		const middeskResponse = await middesk.orderBusinessEntityVerification({ businessID: uniqueExternalId }, payload);
		const insert = await db<IBusinessEntityVerification>("integration_data.business_entity_verification")
			.insert({
				business_id: params.businessID,
				external_id: middeskResponse.id,
				business_integration_task_id: taskID,
				name: payload.name,
				status: middeskResponse.status,
				tin: payload.tin?.tin ? encryptData(payload.tin?.tin) : null,
				unique_external_id: uniqueExternalId
			})
			.onConflict(["external_id"])
			.ignore()
			.returning("*");

		return insert[0];
	}

	/**
	 * This method is responsible for handling the webhook event from Middesk.
	 * The event will contain the updated business entity verification status.
	 * We will then update our database accordingly.
	 */
	async handleBusinessEntityReviewUpdate(
		params: BusinessEntityVerificationParams,
		event: VerificationReviewWebhookEvent
	) {
		// find our corresponding business entity verification record in the database
		const businessEntityVerification = await db<IBusinessEntityVerification>(
			"integration_data.business_entity_verification"
		)
			.select("*")
			.where({ business_id: params.businessID })
			.orderBy("created_at", "desc")
			.first();

		if (businessEntityVerification) {
			const middeskBusinessDetails = event.data.object as BusinessEntityVerificationResponse;

			// When the environment variable is set, we will mock a timeout by not ingesting the webhook event
			if (
				envConfig.MIDDESK_TIN_MOCK_TIMEOUT &&
				middeskBusinessDetails.tin?.tin &&
				middeskBusinessDetails.tin?.tin.replace(/-/g, "") === envConfig.MIDDESK_TIN_MOCK_TIMEOUT
			) {
				if (middeskBusinessDetails.status === "in_review") {
					logger.warn(
						`businessId=${params.businessID} mockTimeoutTin=${envConfig.MIDDESK_TIN_MOCK_TIMEOUT} Mocking business entity verification timeout`
					);
					return;
				}
				logger.info(
					`businessId=${params.businessID} mockTimeoutTin=${envConfig.MIDDESK_TIN_MOCK_TIMEOUT} - bypassing mock because record state is ${middeskBusinessDetails.status}`
				);
			}
			logger.info(
				`Business details for id: ${middeskBusinessDetails.id} and name: ${middeskBusinessDetails.name} — updated by the vendor`
			);
			// Create a copy of middeskBusinessDetails with the encrypted TIN
			const middeskBusinessDetailsWithEncryptedTin = {
				...middeskBusinessDetails,
				tin: {
					...middeskBusinessDetails.tin,
					tin: this.tinSanity(middeskBusinessDetails)
				},
				submitted: {
					...middeskBusinessDetails.submitted,
					tin: this.tinSanity(middeskBusinessDetails)
				}
			};

			const taskId = await this.getOrCreateTaskForCode({
				taskCode: "fetch_business_entity_verification",
				reference_id: params.businessID,
				metadata: (() => {
					const { actions, submitted, status, tags, id, tin, unique_external_id } =
						middeskBusinessDetailsWithEncryptedTin;
					return {
						actions,
						submitted,
						status,
						tags,
						id,
						tin,
						unique_external_id
					};
				})()
			});

			try {
				const task = await TaskManager.getEnrichedTask(taskId);
				await this.saveRequestResponse(task, middeskBusinessDetails, middeskBusinessDetails.id);
			} catch (error) {
				logger.error(
					`Error saving request response for business entity verification ${businessEntityVerification.id} with error ${JSON.stringify(error)}`
				);
			}

			// update business entity verification status
			await db("integration_data.business_entity_verification")
				.update({
					status: middeskBusinessDetails?.status ?? null,
					formation_date: middeskBusinessDetails?.formation?.formation_date ?? null,
					formation_state: middeskBusinessDetails?.formation?.formation_state ?? null
				})
				.where({ id: businessEntityVerification.id });

			logger.info(
				`Business entity name: ${middeskBusinessDetails.name} id: ${businessEntityVerification.id} — verification status updated to: ${middeskBusinessDetails.status}`
			);

			const mappedReviewTasks = middeskBusinessDetails.review?.tasks?.map(task => {
				let metadata = task.sources;

				// For watchlist tasks, extract watchlist hits from middeskBusinessDetails.watchlist
				// which contains URLs and full watchlist data that task.sources might not have
				if (task.key === "watchlist" && middeskBusinessDetails.watchlist?.lists) {
					const watchlistHits: any[] = [];
					for (const list of middeskBusinessDetails.watchlist.lists) {
						if (list.results && Array.isArray(list.results)) {
							for (const result of list.results) {
								watchlistHits.push({
									id: result.id,
									type: "watchlist_result",
									entity_type: WATCHLIST_ENTITY_TYPE.BUSINESS, // Middesk watchlist hits are always BUSINESS (KYB)
									metadata: {
										abbr: list.abbr || "",
										title: list.title || "",
										agency: list.agency || "",
										agency_abbr: list.agency_abbr || "",
										entity_name: result.entity_name || ""
									},
									url: result.url || null,
									list_url: result.list_url || null,
									agency_information_url: result.agency_information_url || null,
									agency_list_url: result.agency_list_url || null,
									list_country: result.list_country || null,
									list_region: result.list_region || null,
									entity_aliases: result.entity_aliases || [],
									addresses: result.addresses || [],
									listed_at: result.listed_at || null,
									categories: result.categories || [],
									score: result.score
								});
							}
						}
					}
					// Use watchlist hits if available, otherwise fall back to task.sources
					if (watchlistHits.length > 0) {
						metadata = watchlistHits;
					}
				}

				return {
					business_entity_verification_id: businessEntityVerification.id,
					category: task.category,
					key: task.key,
					status: task.status,
					message: task.message,
					label: task.label,
					sublabel: task.sub_label,
					metadata: JSON.stringify(metadata)
				};
			});

			// upsert review task
			if (mappedReviewTasks && mappedReviewTasks.length > 0) {
				await db("integration_data.business_entity_review_task")
					.insert(mappedReviewTasks)
					.onConflict(["business_entity_verification_id", "key"])
					.merge({
						status: db.raw("EXCLUDED.status"),
						message: db.raw("EXCLUDED.message"),
						label: db.raw("EXCLUDED.label"),
						sublabel: db.raw("EXCLUDED.sublabel"),
						metadata: db.raw("EXCLUDED.metadata")
					});
				logger.info(
					`Business entity name: ${middeskBusinessDetails.name} id: ${businessEntityVerification.id} — review tasks upserted: ${mappedReviewTasks?.length} records`
				);
			}

			const mappedAddressSources = middeskBusinessDetails.addresses
				// Remove when submitted=true and address.sources.length === 0
				.filter(address => !(address.submitted === true && (address.sources?.length || 0) === 0))
				.map(address => ({
					business_entity_verification_id: businessEntityVerification.id,
					external_id: address.id,
					full_address: address?.full_address ?? undefined,
					address_line_1: address?.address_line1 ?? undefined,
					address_line_2: address?.address_line2 ?? undefined,
					city: address.city,
					state: address.state,
					postal_code: address.postal_code,
					lat: address?.latitude ?? undefined,
					long: address?.longitude ?? undefined,
					submitted: address.submitted,
					deliverable: address.deliverable,
					cmra: address.cmra,
					address_property_type: address.property_type,
					external_registration_id:
						isNonEmptyArray(address.sources) && address.sources[0].type === "registration"
							? address.sources[0].id
							: undefined
				}));
			// upsert business entity address source
			if (mappedAddressSources && mappedAddressSources?.length > 0) {
				await db("integration_data.business_entity_address_source")
					.insert(mappedAddressSources)
					.onConflict(["external_id"])
					.merge()
					.returning("*");
				logger.info(
					`Business entity name: ${middeskBusinessDetails.name} id: ${businessEntityVerification.id} — address sources upserted: ${mappedAddressSources.length} records`
				);
			}

			const mappedRegistrations = middeskBusinessDetails.registrations?.map(registration => ({
				business_entity_verification_id: businessEntityVerification.id,
				external_id: registration.id,
				name: registration.name,
				status: registration.status,
				sub_status: registration.sub_status,
				status_details: registration.status_details,
				jurisdiction: registration.jurisdiction,
				entity_type: registration.entity_type,
				file_number: registration.file_number,
				full_addresses: registration.addresses,
				registration_date: registration.registration_date,
				registration_state: registration.state,
				source: registration.source
			}));
			// upsert business entity registration
			if (mappedRegistrations && mappedRegistrations?.length > 0) {
				await db("integration_data.business_entity_registration")
					.insert(mappedRegistrations)
					.onConflict(["external_id"])
					.merge();
				logger.info(
					`Business entity name: ${middeskBusinessDetails.name} id: ${businessEntityVerification.id} — registrations upserted: ${mappedRegistrations.length} records`
				);
			}

			await this.upsertBusinessEntityPeople(
				middeskBusinessDetails.people,
				businessEntityVerification.id,
				middeskBusinessDetails.watchlist
			);
			await this.upsertBusinessEntityNames(middeskBusinessDetails.names, businessEntityVerification.id);

			await this.updateTaskStatus(taskId, TASK_STATUS.SUCCESS, {
				event: "business_entity_verification updated details asynchronously via webhook event",
				webhookEventId: event.id,
				webhookEventType: event.type
			});

			const task = await TaskManager.getEnrichedTask(taskId);

			// handle website data
			if (middeskBusinessDetails.website) {
				let middeskWebsiteTask = await TaskManager.getLatestTaskForBusiness(
					params.businessID as UUID,
					INTEGRATION_ID.MIDDESK,
					"fetch_business_entity_website_details",
					false,
					"",
					""
				);

				if (!middeskWebsiteTask) {
					await TaskManager.createTask({
						connection_id: task.connection_id,
						integration_task_id: INTEGRATION_TASK.fetch_middesk_business_entity_website_details,
						business_score_trigger_id: task.business_score_trigger_id,
						task_status: TASK_STATUS.CREATED
					});
					middeskWebsiteTask = await TaskManager.getLatestTaskForBusiness(
						params.businessID as UUID,
						INTEGRATION_ID.MIDDESK,
						"fetch_business_entity_website_details",
						false,
						"",
						""
					);
				}

				await this.saveWebsiteDetails(params.businessID as UUID, middeskBusinessDetails.website, middeskWebsiteTask);

				await this.updateTaskStatus(middeskWebsiteTask.id, TASK_STATUS.SUCCESS, middeskBusinessDetails.website);
			}

			await this.sendTaskCompleteMessage(task);

			// upload info into S3 for worth AI scoring model to ingest
			await uploadRawIntegrationDataToS3(
				middeskBusinessDetailsWithEncryptedTin,
				params.businessID,
				"business_entity_verification",
				DIRECTORIES.BUSINESS_ENTITY_VERIFICATION,
				"MIDDESK"
			);
		}
	}

	async upsertBusinessEntityPeople(
		people: BusinessEntityVerificationResponse["people"],
		businessEntityVerificationId: UUID,
		watchlists?: BusinessEntityVerificationResponse["watchlist"]
	) {
		const mappedPeople = people.reduce((acc, item) => {
			if (item) {
				const person: IBusinessEntityPerson = {
					business_entity_verification_id: businessEntityVerificationId,
					name: item.name,
					submitted: item.submitted,
					source: JSON.stringify(item.sources),
					titles: item.titles?.map(title => title.title) ?? [],
					metadata: JSON.stringify(item)
				} as IBusinessEntityPerson;
				acc.push(person);
			}
			return acc;
		}, [] as IBusinessEntityPerson[]);
		if (mappedPeople.length === 0) return;

		// this logic is required to match the higher level watchlist data with the people data
		if (watchlists && watchlists.hit_count > 0 && watchlists.lists) {
			for (const list of watchlists.lists) {
				const results = list.results;
				if (results && results.length > 0) {
					for (const result of results) {
						//using the id from the result, match with the metadata field in the people array
						const id = result.id;
						mappedPeople.forEach(person => {
							const metadata = JSON.parse(person.metadata);
							const sourceIndex = metadata.sources.findIndex(source => source.id === id);

							if (sourceIndex > -1) {
								metadata.sources[sourceIndex] = {
									...metadata.sources[sourceIndex],
									...result
								};
								person.metadata = JSON.stringify(metadata);
							}
						});
					}
				}
			}
		}
		const inserted = await db<IBusinessEntityPerson>("integration_data.business_entity_people")
			.insert(mappedPeople)
			.returning("*")
			.onConflict(["business_entity_verification_id", "name"])
			.merge();
		logger.info(
			`Upserted ${inserted.length} people records for business entity verification id: ${businessEntityVerificationId}`
		);
	}

	async upsertBusinessEntityNames(
		names: BusinessEntityVerificationResponse["names"],
		businessEntityVerificationId: UUID
	) {
		type ElementOf<T> = T extends Array<infer U> ? U : never;
		const fingerprintName = (record: ElementOf<BusinessEntityVerificationResponse["names"]>) => {
			return `${businessEntityVerificationId}::${record.name}`;
		};
		const mappedNames = names.reduce(
			(acc, item) => {
				if (item) {
					const fingerprint = fingerprintName(item);
					if (!acc[fingerprint]) {
						const businessEntityName: IBusinessEntityName = {
							business_entity_verification_id: businessEntityVerificationId,
							name: item.name,
							submitted: item.submitted,
							source: JSON.stringify(item.sources),
							type: item.type || "other",
							metadata: JSON.stringify(item)
						} as IBusinessEntityName;
						acc[fingerprint] = businessEntityName;
					}
				}
				return acc;
			},
			{} as Record<string, IBusinessEntityName>
		);
		if (Object.values(mappedNames).length === 0) return;
		const inserted = await db<IBusinessEntityName>("integration_data.business_entity_names")
			.insert(Object.values(mappedNames))
			.returning("*")
			.onConflict(["business_entity_verification_id", "name"])
			.merge();
		logger.info(
			`Upserted ${inserted.length} names records for business entity verification id: ${businessEntityVerificationId}`
		);
	}

	/**
	 * This method is responsible for retrieving all informaton/records relevant to the verification status of a business entity.
	 * This information is stored in our database and is used to determine if the business entity is verified.
	 */
	async getBusinessEntityReview(
		params: BusinessEntityVerificationParams,
		userInfo: BusinessEntityVerificationUserInfo
	) {
		// TODO: check for customer buiness is pending, as we dont have customer-id in token
		if (userInfo?.role?.code === ROLES.APPLICANT) {
			// check for applicant business
			const records = await getBusinessApplicants(params.businessID);
			const applicants = records.map(applicant => applicant.id);

			if (!applicants.includes(userInfo.user_id)) {
				throw new VerificationApiError(
					"You are not allowed to access details of this business",
					StatusCodes.UNAUTHORIZED,
					ERROR_CODES.UNAUTHENTICATED
				);
			}
		} else if (userInfo?.role?.code === ROLES.CUSTOMER) {
			// check for customer business
			// const records = await getCustomerBusinesses(userInfo.user_id, headers.authorization);
			// const customers = records.map(customer => customer.customer_id);
			// if (!customers.includes(userInfo.customer_id)) {
			// 	throw new VerificationApiError("You are not allowed to access details of this business", StatusCodes.UNAUTHORIZED, ERROR_CODES.UNAUTHENTICATED);
			// }
		}

		// return all relevant information about the business entitys verification status from our database
		// Note: business_entity_verification table doesn't have platform_id column directly
		// We need to join with the task/connection to filter by platform_id if needed

		let query = db<IBusinessEntityVerification>("integration_data.business_entity_verification")
			.select("integration_data.business_entity_verification.*")
			.where("integration_data.business_entity_verification.business_id", params.businessID);

		// If platformID is provided, filter by joining with the task and connection
		if (params.platformID) {
			query = query
				.join(
					"integrations.data_business_integrations_tasks",
					"integration_data.business_entity_verification.business_integration_task_id",
					"integrations.data_business_integrations_tasks.id"
				)
				.join(
					"integrations.data_connections",
					"integrations.data_business_integrations_tasks.connection_id",
					"integrations.data_connections.id"
				)
				.where("integrations.data_connections.platform_id", params.platformID);
		}

		const businessEntityVerification = await query
			.orderBy("integration_data.business_entity_verification.created_at", "desc")
			.first();

		logger.info(
			`businessEntityVerification for business: ${params.businessID}, platformID: ${params.platformID} ${JSON.stringify(businessEntityVerification)}`
		);

		if (!businessEntityVerification) {
			// Check if there are any business_entity_verification records for this business (regardless of platform)
			const anyVerificationRecord = await db<IBusinessEntityVerification>(
				"integration_data.business_entity_verification"
			)
				.select("integration_data.business_entity_verification.*")
				.where("integration_data.business_entity_verification.business_id", params.businessID)
				.orderBy("integration_data.business_entity_verification.created_at", "desc")
				.first();

			if (anyVerificationRecord) {
				logger.debug(
					`Found business_entity_verification record for business ${params.businessID} but it doesn't match platform filter (platformID: ${params.platformID}). Record ID: ${anyVerificationRecord.id}`
				);
			}
			const data = await db<IRequestResponse>("integration_data.request_response")
				.select("*")
				.where("business_id", params.businessID)
				.andWhere("platform_id", 21)
				.andWhereRaw(
					`not exists( select 1 from integration_data.business_entity_verification bev where bev.business_id = '${params.businessID}' )`
				)
				.andWhereRaw(`response::json->>'id' is not null`)
				.orderBy("request_received", "desc")
				.limit(1);

			const request_response = data[0];

			if (!request_response) {
				// Log as warning instead of error - this is expected when only PSC records exist (no KYB)
				logger.warn(
					`businessId=${params.businessID} No valid business entity verification record found for business: ${params.businessID}. This may be expected if only PSC (person screening) records exist without KYB records.`
				);
				return {};
			}

			const reqResData = request_response.response;
			const businessEntityVerification = {
				external_id: reqResData.external_id,
				business_id: params.businessID,
				name: reqResData.name,
				tin: reqResData.tin || null,
				formation_state: reqResData.state
			};
			const registration = {
				name: reqResData.name,
				entity_type: reqResData.business_type,
				registration_state: reqResData.state,
				status: "warning"
			};

			const city = reqResData.city || reqResData.address_city;

			const addressSource = {
				full_address:
					reqResData.address_line_1 && city && reqResData.state && reqResData.address_postal_code
						? `${reqResData.address_line_1}, ${city}, ${reqResData.state} ${reqResData.address_postal_code}`
						: null,
				address_line_1: reqResData.address_line_1,
				address_line_2: reqResData.address_line_2,
				city,
				state: reqResData.state,
				postal_code: reqResData.address_postal_code
			};

			const name = {
				name: reqResData.name,
				submitted: false
			};

			const reviewTasks: Partial<IBusinessEntityReviewTask>[] = [];

			if (addressSource.full_address) {
				reviewTasks.push({
					category: "address",
					key: "address_verification",
					status: "warning",
					sublabel: "Verified",
					metadata: [
						{
							type: "address",
							metadata: addressSource
						}
					]
				});
			}

			if (name.name) {
				reviewTasks.push({
					category: "name",
					key: "name",
					status: "warning",
					label: "Business Name",
					sublabel: "Verified",
					metadata: [
						{
							type: "name",
							metadata: name
						}
					]
				});
			}

			return {
				businessEntityVerification,
				registrations: [registration],
				reviewTasks,
				addressSources: [addressSource],
				names: [name]
			};
		}

		const [reviewTasks, registrations, addressSources, people, names] = await Promise.all([
			this.getReviewTasks(businessEntityVerification.id),
			this.getRegistrations(businessEntityVerification.id),
			this.getAddressSources(businessEntityVerification.id),
			this.getEntityPeople(businessEntityVerification),
			this.getEntityNames(businessEntityVerification)
		]);

		// fetch year, number_of_employees from s3
		const middeskUpdateDataFromS3: BulkUpdateMiddeskData = await getRawIntegrationDataFromS3(
			params.businessID,
			"BulkUpdateBusinessMap",
			DIRECTORIES.MANUAL,
			"MANUAL",
			false
		);
		let middeskCreateDataFromS3: BulkUpdateMiddeskData | null = null;
		if (!middeskUpdateDataFromS3?.data?.year || !middeskUpdateDataFromS3?.data?.number_of_employees) {
			// if not found then check into createmapper
			middeskCreateDataFromS3 = await getRawIntegrationDataFromS3(
				params.businessID,
				"bulkCreateBusinessMapper",
				DIRECTORIES.MANUAL,
				"MANUAL",
				false
			);
		}
		let decryptedTIN = null;
		try {
			decryptedTIN = businessEntityVerification.tin ? decryptData(businessEntityVerification.tin) : null;
		} catch (error: any) {
			logger.error(
				`businessID=${businessEntityVerification.business_id} Error decrypting TIN for business entity verification id ${businessEntityVerification.id} : ${error.message}`
			);
			logger.error(`getBusinessEntityReview: ${error.message}`);
			decryptedTIN = null;
		}
		return {
			businessEntityVerification: {
				...businessEntityVerification,
				tin: decryptedTIN,
				year: middeskUpdateDataFromS3?.data?.year || middeskCreateDataFromS3?.data?.year || null,
				number_of_employees:
					middeskUpdateDataFromS3?.data?.number_of_employees ||
					middeskCreateDataFromS3?.data?.number_of_employees ||
					null
			},
			reviewTasks,
			registrations,
			addressSources,
			people,
			names
		};
	}

	// Attempt hydration on an empty result set if the business entity verification is before July 10 2024
	@HydrateFromWarehouse({
		// A BEV won't always have people, so just check if the BEV is from before this change went out to determine if we should hydrate
		checkFn: (bev: IBusinessEntityVerification) =>
			Promise.resolve(dayjs(bev.updated_at || bev.created_at).isBefore("2024-07-10")),
		hydrateFn: async function (this: BusinessEntityVerificationService, _, bev: IBusinessEntityVerification) {
			// Update the parent BEV record to make sure the record is no longer in scope for possible hydration thanks to the checkFn in getEntityPeople
			await db("integration_data.business_entity_verification")
				.update({ updated_at: db.raw("now()") })
				.where({ id: bev.id });

			const rawRecord: BusinessEntityVerificationResponse = await getRawIntegrationDataFromS3(
				bev.business_id,
				"business_entity_verification",
				DIRECTORIES.BUSINESS_ENTITY_VERIFICATION,
				"MIDDESK",
				false
			);
			if (rawRecord?.people) {
				await this.upsertBusinessEntityPeople(rawRecord.people, bev.id, rawRecord.watchlist);
			}
		}
	})
	async getEntityPeople(bev: IBusinessEntityVerification): Promise<IBusinessEntityPerson[]> {
		return db<IBusinessEntityPerson>("integration_data.business_entity_people")
			.select("*")
			.where({ business_entity_verification_id: bev.id })
			.then(people =>
				people.map(person => {
					// Remove metadata from being returned to the client
					delete person.metadata;
					return person;
				})
			);
	}

	// Attempt hydration on an empty result set if the business entity verification is before July 10 2024
	@HydrateFromWarehouse({
		// A BEV won't always have names, so just check if the BEV is from before this change went out to determine if we should hydrate
		checkFn: (bev: IBusinessEntityVerification) =>
			Promise.resolve(dayjs(bev.updated_at || bev.created_at).isBefore("2024-08-01")),
		hydrateFn: async function (this: BusinessEntityVerificationService, _, bev: IBusinessEntityVerification) {
			const rawRecord: BusinessEntityVerificationResponse = await getRawIntegrationDataFromS3(
				bev.business_id,
				"business_entity_verification",
				DIRECTORIES.BUSINESS_ENTITY_VERIFICATION,
				"MIDDESK",
				false
			);
			// Update the parent BEV record to make sure the record is no longer in scope for possible hydration thanks to the checkFn in getEntityPeople
			await db("integration_data.business_entity_verification")
				.update({ updated_at: db.raw("now()") })
				.where({ id: bev.id });
			if (rawRecord?.names) {
				await this.upsertBusinessEntityNames(rawRecord.names, bev.id);
			}
		}
	})
	async getEntityNames(bev: IBusinessEntityVerification): Promise<IBusinessEntityName[]> {
		return db<IBusinessEntityName>("integration_data.business_entity_names")
			.select("*")
			.where({ business_entity_verification_id: bev.id })
			.then(names =>
				names.map(name => {
					delete name.metadata;
					return name;
				})
			);
	}

	async getEntityPeopleHydrateFromWarehouse(_, bev: IBusinessEntityVerification): Promise<void> {}

	/*
	 * @description Pull back the review tasks, address sources, and registrations for a business entity verification
	 * @param {UUID} worthBusinessId - The internal Worthbusiness ID
	 * @param {UUID} businessEntityVerificationId - The business entity verification ID
	 * @returns {{reviewTasks: IBusinessEntityReviewTask[], addressSources: IBusinessEntityAddressSource[], registrations: IBusinessEntityRegistration[]}} - reviewTasks, addressSources, registrations from the business entity verification
	 */
	protected async getBusinessEntityVerificationComponents({
		businessId,
		businessEntityVerificationId
	}:
		| { businessId: UUID; businessEntityVerificationId?: never }
		| { businessId?: never; businessEntityVerificationId: UUID }): Promise<
		| {
				reviewTasks: IBusinessEntityReviewTask[];
				addressSources: IBusinessEntityAddressSource[];
				registrations: IBusinessEntityRegistration[];
		  }
		| undefined
	> {
		// If businessId is provided, we need to get the businessEntityVerificationId from the database
		if (businessId) {
			const businessEntityVerification = await db<Pick<IBusinessEntityVerification, "id" | "business_id">>(
				"integration_data.business_entity_verification"
			)
				.select("id")
				.where({ business_id: businessId })
				.first();
			if (businessEntityVerification?.id) {
				businessEntityVerificationId = businessEntityVerification.id;
			}
		}

		// If businessEntityVerificationId is available, we can get the review tasks from the database
		if (businessEntityVerificationId) {
			const [reviewTasksResult, addressSourcesResult, registrationsResult] = await Promise.allSettled([
				this.getReviewTasks(businessEntityVerificationId),
				this.getAddressSources(businessEntityVerificationId),
				this.getRegistrations(businessEntityVerificationId)
			]);

			return {
				reviewTasks: reviewTasksResult.status === "fulfilled" ? reviewTasksResult.value : [],
				addressSources: addressSourcesResult.status === "fulfilled" ? addressSourcesResult.value : [],
				registrations: registrationsResult.status === "fulfilled" ? registrationsResult.value : []
			};
		}
	}

	async createTaskAndFetchMiddeskWebsiteData(
		body: { business_id: UUID; website: string } & (
			| { case_id: UUID; score_trigger_id?: never }
			| { case_id: never; score_trigger_id: UUID }
		)
	) {
		try {
			const response = await this.getBusinessEntityVerificationComponents({ businessId: body.business_id });
			if (!response) {
				return;
			}
			const isMocked = await BusinessEntityVerificationService.isMockedResponse(response);
			if (isMocked) {
				// If the Middesk response is mocked, then we already have a valid website response
				return;
			}
			const taskId = await this.getTaskForCode({
				taskCode: "fetch_business_entity_verification",
				conditions: [{ column: "task_status", operator: "=", value: TASK_STATUS.SUCCESS }]
			});
			if (!taskId) {
				logger.error(
					`createTaskAndFetchMiddeskWebsiteData : No succesful middesk task found for businessID: ${body.business_id} and optional caseID: ${body.case_id}`
				);
				throw new VerificationApiError(
					"createTaskAndFetchMiddeskWebsiteData : No middesk task found",
					StatusCodes.NOT_FOUND,
					ERROR_CODES.NOT_FOUND
				);
			}
			// get external_id from the businessID which in this context will be the business_id middesk uses
			// we are not refetching middesk in refresh so we will not get it with the task rather check with business_id
			const businessEntityVerification = await db<IBusinessEntityVerification>(
				"integration_data.business_entity_verification"
			)
				.select("*")
				.where({ business_id: body.business_id, business_integration_task_id: taskId })
				.first();

			if (!businessEntityVerification?.external_id) {
				logger.error(
					`createTaskAndFetchMiddeskWebsiteData : Business entity verification not found for ${body.business_id}`
				);
				throw new VerificationApiError(
					`Business entity verification not found for ${body.business_id} and task ${taskId}`,
					StatusCodes.NOT_FOUND,
					ERROR_CODES.NOT_FOUND
				);
			}

			const websiteTaskID = await this.getOrCreateTaskForCode({
				taskCode: "fetch_business_entity_website_details",
				reference_id: taskId,
				metadata: { website: body.website },
				scoreTriggerId: body.score_trigger_id
			});

			try {
				// we will get latest website details for business in webhook after the order is completed
				const response = await middesk.createOrder(businessEntityVerification.external_id as UUID, {
					package: "website",
					subproducts: ["web_analysis"]
				});
				await this.updateTask(websiteTaskID, { metadata: response, task_status: TASK_STATUS.IN_PROGRESS });
			} catch (err: any) {
				if (err.status === 404) {
					logger.error(`Middesk website data not found for businessID: ${body.business_id} `);
					await this.updateTask(websiteTaskID, { metadata: err, task_status: TASK_STATUS.FAILED });
				} else {
					throw err;
				}
			}
		} catch (error) {
			throw error;
		}
	}

	async getMiddeskWebsiteResponse(businessID: UUID) {
		try {
			const middeskResponse = await middesk.getBusinessEntityWebsiteDetails(businessID);
			return middeskResponse;
		} catch (error) {
			throw error;
		}
	}

	/**
	 * @deprecated Use WebsiteScanner functionality instead.
	 */
	async fetchMiddeskWebsiteDetails(businessID: UUID, task: IBusinessIntegrationTaskEnriched) {
		await this.updateTaskStatus(task.id, TASK_STATUS.IN_PROGRESS);

		const middeskRecord = await db("integration_data.business_entity_verification")
			.select("external_id")
			.where({ business_id: businessID })
			.first();

		// Sometimes the BEV record may not exist yet, so we need to handle that case
		if (!middeskRecord?.external_id) {
			const msg = `Middesk business entity verification record not found for businessID: ${businessID}`;

			await this.updateTaskStatus(task.id, TASK_STATUS.FAILED, {
				fetchMiddeskWebsiteDetails: msg
			});
			logger.error(`fetchMiddeskWebsiteDetails: ${msg}`);
			throw new VerificationApiError(msg, StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
		}

		try {
			let websiteDetails = await this.getMiddeskWebsiteResponse(middeskRecord.external_id);

			await this.updateTaskStatus(task.id, TASK_STATUS.SUCCESS);

			await this.saveWebsiteDetails(businessID, websiteDetails, task);

			return websiteDetails;
		} catch (error: any) {
			if (error.status === 404) {
				await this.updateTaskStatus(task.id, TASK_STATUS.SUCCESS, {
					fetchMiddeskWebsiteDetails: `Middesk website data not found for businessID: ${businessID}`
				});
				logger.error(`fetchMiddeskWebsiteDetails: Middesk website data not found for businessID: ${businessID}`);
				throw new VerificationApiError(
					"Middesk website data not found for given business",
					StatusCodes.NOT_FOUND,
					ERROR_CODES.NOT_FOUND
				);
			} else {
				await this.updateTaskStatus(task.id, TASK_STATUS.FAILED, error);
				logger.error(
					`fetchMiddeskWebsiteDetails: Something went wrong while fetching website data from middesk ${businessID}`
				);
				throw error;
			}
		}
	}

	async fallbackFetchMiddeskWebsiteDetails(task: IBusinessIntegrationTaskEnriched, official_website: string) {
		try {
			const businessID = task.business_id;
			// Make a copy of the task object to avoid modifying the reference to the task object
			let middeskTask = { ...task };
			if (task.platform_id !== INTEGRATION_ID.MIDDESK) {
				const middeskTaskRows = await db("integrations.data_business_integrations_tasks")
					.select("integrations.data_business_integrations_tasks.id")
					.where(
						"integrations.data_business_integrations_tasks.business_score_trigger_id",
						task.business_score_trigger_id
					)
					.andWhere(
						"integrations.data_business_integrations_tasks.integration_task_id",
						INTEGRATION_TASK.fetch_middesk_business_entity_website_details
					);

				if (!middeskTaskRows) {
					return;
				}

				const enrichedTask = await TaskManager.getEnrichedTask(middeskTaskRows[0].id);

				middeskTask = enrichedTask;
			}

			if (
				middeskTask.platform_id === INTEGRATION_ID.MIDDESK &&
				middeskTask.task_status !== TASK_STATUS.IN_PROGRESS &&
				middeskTask.task_status !== TASK_STATUS.SUCCESS
			) {
				try {
					await this.fetchMiddeskWebsiteDetails(businessID, middeskTask);
				} catch (err) {
					logger.error("Something went wrong while requesting middesk website data via fallback request");
					logger.error(err);
				}

				const message = {
					official_website,
					business_id: businessID
				};

				await producer.send({
					topic: kafkaTopics.BUSINESS,
					messages: [
						{
							key: businessID,
							value: {
								event: kafkaEvents.ADD_WEBSITE_FALLBACK,
								...message
							}
						}
					]
				});
			}
		} catch (error) {
			logger.error(error);
		}
	}

	async getBusinessWebsiteDetails(params: { businessID: UUID }, body: { case_id?: UUID; score_trigger_id?: UUID }) {
		try {
			const { businessID } = params;
			const { case_id, score_trigger_id } = body;

			// Fetch business details
			const businessDetails = await getBusinessDetails(businessID);

			// Helper function to get tasks based on case_id or score_trigger_id
			const getTask = async (
				integrationID: IntegrationPlatformId,
				taskType: TaskCode,
				fieldPath = "",
				useLatest = true
			) => {
				if (case_id) {
					return await TaskManager.getLatestTaskForBusiness(
						businessID,
						integrationID,
						taskType,
						false,
						fieldPath,
						case_id
					);
				} else if (score_trigger_id) {
					return await TaskManager.getTaskForBusiness(
						businessID,
						integrationID,
						taskType,
						false,
						fieldPath,
						score_trigger_id
					);
				} else {
					let successFlag = fieldPath == "integration_data.request_response.response" ? true : false;
					return await (useLatest
						? TaskManager.getLatestTaskForBusiness(businessID, integrationID, taskType, successFlag, fieldPath)
						: TaskManager.getTaskForBusiness(businessID, integrationID, taskType, false));
				}
			};

			// Fetch SERP tasks
			const serpTask = await getTask(INTEGRATION_ID.SERP_SCRAPE, "fetch_business_entity_website_details", "", false);
			const serpTaskResponse = serpTask?.id
				? await db<IRequestResponse>("integration_data.request_response")
						.select("*")
						.where({ request_id: serpTask.id })
						.first()
				: null;

			// Fetch Middesk tasks
			const middeskVerificationTask = await getTask(INTEGRATION_ID.MIDDESK, "fetch_business_entity_verification");
			let middeskWebsiteTask = await getTask(
				INTEGRATION_ID.MIDDESK,
				"fetch_business_entity_website_details",
				"integration_data.request_response.response"
			);

			const aiWebsiteTask = await getTask(
				INTEGRATION_ID.AI_WEBSITE_ENRICHMENT,
				"perform_business_enrichment",
				"integration_data.request_response.response"
			);
			const aiWebsiteTaskResponse = aiWebsiteTask?.id
				? await db<IRequestResponse>("integration_data.request_response")
						.select("*")
						.where({ request_id: aiWebsiteTask.id })
						.first()
				: null;

			// Lazy import to avoid circular dependency
			const getWebsiteFromFacts = async (): Promise<string | undefined> => {
				try {
					const { allFacts, FactEngineWithDefaultOverrides, FactRules } = require("#lib/facts");
					const websiteFact = allFacts.find((fact: any) => fact.name === "website");
					if (!websiteFact) return undefined;
					const factEngine = new FactEngineWithDefaultOverrides([websiteFact], { business: businessID });
					await factEngine.applyRules(FactRules.factWithHighestConfidence);
					return factEngine.getResolvedFact("website")?.value as string | undefined;
				} catch (error) {
					logger.error(`Error getting website from facts: ${error}`);
					return undefined;
				}
			};
			const websiteFromFacts = await getWebsiteFromFacts();

			// Priority: serp > businessDetails > aiWebsite > facts (includes Trulioo)
			const getFallbackUrl = () =>
				serpTaskResponse?.response?.businessWebsite ||
				(businessDetails?.status === "success" ? businessDetails.data.official_website : undefined) ||
				aiWebsiteTaskResponse?.response?.response?.company_website?.url ||
				websiteFromFacts;

			// Exit early if no verification task exists
			if (!middeskVerificationTask) {
				return {
					data: {
						domain: {},
						pages: [],
						url: getFallbackUrl()
					}
				};
			}

			// If website task is incomplete
			if (middeskWebsiteTask && middeskWebsiteTask.task_status !== TASK_STATUS.SUCCESS) {
				return {
					data: {
						domain: {},
						pages: [],
						url: getFallbackUrl()
					},
					message: "Website data has not been fetched yet"
				};
			}

			// Create a task if not present
			if (!middeskWebsiteTask) {
				await TaskManager.createTask({
					connection_id: middeskVerificationTask.connection_id,
					integration_task_id: INTEGRATION_TASK.fetch_middesk_business_entity_website_details,
					business_score_trigger_id: middeskVerificationTask.business_score_trigger_id,
					task_status: TASK_STATUS.CREATED
				});

				// Re-fetch the website task after creating
				middeskWebsiteTask = await getTask(
					INTEGRATION_ID.MIDDESK,
					"fetch_business_entity_website_details",
					"integration_data.request_response.response"
				);
				if (!middeskWebsiteTask) {
					return {
						data: {
							domain: {},
							pages: [],
							url: getFallbackUrl()
						}
					};
				}
			}

			// Retrieve result from database
			const result = await db<IRequestResponse>("integration_data.request_response")
				.select("*")
				.where({ request_id: middeskWebsiteTask?.id })
				.first();

			if (!result) {
				return {
					data: {
						domain: {},
						pages: [],
						url: getFallbackUrl()
					}
				};
			}

			// Return result
			return { data: result?.response?.website ? result?.response?.website : result?.response };
		} catch (error: any) {
			throw new Error(`Failed to get business website details: ${error.message}`);
		}
	}

	@HydrateFromWarehouse({
		// Attempt hydration on an empty result set only
		isEmptyFn: sqlResult => {
			if (!sqlResult.website_data.length || !sqlResult.website_data.request_id) {
				return true;
			}
			return false;
		},
		// Execute hydration function if the task doesnt exist or If the request_id doesn't exist which means we have not fetched the data yet but inserted the integration entry
		// Additionally if request_id exists but businessIntegrationTask.response that is the data returned from middesk was empty initially maybe due to middesk conenction issue or data was not present at the point of time with the vendor
		// WE can remove the check for  businessIntegrationTask.response if required
		checkFn: businessIntegrationTask =>
			Promise.resolve(
				!businessIntegrationTask ||
					!businessIntegrationTask.request_id ||
					!Object.keys(businessIntegrationTask.response).length
			),
		hydrateFn: async function (this: BusinessEntityVerificationService, _, businessIntegrationTask) {
			if (
				![TASK_STATUS.SUCCESS, TASK_STATUS.IN_PROGRESS, TASK_STATUS.FAILED].includes(
					businessIntegrationTask.task_status
				)
			) {
				try {
					await this.fetchMiddeskWebsiteDetails(businessIntegrationTask.business_id, businessIntegrationTask);
				} catch (err: any) {
					// Dont throw any error during hydration as it is decorating the GET api, simply log and return empty data [] / {}
					if (err.status === 404) {
						logger.error(
							`MiddeskWebsiteHydrator: Middesk website data not found for businessID: ${businessIntegrationTask.business_id} `
						);
					} else {
						logger.error(
							`MiddeskWebsiteHydrator: Error during hydration data for ${businessIntegrationTask.business_id} for task ${businessIntegrationTask.id} : Error : ${err.message}`
						);
					}
				}
			}
		}
	})
	async getWebsiteDetailsFromDB(
		businessIntegrationTask: IBusinessIntegrationTaskEnriched
	): Promise<{ website_data: BusinessEntityWebsiteDetails[] }> {
		try {
			const getBusinessEntityWebsiteDetailsQuery = `SELECT business_entity_website_data.*,
			integration_data.request_response.request_id
			FROM integration_data.business_entity_website_data
			LEFT JOIN integration_data.request_response ON integration_data.request_response.request_id = integration_data.business_entity_website_data.business_integration_task_id
			WHERE business_integration_task_id = $1`;

			const result = await sqlQuery({
				sql: getBusinessEntityWebsiteDetailsQuery,
				values: [businessIntegrationTask.id]
			});

			return { website_data: result.rows };
		} catch (error) {
			throw error;
		}
	}

	async formatBusinessWebsiteResult(result: BusinessEntityWebsiteDetails[]) {
		try {
			const response = {
				pages: [] as PAGES[]
			} as BusinessWebsiteDetailsResponse;

			if (!result.length) {
				return response;
			}

			for (const row of result) {
				response.creation_date = new Date(row.creation_date);
				response.expiration_date = new Date(row.expiration_date);
				response.pages.push({
					category: row.category,
					url: row.category_url,
					text: row.category_text,
					screenshot_url: row.category_image_link
				});
			}

			return response;
		} catch (error) {
			throw error;
		}
	}

	async insertBusinessEntityWebsiteDetails(
		businessID: UUID,
		websiteResponse: BusinessEntityWebsiteResponse,
		task: IBusinessIntegrationTaskEnriched
	): Promise<void> {
		try {
			logger.info(`Website scan task: ${businessID} ${JSON.stringify(task)}`);
			if (!task) {
				throw new VerificationApiError(
					`Task not found for given business: ${businessID}`,
					StatusCodes.BAD_REQUEST,
					ERROR_CODES.INVALID
				);
			}

			const { url } = websiteResponse;
			if (!url) {
				logger.error(`insertBusinessEntityWebsiteDetails: No website URL found for businessID: ${businessID}`);
				throw new VerificationApiError(
					`No website URL found for businessID: ${businessID}`,
					StatusCodes.BAD_REQUEST,
					ERROR_CODES.INVALID
				);
			}
			const creation_date = websiteResponse.domain?.creation_date;
			const expiration_date = websiteResponse.domain?.expiration_date;

			const columns = [
				"business_integration_task_id",
				"business_id",
				"url",
				"creation_date",
				"expiration_date",
				"category",
				"category_url",
				"category_text",
				"category_image_link",
				"meta"
			];

			const rows = websiteResponse.pages?.map(page => {
				// Make sure the text is not greater than 512 characters
				let pageText = page?.text || "...";
				if (pageText.length > 512) pageText = pageText.substring(0, 509) + "...";
				return [
					task.id,
					businessID,
					url,
					creation_date,
					expiration_date,
					page.category,
					page.url,
					pageText,
					page?.screenshot_url || "",
					websiteResponse
				];
			});

			if (rows && rows.length > 0) {
				let query = buildInsertQuery("integration_data.business_entity_website_data", columns, rows);

				query += ` ON CONFLICT (business_integration_task_id, category, category_url) DO UPDATE
				SET url = EXCLUDED.url,
				creation_date = EXCLUDED.creation_date,
				expiration_date = EXCLUDED.expiration_date,
				category_text = EXCLUDED.category_text,
				category_image_link = EXCLUDED.category_image_link,
				meta = EXCLUDED.meta `;

				await sqlQuery({ sql: query, values: rows.flat() });
				logger.info(`Website details inserted for businessID: ${businessID}`);
			}
		} catch (error: any) {
			logger.error(`Website insertion failed: ${businessID} ${error.message}`);
			throw error;
		}
	}

	async saveWebsiteDetails(
		businessID: UUID,
		websiteDetails: BusinessEntityWebsiteResponse,
		task: IBusinessIntegrationTaskEnriched,
		s3FileName: string = "middesk_website_data",
		platformName: string = "MIDDESK",
		platformId: IntegrationPlatformId = INTEGRATION_ID.MIDDESK
	): Promise<void> {
		if (!websiteDetails) return;

		await TaskManager.saveRawResponseToDB(
			websiteDetails,
			businessID,
			task,
			platformId,
			"fetch_business_entity_website_details"
		);

		await this.insertBusinessEntityWebsiteDetails(businessID, websiteDetails, task);

		await uploadRawIntegrationDataToS3(
			websiteDetails,
			businessID,
			s3FileName,
			DIRECTORIES.BUSINESS_ENTITY_VERIFICATION,
			platformName
		);
	}

	async getVerificationPeople(params: { businessID: UUID }) {
		try {
			const getPeople = await db("integration_data.business_entity_people")
				.select("integration_data.business_entity_people.*")
				.innerJoin(
					"integration_data.business_entity_verification",
					"integration_data.business_entity_verification.id",
					"integration_data.business_entity_people.business_entity_verification_id"
				)
				.where("integration_data.business_entity_verification.business_id", params.businessID);

			const requiredTitles = [
				"CHIEF EXECUTIVE OFFICER",
				"CEO",
				"CFO",
				"CHIEF FINANCIAL OFFICER",
				"PRESIDENT",
				"VICE PRESIDENT",
				"SENIOR VICE PRESIDENT",
				"PARTNER",
				"REGISTERED AGENT"
			];

			const selectedPeople: PeopleResponse[] = [];
			const otherPeople: PeopleResponse[] = [];

			const titleMapping = {
				CEO: "CHIEF EXECUTIVE OFFICER",
				CFO: "CHIEF FINANCIAL OFFICER",
				SVP: "SENIOR VICE PRESIDENT",
				GC: "GENERAL COUNSEL",
				"ASSISTANT SEC": "ASSISTANT SECRETARY",
				"ASSISTANT TREAS": "ASSISTANT TREASURER"
			};

			for (const person of getPeople) {
				let isNeededPerson = false;

				// sanitizing titles
				for (let i = 0; i < person.titles.length; i++) {
					const title = person.titles[i].toUpperCase();
					if (titleMapping[title]) {
						person.titles[i] = titleMapping[title];
					}

					if (requiredTitles.includes(person.titles[i])) {
						isNeededPerson = true;
					}
				}

				const payload = {
					id: person.id,
					name: person.name as string,
					titles: Array.from(new Set(person.titles)) as string[]
				};

				if (isNeededPerson) {
					selectedPeople.push(payload);
				} else {
					otherPeople.push(payload);
				}
			}

			return { records: selectedPeople.length ? selectedPeople : otherPeople };
		} catch (error) {
			throw error;
		}
	}

	/**
	 * Normalizes Trulioo PSC watchlist hit (screeningResults.watchlistHits / watchlistResults) to WatchlistPersonResult shape
	 * so the Watchlist tab can display PSC results when metadata.sources was not updated by the webhook.
	 * Contract for frontend: metadata.title is the list name (e.g. "Advanced Watchlist"), not the person's role (e.g. "Director").
	 * Use watchlist_results.length for hit count per person; do not filter by hit.metadata.title === role.
	 *
	 */
	private static normalizeTruliooHitToWatchlistResult(
		hit: Record<string, unknown>,
		personName: string,
		index: number
	): WatchlistPersonResult {
		// Convert Record<string, unknown> to TruliooWatchlistHit format
		const truliooHit: TruliooWatchlistHit = {
			listType:
				(hit.listType as TruliooWatchlistHit["listType"]) || (hit.type as TruliooWatchlistHit["listType"]) || "OTHER",
			listName: (hit.listName as string) || (hit.listType as string) || "",
			confidence: typeof hit.confidence === "number" ? hit.confidence : 0,
			matchDetails: (hit.matchDetails as string) || "",
			url: (hit.url as string) || undefined,
			sourceAgencyName: (hit.sourceAgencyName as string) || undefined,
			sourceRegion: (hit.sourceRegion as string) || (hit.list_region as string) || undefined,
			sourceListType: (hit.sourceListType as string) || undefined,
			listCountry: (hit.listCountry as string) || undefined
		};

		// Reuse existing transformation function to avoid duplicating business logic
		const metadata = transformTruliooHitToWatchlistMetadata(truliooHit, personName);

		// Convert WatchlistValueMetadatum to WatchlistPersonResult
		return {
			id: metadata.id || `trulioo-${index}-${Date.now()}`,
			url: metadata.url || null,
			type: "watchlist_result",
			list_country: metadata.list_country || "",
			metadata: {
				abbr: metadata.metadata.abbr,
				title: metadata.metadata.title,
				agency: metadata.metadata.agency,
				agency_abbr: metadata.metadata.agency_abbr,
				entity_name: personName
			},
			score: truliooHit.confidence,
			object: "watchlist_result",
			list_url: metadata.list_url || null,
			addresses: Array.isArray(hit.addresses) ? (hit.addresses as Array<{ full_address: string }>) : [],
			listed_at: (hit.listed_at as string) || null,
			categories: Array.isArray(hit.categories) ? (hit.categories as string[]) : [],
			entity_name: personName,
			list_region: metadata.list_region || "",
			entity_aliases: Array.isArray(hit.entity_aliases) ? (hit.entity_aliases as string[]) : [],
			agency_list_url: metadata.agency_list_url || null,
			agency_information_url: metadata.agency_information_url || null
		};
	}

	async getPeopleWatchlistDetails(params: { businessID: UUID }) {
		try {
			const people = await db("integration_data.business_entity_people")
				.select("integration_data.business_entity_people.*")
				.innerJoin(
					"integration_data.business_entity_verification",
					"integration_data.business_entity_verification.id",
					"integration_data.business_entity_people.business_entity_verification_id"
				)
				.where("integration_data.business_entity_verification.business_id", params.businessID);

			const formattedPeople = people.reduce((acc: PeopleResponse[], person) => {
				const metadata = typeof person.metadata === "string" ? JSON.parse(person.metadata) : person.metadata || {};

				// Prefer metadata.sources (Middesk / webhook-updated PSC)
				let watchlist_results: WatchlistPersonResult[] =
					(metadata.sources as any[])?.filter((source: any) => source.type === "watchlist_result") || [];

				// Fallback: Trulioo PSC stores hits in screeningResults.watchlistHits or watchlistResults when webhook didn't update sources
				if (watchlist_results.length === 0) {
					const hits = (metadata.screeningResults as any)?.watchlistHits ?? metadata.watchlistResults;
					if (Array.isArray(hits) && hits.length > 0) {
						const nonAdverseMediaHits = hits.filter((hit: Record<string, unknown>) => {
							const listType = ((hit.listType as string) || "").toLowerCase();
							return listType !== WATCHLIST_HIT_TYPE.ADVERSE_MEDIA;
						});
						watchlist_results = nonAdverseMediaHits.map((hit: Record<string, unknown>, i: number) =>
							BusinessEntityVerificationService.normalizeTruliooHitToWatchlistResult(hit, person.name, i)
						);
					}
				}

				// Normalize existing sources that may have Trulioo shape (type watchlist_result but missing WatchlistPersonResult fields).
				// Only pass through src when metadata has all required string fields (frontend expects metadata.title etc. to be defined).
				if (watchlist_results.length > 0) {
					watchlist_results = watchlist_results.map((src: any, i: number) => {
						const hasFullMetadata =
							src?.metadata &&
							typeof src.metadata.title === "string" &&
							typeof src.metadata.agency === "string" &&
							typeof src.metadata.entity_name === "string";
						if (hasFullMetadata) {
							return src as WatchlistPersonResult;
						}
						return BusinessEntityVerificationService.normalizeTruliooHitToWatchlistResult(src ?? {}, person.name, i);
					});
				}
				// Include every person (e.g. officers from KYB) so the Watchlists tab can show them even when PSC has no hits yet
				const personResponse: PeopleResponse = {
					id: person.id,
					name: person.name,
					titles: person.titles || [],
					watchlist_results
				};
				acc.push(personResponse);
				return acc;
			}, []);

			// Deduplicate by normalized name (trim + case-insensitive) and merge watchlist_results.
			// Same person can have multiple rows: e.g. KYB verification + PSC verification, or one without watchlist and one updated by webhook.
			const normalizedKey = (name: string) =>
				String(name ?? "")
					.trim()
					.toLowerCase();
			const byName = new Map<string, PeopleResponse>();
			for (const record of formattedPeople) {
				const key = normalizedKey(record.name);
				const existing = byName.get(key);
				if (!existing) {
					byName.set(key, { ...record });
				} else {
					const merged = [...(existing.watchlist_results || []), ...(record.watchlist_results || [])];
					// Prefer display name from the record that has hits (so UI shows consistent casing)
					const nameToUse = (record.watchlist_results?.length ?? 0) > 0 ? record.name : existing.name;
					byName.set(key, {
						...existing,
						name: nameToUse,
						watchlist_results: merged
					});
				}
			}

			const finalRecords = Array.from(byName.values());
			// Ensure every watchlist_result has metadata with at least title/agency/entity_name (string) so frontend never reads undefined
			const sanitized = finalRecords.map(rec => ({
				...rec,
				watchlist_results: (rec.watchlist_results ?? []).map((hit: WatchlistPersonResult) => {
					const meta = hit?.metadata;
					if (!meta || typeof meta.title === "undefined" || typeof meta.agency === "undefined") {
						return {
							...hit,
							metadata: {
								abbr: meta?.abbr ?? "",
								title: typeof meta?.title === "string" ? meta.title : "",
								agency: typeof meta?.agency === "string" ? meta.agency : "",
								agency_abbr: meta?.agency_abbr ?? "",
								entity_name: typeof meta?.entity_name === "string" ? meta.entity_name : rec.name
							}
						} as WatchlistPersonResult;
					}
					return hit;
				})
			}));
			return { records: sanitized };
		} catch (error) {
			logger.error(
				`getVerificationPeopleDetails: Error while fetching people details for businessID: ${params.businessID}`
			);
			throw error;
		}
	}

	public matchBusiness = async (): Promise<IBusinessIntegrationTaskEnriched> => {
		const taskId = await this.getOrCreateTaskForCode({
			taskCode: "fetch_business_entity_verification",
			reference_id: this.dbConnection?.business_id
		});
		if (taskId) {
			await this.processTask({ taskId });
		}
		const task = await BusinessEntityVerificationService.getEnrichedTask(taskId);
		return task;
	};

	public static isFirmographicsBelowPredictionThreshold(firmographicEvent: FirmographicsEvent): boolean {
		return firmographicEvent.prediction < this.MINIMUM_PREDICTION_SCORE;
	}

	protected async getBusinessNamesAndAddresses(businessId) {
		return internalGetBusinessNamesAndAddresses(businessId);
	}

	protected async executeMatchSearchQuery<T>(query: string): Promise<T[]> {
		return executeAndUnwrapRedshiftQuery<T>(query);
	}

	protected generateAddressString(address: BusinessAddress): string {
		const { line_1, city, state, postal_code, apartment, country } = address;
		return `${line_1}${apartment ? `, ${apartment}` : ""}, ${city}, ${state} ${postal_code}${country ? `, ${country}` : ""}`.toLocaleUpperCase();
	}

	protected async saveRequestResponse<T>(
		task: IBusinessIntegrationTaskEnriched,
		input: T,
		externalId: string,
		mergeOptions: any = null
	): Promise<IRequestResponse> {
		const insertedRecord = await db<IRequestResponse>("integration_data.request_response")
			.insert({
				request_id: task.id,
				business_id: task.business_id,
				platform_id: task.platform_id,
				external_id: externalId,
				request_type: task.task_code,
				request_code: task.task_code,
				connection_id: task.connection_id,
				response: JSON.stringify(input)
			})
			.onConflict("request_id")
			.merge(mergeOptions)
			.returning("*");
		return insertedRecord[0];
	}

	protected async saveToS3<T>(data: T, s3FileName: string, directory: string, platformName: string): Promise<void> {
		try {
			const businessId = this.dbConnection?.business_id;
			if (!businessId) {
				throw new Error("Business ID is required to save to S3");
			}
			await uploadRawIntegrationDataToS3(data, businessId, s3FileName, directory, platformName);
		} catch (ex) {
			logger.error({ error: ex, s3FileName, directory, platformName }, "Failed to upload entry to S3");
		}
	}

	protected sanitizeBusinessName(name: string): string | undefined {
		return sanitizeBusinessName(name);
	}

	protected async getUniqueNamesAndAddresses(businessId: UUID | string): Promise<{
		names: string[];
		addresses: string[];
		zip3: string[];
		name1: string[];
		name2: string[];
		country: string[];
		originalAddresses: BusinessAddress[];
	}> {
		const [namesAndAddresses, middeskNames] = await Promise.all([
			this.getBusinessNamesAndAddresses(businessId),
			this.getEntityVerification(INTEGRATION_ID.MIDDESK)
				.then(bev => (bev ? this.getEntityNames(bev) : []))
				.then(names => names.map(name => name.name))
				.catch(() => [])
		]);
		// Build unique names and addresses by storing in Sets
		const namesSet = namesAndAddresses.names.reduce((acc, nameRecord) => {
			acc.add(this.sanitizeBusinessName(nameRecord?.name));
			return acc;
		}, new Set<string | undefined>());
		middeskNames.forEach(name => namesSet.add(this.sanitizeBusinessName(name)));
		let zip3Set = new Set<string>();
		let countrySet = new Set<string>();
		const addressesSet = namesAndAddresses.addresses.reduce((acc, addressRecord) => {
			const { postal_code, country } = addressRecord;
			const address = this.generateAddressString(addressRecord);
			if (postal_code) {
				zip3Set.add(postal_code.padStart(3, "0").substring(0, 3));
			}
			if (country) {
				countrySet.add(country);
			}
			acc.add(address);
			return acc;
		}, new Set<string>());
		// Each unique 3 character zipcode prefix
		const zip3 = Array.from(zip3Set);
		// Each country
		const country = Array.from(countrySet);
		// Each unique normalized name & address
		const addresses = Array.from(addressesSet).filter(a => a);

		const names: string[] = Array.from(namesSet).filter(n => n !== undefined);
		// The first letter of each name
		const name1: string[] = names?.map(name => name?.substring(0, 1).toLocaleUpperCase());
		const name2: string[] = names?.map(name => name?.substring(0, 2).toLocaleUpperCase());

		return { names, addresses, zip3, name1, name2, country, originalAddresses: namesAndAddresses.addresses };
	}
	protected async getEntityVerification(platformId: number = INTEGRATION_ID.MIDDESK, businessId?: UUID) {
		businessId = businessId || this.dbConnection?.business_id;
		if (!businessId) {
			throw new Error("Business ID is required to get entity verification");
		}
		return db<IBusinessEntityVerification>({ bev: "integration_data.business_entity_verification" })
			.select("bev.*")
			.where({ business_id: businessId })
			.join("integrations.data_business_integrations_tasks as task", "task.business_id", "bev.business_id")
			.join("integrations.data_connections as connection", "connection.id", "task.connection_id")
			.where("connection.platform_id", platformId)
			.orderBy("bev.created_at", "asc")
			.limit(1)
			.first();
	}

	static async _getBusinessAge(
		businessID: string
	): Promise<{ business_age: number | null; formation_date: Date | null }> {
		try {
			let businessAge: number | null = null;
			const businessEntityVerification = await db<IBusinessEntityVerification>(
				"integration_data.business_entity_verification"
			)
				.select("*")
				.where({ business_id: businessID })
				.first();
			if (businessEntityVerification?.formation_date) {
				const formationDate = new Date(businessEntityVerification.formation_date);
				const currentDate = new Date();
				businessAge = currentDate.getFullYear() - formationDate.getFullYear();
				const isBeforeAnniversary =
					currentDate.getMonth() < formationDate.getMonth() ||
					(currentDate.getMonth() === formationDate.getMonth() && currentDate.getDate() < formationDate.getDate());
				if (isBeforeAnniversary) {
					businessAge--;
				}
				return { business_age: businessAge, formation_date: formationDate };
			} else {
				const middeskUpdateDataFromS3: BulkUpdateMiddeskData = await getRawIntegrationDataFromS3(
					businessID,
					"BulkUpdateBusinessMap",
					DIRECTORIES.MANUAL,
					"MANUAL",
					false
				);
				if (middeskUpdateDataFromS3?.data?.year) {
					const businessYear = parseInt(middeskUpdateDataFromS3.data.year, 10);
					const currentYear = new Date().getFullYear();
					businessAge = currentYear - businessYear;
					return { business_age: businessAge, formation_date: new Date(`${middeskUpdateDataFromS3.data.year}-01-01`) };
				}
			}

			return { business_age: null, formation_date: null };
		} catch (error) {
			throw error;
		}
	}

	public static async enqueueMatchRequest(requestId: UUID, request: Record<string, any>) {
		const queueName = this.BULK_NAMED_QUEUE ?? QUEUES.TASK;
		const queue = new BullQueue(queueName);
		const jobId = `${requestId}::${request?.providedKey || randomUUID()}`;
		return queue.addJob(
			this.BULK_NAMED_JOB,
			{ requestId, request },
			{ jobId, removeOnComplete: false, removeOnFail: false }
		);
	}

	public static async matchBusinessFromJobData(jobData: Job["data"]) {
		if (jobData?.request?.business_id) {
			return this.matchBusiness(jobData.request.business_id);
		}
		throw new VerificationApiError("business_id not found in request");
	}
	public static async matchBusiness(businessID: UUID): Promise<IBusinessIntegrationTaskEnriched> {
		try {
			const connection = await this.getOrCreateConnection(businessID);
			const platform: BusinessEntityVerificationService = platformFactory({ dbConnection: connection });
			const taskId = await platform.getOrCreateTaskForCode({
				taskCode: "fetch_business_entity_verification",
				reference_id: businessID
			});
			await platform.processTask({ taskId });
			return this.getEnrichedTask(taskId);
		} catch (ex) {
			logger.error(ex);
			throw new VerificationApiError("Failed to match business");
		}
	}

	public processFirmographicsEvent(task: IBusinessIntegrationTaskEnriched, payload: any): Promise<void> {
		throw new VerificationApiError("processFirmographicsEvent is not implemented");
	}

	/*
	 * @description Given a business entity verification response, determine if it's mocked
	 * @returns true if the response is mocked, false otherwise
	 */
	public static isMockedResponse({
		reviewTasks,
		registrations,
		addressSources
	}: {
		reviewTasks: IBusinessEntityReviewTask[];
		registrations: IBusinessEntityRegistration[];
		addressSources: IBusinessEntityAddressSource[];
	}): boolean {
		// We'll definitely know that the response is mocked if the reviewTask has is_mock: true, but this won't be set ALL the time
		const isMocked =
			Array.isArray(reviewTasks) &&
			reviewTasks.length > 0 &&
			reviewTasks.some(task => task.metadata?.[0]?.metadata?.is_mock === true);
		if (isMocked) {
			return true;
		}

		/* Legacy check for mocked response is to check all the various address fields for the business entity verification and see if they're different
		 */

		const registrationAddresses: string[] = registrations.flatMap(({ full_addresses }) =>
			full_addresses.map(address => address.toLowerCase())
		);
		if (registrationAddresses.length !== 2) {
			return false;
		}
		const addressVerificationAddress = reviewTasks
			.filter(
				task =>
					task.key === "address_verification" &&
					task.metadata?.[0]?.metadata &&
					task.metadata[0].metadata.submitted == true &&
					task.metadata[0].metadata.address_line2 === null
			)
			.map(task => task.metadata[0].metadata.address_line1?.toLowerCase());

		if (addressVerificationAddress.length !== 1) {
			return false;
		}

		const addressSourceAddress = addressSources
			.filter(
				({ lat, long, address_line_1, full_address, submitted, deliverable }) =>
					submitted &&
					deliverable &&
					lat &&
					long &&
					address_line_1 &&
					full_address &&
					!full_address.startsWith(address_line_1)
			)
			.map(source => source.address_line_1?.toLowerCase());

		if (addressSourceAddress.length !== 1) {
			return false;
		}

		// Combining all the addresses we collected, they should all be unique
		const allAddresses = [...registrationAddresses, ...addressVerificationAddress, ...addressSourceAddress];
		if (new Set(allAddresses).size === allAddresses.length) {
			return true;
		}
		return false;
	}

	public async processEntityMatching(task: IBusinessIntegrationTask<EntityMatchTask>): Promise<boolean> {
		logger.debug(
			`BusinessEntityVerificationService: Processing entity matching for businessId: ${this.dbConnection?.business_id}`
		);
		throw new VerificationApiError("Entity Matching is not implemented");
	}

	protected async setMatchMode(taskId: UUID, matchMode: EntityMatchTask["match_mode"]): Promise<void> {
		const update = {
			metadata: db.raw(`COALESCE(??::jsonb, '{}'::jsonb) || ?::jsonb`, [
				"metadata",
				JSON.stringify({ match_mode: matchMode })
			])
		};
		await this.updateTask(taskId, update);
	}

	/**
	 * @description Get the match mode for a task
	 * @param taskOrTaskId - The task or task ID
	 * @returns The match mode or null if the match mode is not set
	 */
	public async getMatchMode(
		taskOrTaskId: IBusinessIntegrationTask<EntityMatchTask> | UUID
	): Promise<EntityMatchTask["match_mode"] | null> {
		if (typeof taskOrTaskId === "string") {
			taskOrTaskId = await BusinessEntityVerificationService.getEnrichedTask(taskOrTaskId);
		}
		if (typeof taskOrTaskId !== "object" || !taskOrTaskId?.id) {
			throw new VerificationApiError("Task not found");
		}
		return taskOrTaskId?.metadata?.match_mode || null;
	}

	/**
	 * @description Check if the prediction score is below the minimum threshold defined for the platform
	 * @param task - The task
	 * @returns true if the prediction score is below the minimum threshold, false otherwise
	 */
	protected isBelowMinimumPredictionScore(task: IBusinessIntegrationTask<EntityMatchTask>): boolean {
		const staticRef = this.constructor as typeof BusinessEntityVerificationService;
		const predictionThresdhold = staticRef.MINIMUM_PREDICTION_SCORE;
		if (!task.metadata?.prediction) {
			return true;
		}
		return task.metadata.prediction < predictionThresdhold;
	}

	public tinSanity(middeskBusinessDetails) {
		return middeskBusinessDetails.tin?.tin && middeskBusinessDetails.tin.tin !== null
			? encryptData(middeskBusinessDetails.tin.tin.replace("-", ""))
			: null; // Return null if TIN is null
	}

	/**
	 * @description Convert the AI generated "prediction" to the legacy "confidence index" which is a number between 0 and 55
		Prediction is a number between 0 and 1, so we multiply by 55 to get a number between 0 and 55
	*/
	public convertPredictionToIndex(prediction: number): number {
		return Math.round(prediction * 55);
	}

	private getReviewTasks(businessEntityVerificationId: UUID): Promise<IBusinessEntityReviewTask[]> {
		return db<IBusinessEntityReviewTask>("integration_data.business_entity_review_task")
			.select("*")
			.where({ business_entity_verification_id: businessEntityVerificationId });
	}
	private getAddressSources(businessEntityVerificationId: UUID): Promise<IBusinessEntityAddressSource[]> {
		return db<IBusinessEntityAddressSource>("integration_data.business_entity_address_source")
			.select("*")
			.where({ business_entity_verification_id: businessEntityVerificationId });
	}
	private getRegistrations(businessEntityVerificationId: UUID): Promise<IBusinessEntityRegistration[]> {
		return db<IBusinessEntityRegistration>("integration_data.business_entity_registration")
			.select("*")
			.where({ business_entity_verification_id: businessEntityVerificationId });
	}
}

export const getBusinessEntityVerificationService = async (businessID: UUID) => {
	const businessEntityVerification = new BusinessEntityVerificationService();
	await businessEntityVerification.createConnection({ business_id: businessID, options: {} });
	return businessEntityVerification;
};

export const getBusienssEntityVerificationByUniqueExternalId = async (
	uniqueExternalId: UUID | string
): Promise<IBusinessEntityVerification | undefined> => {
	return await db<IBusinessEntityVerification>("integration_data.business_entity_verification")
		.select("*")
		.where({ unique_external_id: uniqueExternalId })
		.first();
};

export const getBusienssEntityVerificationByBusinessId = async (
	businessId: UUID | string
): Promise<IBusinessEntityVerification | undefined> => {
	return await db<IBusinessEntityVerification>("integration_data.business_entity_verification")
		.select("*")
		.where({ business_id: businessId })
		.first();
};
