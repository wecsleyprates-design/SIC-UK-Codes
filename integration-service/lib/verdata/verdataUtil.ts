import { updateTask, uploadRawIntegrationDataToS3, prepareIntegrationDataForScore } from "#common/index";
import { DIRECTORIES, EVENTS, INTEGRATION_ID, QUEUES, TASK_STATUS, kafkaEvents, kafkaTopics } from "#constants";
import BullQueue from "#helpers/bull-queue";
import businessLookupHelper from "#helpers/businessLookupHelper";
import { db, logger, producer } from "#helpers";
import type { IBusinessIntegrationTask, IRequestResponse } from "#types/db";
import type { Job } from "bull";
import { randomUUID, type UUID } from "crypto";
import type * as Verdata from "./types";
import { Verdata as VerdataClass } from "./verdata";
import { SellerNotFoundJobBody, SellerSearchJobBody } from "#workers/types";
import { envConfig } from "#configs";
import { getConnectionById, getConnectionForBusinessAndPlatform, platformFactory } from "#helpers/platformHelper";
import dayjs from "dayjs";

export class VerdataUtil {
	static readonly QUEUE_MAX_RETENTION = 10;
	static readonly QUEUE_MAX_FAILED_RETENTION = 100;
	// The keys in the "features" object that we map to columns in the public records table
	static readonly FEATURE_KEYS: (keyof Verdata.FeatureStore)[] = [
		"rev_0182",
		"rev_0014",
		"rev_0021",
		"rev_0035",
		"rev_0042",
		"rev_0049",
		"rev_0056",
		"rev_0063",
		"rev_0070",
		"rev_0077",
		"rev_0091",
		"rev_0098",
		"rev_0105",
		"rev_0112",
		"rev_0119",
		"rev_0176",
		"rev_0126",
		"archive"
	];

	public static mapVerdataToPublicRecord = (
		data: Verdata.Record,
		taskId?: UUID
	): Omit<Verdata.PublicRecord, "created_at" | "id" | "business_integration_task_id"> & {
		business_integration_task_id?: UUID;
	} => {
		const featureStore: Verdata.FeatureStore =
			data.feature_store?.reduce((result, element) => {
				this.FEATURE_KEYS.forEach(key => {
					if (Object.hasOwn(element, key)) {
						result[key] = element[key];
					}
				});
				return result;
			}, {} as Verdata.FeatureStore) || {};

		const monthly_rating_date =
			featureStore?.archive === "No Rating Date" || featureStore?.archive === undefined
				? undefined
				: new Date(featureStore.archive);

		const businessData: Partial<Verdata.PublicRecord> = {};
		if (
			Array.isArray(data.ThirdPartyData) &&
			data.ThirdPartyData.length > 0 &&
			(data.ThirdPartyData?.[0] as Verdata.ThirdPartyData)
		) {
			businessData.number_of_business_liens = noneFoundToZero(data.ThirdPartyData?.[0].BUS_LIENS_SUMMARY_001);
			businessData.most_recent_business_lien_filing_date = VerdataUtil.convertMDYToDate(
				data.ThirdPartyData?.[0].BUS_LIENS_SUMMARY_002
			);
			businessData.most_recent_business_lien_status = data.ThirdPartyData?.[0].BUS_LIENS_SUMMARY_003;

			businessData.number_of_bankruptcies = noneFoundToZero(data.ThirdPartyData?.[0].BUS_BANKRUPTCY_SUMMARY_001);
			businessData.most_recent_bankruptcy_filing_date = VerdataUtil.convertMDYToDate(
				data.ThirdPartyData?.[0].BUS_BANKRUPTCY_SUMMARY_002
			);

			businessData.number_of_judgement_fillings = noneFoundToZero(data.ThirdPartyData?.[0].BUS_JUDGEMENT_SUMMARY_001);
			businessData.most_recent_judgement_filling_date = VerdataUtil.convertMDYToDate(
				data.ThirdPartyData?.[0].BUS_JUDGEMENT_SUMMARY_002
			);

			businessData.corporate_filing_business_name = data.ThirdPartyData?.[0].CORP_FILING_001;
			businessData.corporate_filing_filling_date = VerdataUtil.convertMDYToDate(
				data.ThirdPartyData?.[0].CORP_FILING_002
			);
			businessData.corporate_filing_incorporation_state = data.ThirdPartyData?.[0].CORP_FILING_003;
			businessData.corporate_filing_corporation_type = data.ThirdPartyData?.[0].CORP_FILING_004;
			businessData.corporate_filing_resgistration_type = data.ThirdPartyData?.[0].CORP_FILING_005;
			businessData.corporate_filing_secretary_of_state_status = data.ThirdPartyData?.[0].CORP_FILING_006;
			businessData.corporate_filing_secretary_of_state_status_date = VerdataUtil.convertMDYToDate(
				data.ThirdPartyData?.[0].CORP_FILING_007
			);
		} else if (Array.isArray(data.blj) && data.blj.length > 0 && (data.blj?.[0] as Verdata.BLJ)) {
			businessData.number_of_business_liens = noneFoundToZero(data.blj[0].liens.length);
			businessData.most_recent_business_lien_filing_date = getValueFromLatestRecord(data.blj[0].liens, "filing_date");
			businessData.most_recent_business_lien_status = getValueFromLatestRecord(
				data.blj[0].liens,
				"filing_date",
				"status"
			);

			businessData.number_of_bankruptcies = noneFoundToZero(data.blj[0].bankruptcies.length);
			businessData.most_recent_bankruptcy_filing_date = getValueFromLatestRecord(
				data.blj[0].bankruptcies,
				"filing_date"
			);

			businessData.number_of_judgement_fillings = noneFoundToZero(data.blj[0].judgements.length);
			businessData.most_recent_judgement_filling_date = getValueFromLatestRecord(data.blj[0].judgements, "filing_date");

			businessData.corporate_filing_business_name = data.blj[0].corp_filing?.[0]?.name;
			businessData.corporate_filing_filling_date = data.blj[0].corp_filing?.[0]?.filing_date;
			businessData.corporate_filing_incorporation_state = data.blj[0].corp_filing?.[0]?.incorporation_state;
			businessData.corporate_filing_corporation_type = data.blj[0].corp_filing?.[0]?.corp_type;
			businessData.corporate_filing_resgistration_type = data.blj[0].corp_filing?.[0]?.entity_type;
			businessData.corporate_filing_secretary_of_state_status = data.blj[0].corp_filing?.[0]?.status;
			businessData.corporate_filing_secretary_of_state_status_date = data.blj[0].corp_filing?.[0]?.status_date;
		}

		const official_website = data.public_sources?.find(source => !!source.domain_name)?.domain_name;

		return {
			...(taskId && { business_integration_task_id: taskId }),
			number_of_business_liens: noneFoundToZero(businessData.number_of_business_liens),
			most_recent_business_lien_filing_date: businessData.most_recent_business_lien_filing_date || null,
			most_recent_business_lien_status: businessData.most_recent_business_lien_status || "",

			number_of_bankruptcies: noneFoundToZero(businessData.number_of_bankruptcies),
			most_recent_bankruptcy_filing_date: businessData.most_recent_bankruptcy_filing_date || null,

			number_of_judgement_fillings: noneFoundToZero(businessData.number_of_judgement_fillings),
			most_recent_judgement_filling_date: businessData.most_recent_judgement_filling_date || null,

			corporate_filing_business_name: businessData.corporate_filing_business_name || "",
			corporate_filing_filling_date: businessData.corporate_filing_filling_date || null,
			corporate_filing_incorporation_state: businessData.corporate_filing_incorporation_state || "",
			corporate_filing_corporation_type: businessData.corporate_filing_corporation_type || "",
			corporate_filing_resgistration_type: businessData.corporate_filing_resgistration_type || "",
			corporate_filing_secretary_of_state_status: businessData.corporate_filing_secretary_of_state_status || "",
			corporate_filing_secretary_of_state_status_date:
				businessData.corporate_filing_secretary_of_state_status_date || null,

			average_rating: featureStore.rev_0182,
			angi_review_count: featureStore.rev_0014,
			bbb_review_count: featureStore.rev_0021,
			google_review_count: featureStore.rev_0035,
			yelp_review_count: featureStore.rev_0042,
			healthgrades_review_count: featureStore.rev_0049,
			vitals_review_count: featureStore.rev_0056,
			webmd_review_count: featureStore.rev_0063,
			angi_review_percentage: featureStore.rev_0070 || 0,
			bbb_review_percentage: featureStore.rev_0077 || 0,
			google_review_percentage: featureStore.rev_0091 || 0,
			yelp_review_percentage: featureStore.rev_0098 || 0,
			healthgrades_review_percentage: featureStore.rev_0105 || 0,
			vitals_review_percentage: featureStore.rev_0112 || 0,
			webmd_review_percentage: featureStore.rev_0119 || 0,
			monthly_rating: featureStore.rev_0176,
			monthly_rating_date,
			official_website,
			updated_at: new Date()
		};
	};
	/**
	 * Insert or update public_records row with the data provided by Verdata
	 * @param taskId
	 * @param data
	 * @returns updated record
	 */
	// TODO: Refactor existing code to use this method so we can keep the logic in one place
	public static upsertRecord = async (taskId: UUID, data: Verdata.Record): Promise<Verdata.PublicRecord> => {
		// Keys in the feature store that we map to columns in the public records table
		// Create a flattened object of matched keys
		const mappedData = VerdataUtil.mapVerdataToPublicRecord(data, taskId);
		// Does row for task exist in db? There isn't a unique constraint on this table besides `id` so we need to check then update or insert first (may want to consider adding a unique constraint on task id)
		const currentRecord = await db<Verdata.PublicRecord>("integration_data.public_records")
			.where("business_integration_task_id", taskId)
			.first();
		let upsertedRecords: Verdata.PublicRecord[];
		if (currentRecord) {
			logger.warn(
				{ currentRecord, mappedData, taskId },
				`VerdataUtil: Upserting record for task ${taskId} with existing record`
			);
			upsertedRecords = await db<Verdata.PublicRecord>("integration_data.public_records")
				.where("business_integration_task_id", taskId)
				.update(mappedData)
				.returning("*");
		} else {
			upsertedRecords = await db<Verdata.PublicRecord>("integration_data.public_records")
				.insert(mappedData)
				.returning("*");
		}
		return upsertedRecords[0];
	};

	/**
	 * Save raw verdata response to db
	 * @param response : Verdata.Record -- Verdata API response
	 * @param businessID
	 * @param task
	 * @param customerID : Optional customer id
	 * @returns
	 */
	public static saveRawResponseToDB = async (
		response: Verdata.Record,
		businessID: UUID,
		task: IBusinessIntegrationTask,
		customerID?: UUID
	): Promise<IRequestResponse> => {
		const insertedRecord = await db<IRequestResponse>("integration_data.request_response")
			.insert({
				request_id: task.id,
				connection_id: task.connection_id,
				business_id: businessID,
				platform_id: INTEGRATION_ID.VERDATA,
				request_type: "fetch_public_records",
				external_id: response.seller_id,
				org_id: customerID,
				request_received: new Date(),
				status: 1,
				response
			})
			.onConflict("request_id")
			.merge()
			.returning("*");
		return insertedRecord[0];
	};

	public static enqueueEnrichRequest = async (requestId: UUID, request: Record<string, any>) => {
		const queue = new BullQueue(QUEUES.VERDATA);
		const jobId = `${requestId}::${request.providedKey || randomUUID()}`;
		return queue.addJob(
			EVENTS.ENRICH_RESPONSE,
			{ requestId, request },
			{ jobId, removeOnComplete: false, removeOnFail: false }
		);
	};

	/**
	 * An enrich request is a request to fetch public records for a business and spread in additional fields
	 * @param job
	 * @returns
	 */
	public static processEnrichRequest = async (job: Job): Promise<any> => {
		logger.info(`BULL QUEUE: processEnrichRequest with id: ${job.id}`);
		const { request } = job.data;
		const {
			providedKey,
			tin,
			customer_id: customerID,
			external_id: externalID,
			business_id: businessID,
			business_name,
			address_line_1,
			address_city,
			address_state,
			address_postal_code,
			...supplement
		} = request;

		const records: Verdata.PublicRecord[] = [];
		const businessIds: UUID[] = [];

		logger.info({ request }, `BULL QUEUE: request for business_id: ${businessID}`);
		const businesses = await businessLookupHelper({ tin, businessID, customerID, externalID });
		logger.info({ businesses }, `BULL QUEUE: business for business_id: ${businessID}`);
		const businessList = Array.isArray(businesses) ? businesses : [businesses];
		for (const business of businessList) {
			// Get appropriate task
			const connection = await getConnectionForBusinessAndPlatform(business.id as UUID, INTEGRATION_ID.VERDATA);
			if (!connection) {
				throw new Error("Could not find verdata connection for business_id: " + business.id);
			}
			const verdata: VerdataClass = platformFactory({ dbConnection: connection });
			const task = await verdata.getLatestTask(businessID, INTEGRATION_ID.VERDATA, "fetch_public_records");
			if (!task) {
				throw new Error("Could not find verdata task for business_id: " + business.id);
			}
			logger.info({ task }, `BULL QUEUE: task for business_id: ${businessID}`);
			const verdataOrder = {
				name: business_name ?? business.name,
				address_line_1: address_line_1 ?? business.address_line_1,
				city: address_city ?? business.address_city,
				state: address_state ?? business.address_state,
				zip5: address_postal_code ?? business.address_postal_code,
				ein: tin
			};
			if (
				!verdataOrder.name ||
				!verdataOrder.address_line_1 ||
				!verdataOrder.city ||
				!verdataOrder.state ||
				!verdataOrder.zip5
			) {
				throw new Error("Missing required fields for public records request");
			}
			logger.info({ verdata_order: verdataOrder }, `BULL QUEUE: verdataOrder for business_id: ${businessID}`);

			const verdataResponse = await verdata.fetchPublicRecords(verdataOrder, null, task.id);
			const enrichedResponse = VerdataUtil.addSupplemental(verdataResponse, supplement);
			await VerdataUtil.saveRawResponseToDB(enrichedResponse, business.id as UUID, task, customerID);
			await VerdataUtil.saveToS3(enrichedResponse, business.id as UUID);
			const record = await VerdataUtil.upsertRecord(task.id, enrichedResponse);
			records.push(record);
			await updateTask(task.id, "SUCCESS");
			await VerdataUtil.requestScore(task, customerID);
			businessIds.push(business.id as UUID);
		}
		return { business_ids: businessIds, records };
	};

	public static async handleVerdataWebhook(body: Verdata.Record, query): Promise<void> {
		const startTime = Date.now();
		const { task_id, business_id } = query;

		try {
			logger.info(
				{
					event: "verdata_webhook_processing_start",
					business_id,
					task_id,
					has_seller_id: !!body?.seller_id
				},
				"Processing Verdata webhook"
			);

			// Note: task_id validation is now handled by the middleware (verifyVerdataWebhookMiddleware)
			// The middleware ensures task_id is valid before we reach this point
			if (!task_id || task_id === "undefined") {
				logger.warn({ task_id }, "Verdata Webhook: Missing task_id (should be caught by middleware)");
				return;
			}

			// Atomically claim the webhook processing to prevent race conditions.
			// This UPDATE only succeeds if:
			// 1. Task exists and is not already SUCCESS
			// 2. Task has not already been claimed (no webhook_claimed_at in metadata)
			// Uses row-level locking to ensure only one concurrent request can claim.
			const claimResult = await db("integrations.data_business_integrations_tasks")
				.where("id", task_id)
				.andWhere("task_status", "!=", "SUCCESS")
				.andWhere(function () {
					this.whereNull("metadata").orWhereRaw("NOT jsonb_exists(metadata::jsonb, ?)", ["webhook_claimed_at"]);
				})
				.update({
					metadata: db.raw(
						"COALESCE(metadata::jsonb, '{}'::jsonb) || jsonb_build_object('webhook_claimed_at', to_jsonb(now()::text))"
					)
				})
				.returning(["id", "connection_id"]);

			if (!claimResult?.length) {
				logger.info(
					{
						event: "verdata_webhook_skipped",
						task_id,
						reason: "task_already_completed_or_claimed",
						processing_time_ms: Date.now() - startTime
					},
					"Verdata Webhook: Task already completed or being processed by another request, skipping"
				);
				return;
			}

			// Successfully claimed - now fetch the full enriched task data
			const task = await VerdataClass.getEnrichedTask(task_id as UUID);
			if (!task?.id) {
				logger.warn({ task_id }, "Verdata Webhook: Task not found after claim (unexpected state)");
				return;
			}

			const dbConnection = await getConnectionById(task.connection_id);
			const verdata = new VerdataClass(dbConnection);
			if (body.seller_id) {
				// Get the current request response for the record
				const requestResponse = await verdata.getRequestResponseByTaskId(query.task_id as UUID);

				// Upsert record
				await VerdataUtil.upsertRecord(task.id, body);

				// Update task to success and add detail to event history log
				await verdata.updateTaskStatus<Verdata.Record>(task.id, TASK_STATUS.SUCCESS, {
					previous: requestResponse?.response ?? null,
					new: body,
					seller_id: body.seller_id,
					message: "Verdata Webhook matched to task"
				});

				try {
					await verdata.saveTaskRequestResponse<Verdata.Record>(
						task,
						body,
						requestResponse?.external_id ?? body.seller_id
					);
				} catch (ex) {
					logger.error({ task_id: task.id, task, error: ex }, "Error saving Verdata webhook as request response");
				}

				// Save to S3 for scoring
				try {
					await uploadRawIntegrationDataToS3(
						body,
						task.business_id,
						"public_records",
						DIRECTORIES.PUBLIC_RECORDS,
						"VERDATA"
					);
				} catch (ex) {
					logger.error({ task_id: task.id, task, error: ex }, "Error saving Verdata webhook to S3 for scoring");
				}

				try {
					// send a task complete message
					const completedTask = await VerdataClass.getEnrichedTask(task.id);
					const payload = {
						topic: kafkaTopics.BUSINESS,
						messages: [
							{
								key: task.business_id,
								value: {
									event: kafkaEvents.INTEGRATION_DATA_READY,
									...completedTask
								},
								headers: { event: kafkaEvents.INTEGRATION_DATA_READY }
							}
						]
					};

					await producer.send(payload);

					await prepareIntegrationDataForScore(completedTask.id, completedTask?.trigger_type);

					logger.info(
						{
							event: "verdata_webhook_processed",
							business_id,
							task_id,
							seller_id: body.seller_id,
							processing_time_ms: Date.now() - startTime,
							task_status: "SUCCESS"
						},
						"Verdata webhook processed successfully"
					);
				} catch (error) {
					logger.error({ error, task_id: task.id }, "Error sending task complete message for task");
				}
			}
		} catch (error) {
			logger.error(
				{
					event: "verdata_webhook_error",
					business_id,
					task_id,
					error,
					processing_time_ms: Date.now() - startTime
				},
				"Verdata Webhook Error"
			);
		}
	}

	/**
	 * Save the raw response from Verdata to S3
	 * We save to "public_records" and "enriched_public_records" files separately because "pubic_records" will be overwritten when the real Verdata job runs and "enriched" information will be lost
	 * The Score Input Mapper should prioritize enriched data over raw data when available
	 * 	e.g.: enriched_public_records.num_liens ?? public_records.num_liens
	 * @param response
	 * @param businessID
	 */
	private static saveToS3 = async (response: Verdata.Record, businessID: UUID): Promise<void> => {
		await Promise.all([
			uploadRawIntegrationDataToS3(response, businessID, "public_records", DIRECTORIES.PUBLIC_RECORDS, "VERDATA"),
			uploadRawIntegrationDataToS3(
				response,
				businessID,
				"enriched_public_records",
				DIRECTORIES.PUBLIC_RECORDS,
				"VERDATA"
			)
		]);
	};

	/**
	 * Given the authoritative record from Verdata, add supplemental data to it in the appropriate places
	 * @param authoritative
	 * @param supplement
	 * @returns the enriched record
	 */
	private static addSupplemental(
		authoritative: Verdata.Record,
		supplement: Partial<Verdata.ThirdPartyData | Verdata.FeatureStore>
	): Verdata.Record {
		//Handle supplement giving us more human readable field names

		const allowedThirdPartyKeys: (keyof Verdata.ThirdPartyData)[] = [
			"BUS_LIENS_SUMMARY_001",
			"BUS_LIENS_SUMMARY_002",
			"BUS_LIENS_SUMMARY_003",
			"BUS_LIENS_SUMMARY_004",
			"BUS_JUDGEMENT_SUMMARY_001",
			"BUS_JUDGEMENT_SUMMARY_002",
			"BUS_JUDGEMENT_SUMMARY_003",
			"BUS_JUDGEMENT_SUMMARY_004",
			"BUS_JUDGEMENT_SUMMARY_005",
			"BUS_BANKRUPTCY_SUMMARY_001",
			"BUS_BANKRUPTCY_SUMMARY_002",
			"BUS_BANKRUPTCY_SUMMARY_003",
			"BUS_BANKRUPTCY_SUMMARY_004",
			"BUS_BANKRUPTCY_SUMMARY_005",
			"BUS_BANKRUPTCY_SUMMARY_006"
		];

		// Make sure the authoritative record has places to put our data
		authoritative.feature_store = authoritative.feature_store ?? [{}];
		authoritative.feature_store[0] = authoritative.feature_store[0] ?? ({} as unknown as Verdata.FeatureStore);
		authoritative.ThirdPartyData = authoritative.ThirdPartyData ?? [{} as unknown as Verdata.ThirdPartyData];
		authoritative.ThirdPartyData[0] = authoritative.ThirdPartyData[0] ?? ({} as unknown as Verdata.ThirdPartyData);
		// Inspect supplement, only get the elements that are allowed && build new object
		const newRecord = Object.keys(supplement).reduce((acc, providedKey) => {
			const value = supplement[providedKey];
			const key = VerdataUtil.remapFeatureStoreKey(providedKey);
			if (this.FEATURE_KEYS.includes(key as keyof Verdata.FeatureStore)) {
				// Check the feature store array to see if exists anywhere, if it does replace it at that index
				acc.feature_store.forEach((element, index) => {
					if (element[key] !== undefined) {
						acc.feature_store[index][key] = value;
					}
				});
				// Set it at index 0 as well
				acc.feature_store[0][key] = value;
			} else if (allowedThirdPartyKeys.includes(key as keyof Verdata.ThirdPartyData)) {
				allowedThirdPartyKeys.forEach((element, index) => {
					if (acc.ThirdPartyData && acc.ThirdPartyData[index][element] !== undefined) {
						acc.ThirdPartyData[index] = acc.ThirdPartyData[index] ?? ({} as unknown as Verdata.ThirdPartyData);
						(acc.ThirdPartyData[index] as any)[element] = value;
					}
				});
				if (acc.ThirdPartyData) {
					acc.ThirdPartyData[0][key] = value;
				}
			}

			// If this is a "review count" field, also set the "google review" fields for compatibility
			if (key === "rev_0126" && !authoritative.feature_store[0]["rev_0035"]) {
				acc.feature_store[0]["rev_0035"] = value;
				acc.feature_store[0]["rev_0091"] = 1;
			} else if (key == "rev_0035" && !authoritative.feature_store[0]["rev_0126"]) {
				//If google is set, also set these for compatabilitiy
				acc.feature_store[0]["rev_0126"] = value;
				acc.feature_store[0]["rev_0091"] = 1;
			}

			return acc;
		}, authoritative);
		return newRecord;
	}

	/**
	 * Send a message to the scores topic to request a score calculation
	 * Requires that a business_score_trigger_id is set on the task and the task to be related to a case
	 * Application logic in score service may prevent an actual score from being calculated if the Trigger already ran
	 * @param task
	 * @param customerID
	 */
	private static async requestScore(task: IBusinessIntegrationTask, customerID: string | null): Promise<void> {
		const enrichedTask = await VerdataClass.getEnrichedTask(task.id);
		if (!enrichedTask?.business_score_trigger_id) {
			return;
		}
		const relatedCase = await db("public.data_cases")
			.select("*")
			.where({ score_trigger_id: enrichedTask.business_score_trigger_id })
			.first();
		if (!relatedCase?.id) {
			return;
		}
		const message = {
			score_trigger_id: enrichedTask.business_score_trigger_id,
			customer_id: customerID,
			business_id: enrichedTask.business_id,
			case_id: relatedCase.id,
			trigger_type: enrichedTask.trigger_type
		};
		await prepareIntegrationDataForScore(task.id, enrichedTask.trigger_type);
	}

	/**
	 * Given a human-readable key or field name from the supplement, remap it to the appropriate key in the feature store
	 * @param fieldName
	 * @returns
	 */
	private static remapFeatureStoreKey = (fieldName: string): keyof Verdata.FeatureStore => {
		switch (fieldName.toLowerCase()) {
			case "review_score":
			case "reviewscore":
			case "googlescore":
			case "score":
				return "rev_0182";
			case "review_cnt":
			case "review_count":
			case "reviewcount":
			case "googlecount":
				return "rev_0126";
		}
		return fieldName;
	};

	private static convertMDYToDate = (mdyDateString: Verdata.MDYDate | ""): Date | null => {
		if (!mdyDateString) {
			return null;
		}
		return dayjs(mdyDateString).startOf("day").toDate();
	};

	/**
	 * @description Add a job to the seller not found queue to fetch the seller data again
	 * @param {Object} body
	 * @param {UUID} body.business_id : UUID of the business
	 * @param {UUID} body.business_task_id : UUID of the business task
	 * @param {UUID} body.connection_id : UUID of the connection
	 * @param {string} body.name : Name of the business
	 * @param {string} body.address_line_1 : Address line 1 of the business
	 * @param {string} body.city : City of the business
	 * @param {string} body.state : State of the business
	 * @param {number} body.zip5 : Zip5 of the business
	 * @param {number} body.ein : EIN of the business
	 * @returns {Job} : The job that was added to the queue
	 */
	public static async addJobForSellerNotFound(body: SellerNotFoundJobBody): Promise<Job> {
		logger.info(`BULL QUEUE: ********ADDING JOB TO SELLER NOT FOUND QUEUE********`);

		const now = new Date();
		const cronString = `${now.getUTCMinutes()} ${now.getUTCHours()} * * *`;
		// schedule the job to fetch the seller data again
		const verdataQueue = new BullQueue(QUEUES.VERDATA_RETRY);
		const job = await verdataQueue.addJob(EVENTS.SELLER_NOT_FOUND, body, {
			removeOnComplete: VerdataUtil.QUEUE_MAX_RETENTION,
			removeOnFail: VerdataUtil.QUEUE_MAX_FAILED_RETENTION,
			jobId: body.business_task_id,
			repeat: { cron: cronString, tz: "utc" },
			delay: Number(envConfig.BULL_MQ_FETCH_SELLER_REFETCH_TIME),
			attempts: Number(envConfig.BULL_MQ_FETCH_SELLER_RETRY_ATTEMPTS)
		});
		return job;
	}

	/**
	 * @description Add a job to the seller search queue to fetch the seller data with delay or retry
	 * @param {Object} body
	 * @param {UUID} body.business_id : UUID of the business
	 * @param {UUID} body.business_task_id : UUID of the business task
	 * @param {UUID} body.connection_id : UUID of the connection
	 * @param {string} body.type : Type of the job
	 * @returns {Job} : The job that was added to the queue
	 */
	public static async addJobForSellerSearch(body: SellerSearchJobBody): Promise<Job> {
		logger.info(`BULL QUEUE: ********ADDING JOB TO SELLER SEARCH QUEUE********`);

		// schedule the job to fetch the seller data again
		const verdataQueue = new BullQueue(QUEUES.VERDATA_RETRY);
		const job = await verdataQueue.addJob(EVENTS.RETRY_OR_DELAY_SELLER_SEARCH, body, {
			removeOnComplete: VerdataUtil.QUEUE_MAX_RETENTION,
			removeOnFail: VerdataUtil.QUEUE_MAX_FAILED_RETENTION,
			jobId: body.business_task_id,
			delay: 1000
		});
		return job;
	}

	public static convertMDYToYMDString = (mdyDateString: Verdata.MDYDate | ""): Verdata.YMDDate | null => {
		if (!mdyDateString) {
			return null;
		}
		let [month, day, year] = mdyDateString.split("/");
		// Pad day & month with 0 if they are single digits
		month = month.padStart(2, "0");
		day = day.padStart(2, "0");
		return `${Number(year)}-${month}-${day}`;
	};

	/**
	 * Convert the data in the deprecated ThirdPartyData shape to the new BLJ shape
	
	 * @param thirdPartyData Verdata.ThirdPartyData[]
	 * @returns : Verdata.BLJ[]
	 */
	static convertThirdPartyToBLJ(thirdPartyData: Verdata.ThirdPartyData[]): Verdata.BLJ[] {
		const blj: Verdata.BLJ[] = [
			{
				liens: [],
				judgements: [],
				bankruptcies: [],
				corp_filing: [],
				uccs: [],
				merchant: [],
				locations: [],
				watchlists: [],
				principals: [],
				summary: {
					lien_debtor_count: null,
					lien_holder_count: null,
					judgement_debtor_count: null,
					judgement_creditor_count: null,
					bankruptcy_subject_count: null,
					bankruptcy_creditor_count: null
				}
			}
		];

		const toNumberOrNull = (value: number | null | string): null | number => {
			if (value == null) {
				return null;
			}
			if (typeof value === "number") {
				return value;
			}
			if (typeof value === "string") {
				// regex for numeric string check
				if (value === "None Found" || value === "0") {
					return 0;
				}
				if (!/^\d+$/.test(value)) {
					return null;
				}
				return Number(value);
			}
			return null;
		};

		for (const thirdParty of thirdPartyData) {
			const numJudgements = toNumberOrNull(thirdParty.BUS_JUDGEMENT_SUMMARY_001);
			const numLiens = toNumberOrNull(thirdParty.BUS_LIENS_SUMMARY_001);
			const numBankruptcies = toNumberOrNull(thirdParty.BUS_BANKRUPTCY_SUMMARY_001);

			(blj[0].summary as Verdata.Summary).judgement_debtor_count = numJudgements;
			(blj[0].summary as Verdata.Summary).lien_debtor_count = numLiens;
			(blj[0].summary as Verdata.Summary).bankruptcy_creditor_count = numBankruptcies;

			if (numJudgements) {
				// Ensure summary object exists before accessing properties
				blj[0].judgements.push({
					filing_date: VerdataUtil.convertMDYToYMDString(thirdParty.BUS_JUDGEMENT_SUMMARY_002),
					status: thirdParty.BUS_JUDGEMENT_SUMMARY_003 || "active",
					status_date: VerdataUtil.convertMDYToYMDString(thirdParty.BUS_JUDGEMENT_SUMMARY_004),
					amount_awarded: thirdParty.BUS_JUDGEMENT_SUMMARY_005,
					debtor_name: null,
					debtor_business_name: null,
					debtor_business_token: null,
					debtor_addr1: null,
					debtor_addr2: null,
					debtor_city: null,
					debtor_state: null,
					debtor_zip5: null,
					debtor_zip4: null,
					creditor_name: null,
					verification_date: null,
					filing_number: null,
					filing_number_descriptor: null,
					judgement_type: null,
					received_date: null,
					filing_office_name: null,
					filing_office_addr1: null,
					filing_office_addr2: null,
					filing_office_city: null,
					filing_office_state: null,
					filing_office_zip5: null,
					filing_office_zip4: null,
					filing_addr1: null,
					filing_addr2: null,
					filing_city: null,
					filing_state: null,
					filing_zip5: null,
					filing_zip4: null
				});
				if (numJudgements > 1) {
					// Add an object for each additional judgement (but we only have the most recent one's details)
					for (let i = 1; i < numJudgements; i++) {
						blj[0].judgements.push({
							...blj[0].judgements[0],
							status: "active",
							status_date: null,
							amount_awarded: null
						});
					}
				}
			}
			if (numLiens) {
				blj[0].liens.push({
					filing_date: VerdataUtil.convertMDYToYMDString(thirdParty.BUS_LIENS_SUMMARY_002),
					status: thirdParty.BUS_LIENS_SUMMARY_003 || "active",
					status_date: VerdataUtil.convertMDYToYMDString(thirdParty.BUS_LIENS_SUMMARY_004),
					lien_amount: null,
					lien_type: "unknown",
					tax_reason: null,
					debtor_city: null,
					debtor_name: null,
					debtor_zip4: null,
					debtor_zip5: null,
					filing_city: null,
					filing_zip4: null,
					filing_zip5: null,
					holder_name: null,
					debtor_addr1: null,
					debtor_addr2: null,
					debtor_state: null,
					filing_addr1: null,
					filing_addr2: null,
					filing_state: null,
					filing_number: null,
					received_date: null,
					filing_gov_level: null,
					filing_type_desc: null,
					filing_office_city: null,
					filing_office_name: null,
					filing_office_zip4: null,
					filing_office_zip5: null,
					filing_office_addr1: null,
					filing_office_addr2: null,
					filing_office_state: null,
					debtor_business_name: null,
					debtor_business_token: null,
					lien_type_description: null,
					filing_number_descriptor: null,
					lien_holder_government_level: null
				});
				if (numLiens > 1) {
					// Add an object for each additional judgement (but we only have the most recent one's details)
					for (let i = 1; i < numLiens; i++) {
						blj[0].liens.push({
							...blj[0].liens[0],
							filing_date: null,
							status: "active",
							status_date: null
						});
					}
				}
			}
			if (numBankruptcies) {
				blj[0].bankruptcies.push({
					filing_date: thirdParty.BUS_BANKRUPTCY_SUMMARY_002
						? VerdataUtil.convertMDYToYMDString(thirdParty.BUS_BANKRUPTCY_SUMMARY_002)
						: null,
					filing_chapter_number: thirdParty.BUS_BANKRUPTCY_SUMMARY_003
						? thirdParty.BUS_BANKRUPTCY_SUMMARY_003.toString()
						: null,
					voluntary_filing_flag: thirdParty.BUS_BANKRUPTCY_SUMMARY_004 ? "Y" : "N",
					status: thirdParty.BUS_BANKRUPTCY_SUMMARY_005,
					status_date: thirdParty.BUS_BANKRUPTCY_SUMMARY_006
						? VerdataUtil.convertMDYToYMDString(thirdParty.BUS_BANKRUPTCY_SUMMARY_006)
						: null,
					event_date: null,
					event_desc: null,
					debtor_name: null,
					debtor_business_name: null,
					debtor_business_token: null,
					debtor_addr1: null,
					debtor_addr2: null,
					debtor_city: null,
					debtor_state: null,
					debtor_zip5: null,
					debtor_zip4: null,
					attorney_firm_name: null,
					attorney_first_name: null,
					attorney_middle_name: null,
					attorney_last_name: null,
					attorney_suffix: null,
					attorney_title: null,
					filing_number: null,
					verification_date: null,
					judge_report_token: null,
					judge_first_name: null,
					judge_middle_name: null,
					judge_last_name: null,
					judge_suffix: null,
					judge_title: null,
					court_name: null,
					court_addr1: null,
					court_addr2: null,
					court_city: null,
					court_state: null,
					court_zip5: null,
					court_zip4: null
				});
				if (numBankruptcies > 1) {
					// Add an object for each additional judgement (but we only have the most recent one's details)
					for (let i = 1; i < numBankruptcies; i++) {
						blj[0].bankruptcies.push({
							...blj[0].bankruptcies[0],
							filing_date: null,
							filing_chapter_number: null,
							voluntary_filing_flag: null,
							status: null,
							status_date: null
						});
					}
				}
			}
		}
		return blj;
	}
}
function noneFoundToZero(value) {
	if (!value) {
		return "0";
	}
	return value === "None Found" ? "0" : value;
}

function getValueFromLatestRecord(records, dateKey, returnKey = "filing_date") {
	if (!Array.isArray(records) || records.length === 0 || !dateKey || !returnKey) {
		return null;
	}

	const latestRecord = records.reduce((latest, current) => {
		if (!current[dateKey]) return latest;
		if (!latest[dateKey]) return current;
		return new Date(current[dateKey]) > new Date(latest[dateKey]) ? current : latest;
	});

	return latestRecord?.[returnKey] ?? null;
}
