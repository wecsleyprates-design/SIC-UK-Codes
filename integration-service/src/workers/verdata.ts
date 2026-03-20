import { envConfig } from "#configs";
import { EVENTS, QUEUES } from "#constants/bull-queue.constants";
import BullQueue, { runJob } from "#helpers/bull-queue";
import { sqlQuery } from "#helpers/database";
import { BusinessDetails, getBusinessDetails, getConnectionByTaskId, logger, platformFactory } from "#helpers/index";
import { Job } from "bull";
import axios from "axios";
import { VerdataUtil } from "#lib/verdata/verdataUtil";
import { checkAndTriggerRiskAlert } from "#common/common-new";
import type * as Verdata from "#lib/verdata/types";
import type { Verdata as VerdataClass } from "#lib/verdata/verdata";
import { uploadRawIntegrationDataToS3, prepareIntegrationDataForScore } from "#common/index";
import { SellerSearchJobBody, type SellerNotFoundJobBody } from "./types";
import { DIRECTORIES, TASK_STATUS, type TaskStatus } from "#constants";
import { TaskManager } from "#api/v1/modules/tasks/taskManager";
import type { UUID } from "crypto";
import { getBusinessEntityVerificationService } from "#api/v1/modules/verification/businessEntityVerification";
import * as VerdataType from "#lib/verdata/types";

export const verdataRetryQueue = new BullQueue(QUEUES.VERDATA_RETRY, {
	defaultJobOptions: {
		removeOnComplete: 100,
		removeOnFail: 1000
	},
	limiter: {
		max: 1,
		duration: 1000 * 60 // 1 minute
	} // Limit the number of jobs to 1 per minute
});
export const verdataQueue = new BullQueue(QUEUES.VERDATA, {
	defaultJobOptions: {
		removeOnComplete: 100,
		removeOnFail: 1000
	},
	limiter: {
		max: 4,
		duration: 1000 * 60 // 1 minute
	} // Limit the number of jobs to 4 per minute
});

type Response = Verdata.Record & { isSellerNotFound?: boolean; message?: string; business?: Record<string, any> };

export const initVerdataWorker = () => {
	verdataQueue.queue.process(EVENTS.FETCH_PUBLIC_RECORDS, async (job: Job) => {
		const [waitingCount, delayedCount] = await Promise.all([job.queue.getWaitingCount(), job.queue.getDelayedCount()]);
		logger.info(`BULL QUEUE: ${job.queue.name} Processing job ${job.id} of type ${job.name} -- ${waitingCount} jobs waiting & ${delayedCount} jobs delayed`);
		const body = job.data as VerdataType.EnqueuedTask;
		const { task_id } = body;
		if (task_id) {
			const connection = await getConnectionByTaskId(task_id);
			if (!connection) {
				throw new Error("Could not find verdata connection for task_id: " + task_id);
			}
			const verdata: VerdataClass = platformFactory({ dbConnection: connection });
			try {
				await verdata.processFetchPublicRecordsTask(task_id);
			} catch (error) {
				logger.error({ error }, `BULL QUEUE: Error processing jobId ${job.id} of type ${EVENTS.FETCH_PUBLIC_RECORDS} for taskId ${task_id}`);
			}
		}
	});

	verdataRetryQueue.queue
		.process(EVENTS.SELLER_NOT_FOUND, async (job: Job<SellerNotFoundJobBody>) => {
			const [waitingCount, delayedCount] = await Promise.all([job.queue.getWaitingCount(), job.queue.getDelayedCount()]);
			logger.info(`BULL QUEUE: ${job.queue.name} Processing job ${job.id} of type ${job.name} -- ${waitingCount} jobs waiting & ${delayedCount} jobs delayed`);
			const body = job.data;
			const { name, address_line_1, city, state, zip5, case_id } = body;
			let sellerBody = {
				name,
				address_line_1,
				city,
				state,
				zip5,
				...(body.name_dba && { name_dba: body.name_dba })
			};

			const businessID = body.business_id;
			const businessTaskID = body.business_task_id;
			const connection = await getConnectionByTaskId(businessTaskID);
			if (!connection) {
				throw new Error("Could not find verdata connection for task_id: " + businessTaskID);
			}
			const verdata: VerdataClass = platformFactory({ dbConnection: connection });

			// If the name is not present then fetch the business details from case service
			if (!name) {
				const businessDetails = await getBusinessDetails(businessID);

				const data = businessDetails?.data as BusinessDetails;
				const dbaName = data.business_names?.find(name => name.name.toLowerCase() !== data.name.toLowerCase());
				sellerBody = {
					name: data.name,
					address_line_1: data.address_line_1,
					city: data.address_city,
					state: data.address_state,
					zip5: data.address_postal_code,
					...(dbaName && { name_dba: dbaName.name })
				};
			}

			let result: any = {};
			let log: any = "",
				err: any = "";
			let connectionStatus = "SUCCESS";
			let taskStatus: TaskStatus = TASK_STATUS.SUCCESS;

			// Fetch data from Verdata
			try {
				result = await verdata.sellerSearch(sellerBody);
				logger.info(`BULL QUEUE: Data Fetched Successfully for case: ${case_id}, for job ${job.id} of type ${job.name}`);
				result = Object.hasOwn(result, "data") ? result.data : {};

				// Check if the seller is not found
				if (Object.hasOwn(result, "isSellerNotFound") && result.isSellerNotFound === true) {
					log = { message: "Seller not found", status: 404, code: "SELLER_NOT_FOUND", action: "REFETCH_SELLER_DATA", attempt: job.opts.repeat?.count || 0 };

					// maintain the task history
					await verdata.updateTaskStatus(businessTaskID, TASK_STATUS.SUCCESS, log);
					// don't update the public_records table if the seller is not found
					return;
				} else {
					log = { message: "Data Fetched Successfully", status: 202, code: "SELLER_NOT_FOUND", action: "REFETCH_SELLER_DATA", attempt: job.opts.repeat?.count || 0 };
				}
			} catch (error) {
				err = error;
				logger.error(error);
				logger.info(`BULL QUEUE: Error fetching data for case: ${case_id}. for job ${job.id} of type ${job.name}`);
				const count = job.opts.repeat?.count || 0;
				// update the count of the job and reschedule it
				if (count < Number(envConfig.BULL_MQ_FETCH_SELLER_RETRY_ATTEMPTS)) {
					return;
				}
				// remove the job from the queue if the retry count is exceeded
				// Please make sure you pass the same options as you passed while adding the job if there is no repeatable key
				logger.info(`BULL QUEUE: Removing job for case_id: ${case_id} with ${job.id} of type ${job.name} after ${Number(envConfig.BULL_MQ_FETCH_SELLER_RETRY_ATTEMPTS)} attempts`);
				// Ensure the correct queue is used for removing repeatable jobs
				// Using verdataRetryQueue here because it handles retry logic for seller-not-found jobs
				job.opts.repeat?.key && (await verdataRetryQueue.removeRepeatableByKey(job.opts.repeat?.key));

				if (axios.isAxiosError(error)) {
					switch (error.response?.status) {
						case 504:
							await VerdataUtil.addJobForSellerSearch({
								business_id: body.business_id,
								connection_id: body.connection_id,
								business_task_id: body.business_task_id,
								type: "RETRY_SEARCH"
							});

							// PAUSE QUEUE FOR 3 SECONDS
							await verdataRetryQueue.pauseQueue(3);
							const isQueuePaused = await verdataRetryQueue.queue.isPaused();
							logger.info(`BULL QUEUE: Queue is paused: ${isQueuePaused}`);
							break;

						case 404:
							return;

						default:
							break;
					}
				}

				connectionStatus = "FAILED";
				taskStatus = TASK_STATUS.FAILED;
			}

			try {
				const task = await TaskManager.getEnrichedTask(businessTaskID);
				task.metadata = { ...task.metadata, ...body };
				await VerdataUtil.saveRawResponseToDB(result, businessID, task);
			} catch (ex) {
				logger.error(`Error in attempting to archiveResponse in verdata bullqueue process ${JSON.stringify(ex)}`);
			}
			verdata.updateTaskStatus(businessTaskID, taskStatus, log);

			if (connectionStatus === "SUCCESS") {
				await VerdataUtil.upsertRecord(businessTaskID, result);
				// Trigger risk alert for new lien, new judgement, new bankruptcy if any
				await checkAndTriggerRiskAlert("public_records", businessID, businessTaskID);
			}
			logger.info(`BULL QUEUE: Job ${job.id} of type ${job.name} processed successfully for case_id: ${body.case_id}`);
			job.opts.repeat?.key && (await verdataRetryQueue.removeRepeatableByKey(job.opts.repeat?.key));
			logger.info(`BULL QUEUE: Job ${job.id} of type ${job.name} removed from the queue for case_id: ${body.case_id}`);
		})
		.catch(error => {
			logger.error(`BULL QUEUE: Error processing job of type ${EVENTS.SELLER_NOT_FOUND}`);
			logger.error(error);
		});

	verdataRetryQueue.queue.process(EVENTS.RETRY_OR_DELAY_SELLER_SEARCH, async (job: Job) => {
		try {
			const startTime = performance.now();
			const body = job.data as SellerSearchJobBody;
			logger.info(`BULL QUEUE: Processing job ${job.id} of event type ${job.name} and search type ${body.type}`);

			const taskQuery = `SELECT task_status FROM integrations.data_business_integrations_tasks WHERE id = $1`;
			const taskQueryResult = await sqlQuery({ sql: taskQuery, values: [body.business_task_id] });

			if (taskQueryResult.rows[0]?.task_status === TASK_STATUS.SUCCESS) {
				logger.info(`BULL QUEUE: Job ${job.id} of type ${job.name} already processed successfully for business_id: ${body.business_id}`);
				return;
			}

			const connection = await getConnectionByTaskId(body.business_task_id);
			if (!connection) {
				throw new Error("Could not find verdata connection for task_id: " + body.business_task_id);
			}

			let taskStatus = "SUCCESS";
			let response: Response | null = null;
			let error, log;

			// fetch public records
			try {
				const verdata: VerdataClass = platformFactory({ dbConnection: connection });
				response = (await verdata.fetchPublicRecords({}, body.business_id, body.business_task_id)) as Response;
				log = Object.keys(response).length ? "Data Fetched Successfully." : "No data returned from the vendor.";

				if (Object.hasOwn(response, "isSellerNotFound") && response.isSellerNotFound === true) {
					log = { message: "Seller not found", status: 404, code: "SELLER_NOT_FOUND", action: "REFETCH_SELLER_DATA" };
					await VerdataUtil.addJobForSellerNotFound(body);
				} else if (Object.keys(response).length) {
					log = "Data Fetched Successfully.";
					if (!response?.ThirdPartyData?.length && (!Array.isArray(response?.blj) || response?.blj?.length === 0) && !Object.hasOwn(response?.blj, "summary")) {
						log = "No third party or blj data returned from Verdata";
					}
				}
			} catch (err) {
				error = err;
				logger.error(JSON.stringify(error));
				log = `{message : ${error.response?.message}, status: ${error.response?.status}, code: ${error.response?.code}, request: ${error.response?.config}}`;
				taskStatus = TASK_STATUS.FAILED;
				// check for err status code and if it is 504 then retry the job
				if (axios.isAxiosError(error) && error.response?.status === 504) {
					logger.info(`BULL QUEUE: Verdata limit hit for searching for business_id: ${body.business_id}`);
					await VerdataUtil.addJobForSellerSearch(body);
					// PAUSE QUEUE FOR 3 SECONDS. We can reduce the load from the vendor by pausing the queue for 3 seconds
					await verdataRetryQueue.pauseQueue(3);
				}
			}

			// insert public records in db
			if (response) {
				await VerdataUtil.upsertRecord(body.business_task_id, response);
			}
			if (taskStatus === "SUCCESS") {
				await uploadRawIntegrationDataToS3(response, body.business_id, "public_records", DIRECTORIES.PUBLIC_RECORDS, "VERDATA");
				if (response?.seller?.domain_name) {
					const enrichedTask = await TaskManager.getEnrichedTask(body.business_task_id);
					const service = await getBusinessEntityVerificationService(body.business_id);
					await service.fallbackFetchMiddeskWebsiteDetails(enrichedTask, response.seller.domain_name);
				}
			}

			await prepareIntegrationDataForScore(body.business_task_id);
			await checkAndTriggerRiskAlert("public_records", body.business_id, body.business_task_id);

			const endTime = performance.now();

			const executionTime = endTime - startTime;

			// Conversation with Verdata Team:
			// As of right now our firewall throttles the API
			// to allow 300 requests per 5 minutes, or 1 request per second.
			// So we can delay the job to have processing time as 1 second if it is processed in less than 1 second
			// Morever we can't predict the length of businesses so we can't delay the job based on the length of the business data
			// Using redis to maintain the counter can lead to race conditions and we can't use the rate limiter as well
			if (executionTime < 1000) {
				await new Promise(resolve => setTimeout(resolve, 1000 - executionTime));
				logger.info(`BULL QUEUE: Job ${job.id} was executed in ${executionTime}ms. Delayed for ${1000 - executionTime}ms`);
			}

			logger.info(`BULL QUEUE: Job ${job.id} of type ${job.name} processed successfully for business_id: ${body.business_id} executed in ${executionTime}ms`);
		} catch (error) {
			logger.error({ error }, 'BULL QUEUE: BULL QUEUE: Error processing job of type ${EVENTS.RETRY_OR_DELAY_SELLER_SEARCH}');
			throw error;
		}
	});
};

export const initEnrichWorker = () => {
	verdataRetryQueue.queue.process(EVENTS.ENRICH_RESPONSE, async (job: Job, done) => {
		logger.info(`BULL QUEUE: Processing job ${job.id} of type ${job.name}`);
		await runJob(job, done, VerdataUtil.processEnrichRequest);
	});
};
