import { customerIntegrationSettings } from "#api/v1/modules/customer-integration-settings/customer-integration-settings";
import { TaskManager, type TaskHandlerMap } from "#api/v1/modules/tasks/taskManager";
import { envConfig } from "#configs/index";
import { EVENTS, FEATURE_FLAGS, INTEGRATION_ENABLE_STATUS, INTEGRATION_ID, TASK_STATUS } from "#constants";
import { getBusinessDetails, getFlagValue, logger, sqlQuery, TIN_BEHAVIOR } from "#helpers/index";
import axios, { AxiosError, type AxiosRequestConfig, type AxiosResponse } from "axios";
import type { UUID } from "crypto";
import type * as VerdataType from "./types";
import { VerdataUtil } from "./verdataUtil";
import { verdataQueue } from "#workers/verdata";
import { generateSignedCallbackUrl } from "./signatureUtils";
import type { IBusinessIntegrationTaskEnriched } from "#types/db";
import { Tasks } from "#models/tasks";

type GetPublicRecordsResponse = Partial<VerdataType.Record> & {
	isSellerNotFound?: boolean;
	matches?: any;
	bestMatch?: any;
	message?: string;
	request_id?: string;
};

export class Verdata extends TaskManager {
	private static readonly MAX_ATTEMPTS = 5;
	private static readonly MS_BETWEEN_ATTEMPTS = 5000;
	protected static readonly PLATFORM_ID = INTEGRATION_ID.VERDATA;
	private static readonly HEADERS: VerdataType.RequestHeaders = {
		"Content-Type": "application/json",
		Authorization: `Token ${envConfig.VERDATA_AUTHORIZATION_TOKEN}`,
		Key: `Token ${envConfig.VERDATA_KEY}`,
		LenderId: `${envConfig.VERDATA_LENDER_ID}`
	};
	// If environment variable is not set, use the default callback URL
	private static readonly DEFAULT_CALLBACK_URL = "https://api.joinworth.com/integration/api/v1/verdata/webhook";

	protected taskHandlerMap: TaskHandlerMap = {
		// Add any tasks that should be handled when calling super.processTask
	};

	public async processTask({
		taskId,
		task
	}: {
		taskId?: UUID;
		task?: IBusinessIntegrationTaskEnriched;
	}): Promise<IBusinessIntegrationTaskEnriched> {
		taskId = taskId || task?.id;
		if (!taskId) {
			throw new Error("Task ID is required");
		}
		let verificationIntegrationStatus = true;
		const customerId = await this.getCustomerFromTask(taskId);
		if (customerId) {
			// get integration status for customer
			const integrationStatus = await customerIntegrationSettings.getIntegrationStatusForCustomer(customerId);
			const verdataIntegrationStatus = integrationStatus?.find(status => status?.integration_code === "verdata");
			verificationIntegrationStatus = ["ENABLED", "REQUIRED"].includes(verdataIntegrationStatus?.status) ? true : false;
		}
		// Stop execution if verificationIntegrationStatus is false
		if (!verificationIntegrationStatus) {
			logger.info({ customerId, taskId }, "Verdata integration is disabled. Skipping task processing.");
			await this.updateTaskStatus(taskId, TASK_STATUS.FAILED, { message: "Verdata Integration disabled" });

			return {
				...(task ?? { id: taskId }) // Return at least the task ID if task object is missing
			} as IBusinessIntegrationTaskEnriched;
		}
		if (!task) {
			task = await Verdata.getEnrichedTask(taskId);
		}
		if (task?.task_code === "fetch_public_records") {
			this.enqueueFetchPublicRecordsTask(taskId);
		} else {
			return super.processTask({ taskId, task });
		}
		return task;
	}

	public async sellerSearch(
		body: Partial<VerdataType.WorthInternalOrder>
	): Promise<AxiosResponse<VerdataType.SearchResponse, VerdataType.RequestHeaders>> {
		const payload = { ...body } as VerdataType.SellerSearch;
		if (body.name_dba) {
			payload.alt_name = body.name_dba;
		}
		if (body.name && body.address_line_1 && body.city && body.state && body.zip5) {
			// Generate a signed callback URL for security
			const baseCallbackUrl = envConfig.VERDATA_WEBHOOK_URL || Verdata.DEFAULT_CALLBACK_URL;
			const { url: signedCallbackUrl } = generateSignedCallbackUrl(baseCallbackUrl, {
				business_id: body.business_id as string,
				task_id: body.task_id as string
			});
			payload.callback = signedCallbackUrl;
		}
		return this.post<VerdataType.SearchResponse>("https://api.myverdata.com/external/api/v1/seller", payload);
	}

	public async fetchPublicRecords(
		order: Partial<VerdataType.WorthInternalOrder> = {},
		businessID: UUID | null = null,
		taskId: UUID | undefined
	) {
		let verificationIntegrationStatus = true;
		const customerId = taskId ? await this.getCustomerFromTask(taskId) : undefined;
		if (customerId) {
			// get integration status for customer
			const integrationStatus = await customerIntegrationSettings.getIntegrationStatusForCustomer(customerId);
			const verdataIntegrationStatus = integrationStatus?.find(status => status?.integration_code === "verdata");
			verificationIntegrationStatus = ["ENABLED", "REQUIRED"].includes(verdataIntegrationStatus?.status) ? true : false;
		}
		// Stop execution if verificationIntegrationStatus is false
		if (!verificationIntegrationStatus) {
			logger.info({ customerId, taskId }, "Verdata integration is disabled. Skipping records fetch.");
			if (taskId) {
				await this.updateTaskStatus(taskId, TASK_STATUS.FAILED, { message: "Verdata Integration disabled" });
			}
			return { status: "fail", message: "Verdata integration is not enabled for this customer." };
		}
		const isBJLEnabled: boolean = taskId ? await this.isBJLEnabled(taskId) : false;

		if (!Object.keys(order).length && businessID) {
			const getBusinessDetailsResponse = await getBusinessDetails(businessID, undefined, TIN_BEHAVIOR.PLAIN);
			if (getBusinessDetailsResponse.status === "success") {
				const { data } = getBusinessDetailsResponse;

				// Find first dba name that is not the same as the business name
				const dbaName = data.business_names.find(name => name.name.toLowerCase() !== data.name.toLowerCase());
				order = {
					business_id: businessID,
					name: data.name,
					address_line_1: data.address_line_1,
					...(data.address_line_2 && { address_line_2: data.address_line_2 }),
					city: data.address_city,
					state: data.address_state,
					zip5: data.address_postal_code,
					...(data.tin && { ein: data.tin }),
					...(dbaName && dbaName?.name && { name_dba: dbaName.name }),
					task_id: taskId
				} as VerdataType.WorthInternalOrder;
			}
			logger.info({ business_id: businessID, order: order }, "fetchPublicRecords order");
			const response: any = await this.getPublicRecords(order as VerdataType.WorthInternalOrder, { isBJLEnabled });

			if (response?.isSellerNotFound === true) {
				if (taskId) {
					const task = await Tasks.getById(taskId);
					const taskRecord = task.getRecord();
					await VerdataUtil.addJobForSellerNotFound({
						business_task_id: taskRecord.id,
						business_id: businessID,
						connection_id: taskRecord.connection_id,
						name: order.name,
						address_line_1: order.address_line_1,
						city: order.city,
						state: order.state,
						zip5: order.zip5,
						ein: order.ein
					});
				}

				return { ...response, business: order };
			}
			return response;
		}
	}

	/*
	 * Protected: This method enqueues a task into the Verdata queue for asynchronous processing.
	 * It does not process the task synchronously. Should only be called by the task manager.
	 */
	protected async enqueueFetchPublicRecordsTask(taskId: UUID): Promise<IBusinessIntegrationTaskEnriched> {
		const job = await verdataQueue.addJob<VerdataType.EnqueuedTask>(EVENTS.FETCH_PUBLIC_RECORDS, { task_id: taskId });
		await this.updateTaskStatus(taskId, TASK_STATUS.INITIALIZED, {
			job_id: job.id,
			message: "Enqueued fetch public records task"
		});
		return Verdata.getEnrichedTask(taskId);
	}

	/* Public because the Verdata worker will call this */
	public async processFetchPublicRecordsTask(taskId: UUID) {
		const connection = this.getDBConnection();
		if (!connection) {
			await this.updateTaskStatus(taskId, TASK_STATUS.FAILED, { message: "No connection to database" });
			return false;
		}
		await this.updateTaskStatus(taskId, TASK_STATUS.IN_PROGRESS, { message: "Fetching public records" });
		const response = await this.fetchPublicRecords({}, connection.business_id, taskId);
		if (response.request_id) {
			const task = await this.updateTask(taskId, { reference_id: response.request_id });
			logger.debug(`Process fetch public records task ${taskId} for request_id: ${response.request_id}`);
			// Temporary workaround for PAT-285: Webhook event not received for seller search.
			// If webhook data is missing, update the task status and perform an upsert of the records.
			const isBJLEnabled: boolean = taskId ? await this.isBJLEnabled(taskId) : false;
			if (!isBJLEnabled) {
				if (response.seller_id) {
					await VerdataUtil.upsertRecord(taskId, response);
					await this.updateTaskStatus(taskId, TASK_STATUS.SUCCESS, { message: "Successfully fetched public records" });
					try {
						const completedTask = await Verdata.getEnrichedTask(taskId);
						await this.sendTaskCompleteMessage(completedTask);
					} catch (error) {
						logger.error({ task_id: taskId, error: error }, "Error sending task complete message");
					}
				}
			}
			await VerdataUtil.saveRawResponseToDB(response, connection.business_id, task);
		}
		return true;
	}

	public async executeTask(taskId: UUID) {
		const connection = this.getDBConnection();
		if (!connection) {
			return false;
		}
		const response = await this.fetchPublicRecords({}, connection.business_id, taskId);
	}

	/**
	 * @param {VerdataType.WorthInternalOrder} order
	 * @param {} options.isBJLEnabled - if true then send Detailed search
	 */
	private async getPublicRecords(
		order: VerdataType.WorthInternalOrder,
		options = { isBJLEnabled: false }
	): Promise<GetPublicRecordsResponse> {
		try {
			const result: AxiosResponse<VerdataType.SearchResponse | VerdataType.Record, VerdataType.RequestHeaders> =
				options.isBJLEnabled ? await this.sellerDetailedSearch(order) : await this.sellerSearch(order);

			if ("seller_id" in result?.data && result?.data?.seller_id) {
				// Exact match
				logger.debug(`Exact verdata match was found`);
				return result.data as VerdataType.Record;
			} else if (
				"next_best_matches" in result?.data &&
				Array.isArray(result.data.next_best_matches) &&
				result.data.next_best_matches.length > 0
			) {
				// Case 2: Closely matched businesses
				logger.warn(
					{ note: "Closely matched businesses found", best_match: result.data.next_best_matches[0] },
					"Best Verdata match found"
				);
				return {
					request_id: result?.data?.request_id,
					message: "Closely matched businesses found",
					isSellerNotFound: true,
					matches: result.data.next_best_matches.map(match => ({
						business_id: match.merchant.id,
						name: match.merchant.name,
						match_score: match.score
					})),
					bestMatch: result.data.next_best_matches[0]
				};
			}
			// Case 3: No Matching Seller Found: should be an edge case because should otherwise be caught as a 404 exception
			logger.info("No matching seller found");
			return { message: "No Matching Seller Found", isSellerNotFound: true, request_id: result?.data?.request_id };
		} catch (err) {
			if (err instanceof AxiosError && err.response && err.response.status === 404) {
				// if no records found, submit the seller
				try {
					await this.handleSellerNotFound(order as any);
					logger.info(`Seller was not found, submitted to Verdata successfully`);
				} catch (error) {
					logger.error(error);
				}
				return { isSellerNotFound: true };
			}
			logger.error(err);
			throw err;
		}
	}

	private async handleSellerNotFound(
		body: Partial<VerdataType.Seller>
	): Promise<AxiosResponse<void, VerdataType.RequestHeaders>> {
		const sellerBody = {
			business_name: body.name,
			business_address: body.address_line_1,
			business_city: body.city,
			business_state: body.state,
			business_zip5: body.zip5,
			business_phone: "",
			created_by: ""
		};

		return this.submitSeller(sellerBody);
	}

	private async submitSeller(body: Partial<VerdataType.SellerSubmission>) {
		try {
			const payload = {
				...body,
				...(body.business_name &&
					body.business_address &&
					body.business_city &&
					body.business_state &&
					body.business_zip5 && { callback: envConfig.VERDATA_WEBHOOK_URL || Verdata.DEFAULT_CALLBACK_URL })
			};
			return this.post<void>("https://api.myverdata.com/external/api/v1/seller-submission", payload);
		} catch (error) {
			logger.error(error);
			throw error;
		}
	}
	private sleep(ms) {
		// eslint-disable-next-line no-promise-executor-return
		return new Promise(resolve => setTimeout(resolve, ms));
	}

	private async sellerDetailedSearchRequest(
		body: Partial<VerdataType.WorthInternalOrder>
	): Promise<AxiosResponse<VerdataType.SearchResponse, VerdataType.RequestHeaders>> {
		const payload = { ...body } as VerdataType.SellerDetailedSearch;
		// Turn name into legal_entity_name
		if (payload.name) {
			payload.legal_entity_name = body.name;
		}
		if (body.name_dba) {
			payload.name = body.name_dba;
		}
		if (body.name && body.address_line_1 && body.city && body.state && body.zip5) {
			const baseCallbackUrl = envConfig.VERDATA_WEBHOOK_URL || Verdata.DEFAULT_CALLBACK_URL;
			const { url: signedCallbackUrl } = generateSignedCallbackUrl(baseCallbackUrl, {
				business_id: body.business_id as string,
				task_id: body.task_id as string
			});
			payload.callback = signedCallbackUrl;
		}
		logger.info({ payload: payload }, "sellerDetailedSearchRequest payload");
		return this.post<VerdataType.SearchResponse>("https://api.myverdata.com/external/api/v1/seller-detailed", payload);
	}

	private async sellerDetailedSearch(body: VerdataType.WorthInternalOrder) {
		logger.info({ payload: body }, "sellerDetailedSearch payload");
		try {
			const request = await this.sellerDetailedSearchRequest(body);
			if (!request?.data?.request_id) {
				throw new Error("Search not successful, no request_id found");
			}
			const COMPLETE_STATUS = "Request is complete";
			let redirectUrl;
			const attempts = Verdata.MAX_ATTEMPTS;
			if (request.data.status !== COMPLETE_STATUS) {
				let status;
				for (let i = 0; i < attempts; i++) {
					try {
						status = await this.sellerDetailedSearchStatus(request.data.request_id);
					} catch (error) {
						if (error instanceof AxiosError) {
							if (error?.response?.data?.status === COMPLETE_STATUS) {
								redirectUrl = error.response.data.redirect_url;
								break;
							}
						}
						throw error;
					}

					if (status?.data?.status === COMPLETE_STATUS && status.data.redirect_url) {
						redirectUrl = status.data.redirect_url;
						break;
					}
					logger.info(
						{
							status: status.data.status,
							status_data: status.data,
							request_id: request.data.request_id,
							attempt: i + 1,
							attempts: attempts
						},
						"Seller Detail Search Status"
					);
					await this.sleep(Verdata.MS_BETWEEN_ATTEMPTS);
				}

				if (!redirectUrl) {
					logger.warn(`BJL not ready after ${attempts} attempts`);
					logger.info(`Switch from Seller Detailed Search to Seller Search`);
					return this.sellerSearch(body);
				}
			}
			return this.getSellerRequestResult(request.data.request_id, redirectUrl);
		} catch (error) {
			throw error;
		}
	}
	private async sellerDetailedSearchStatus(requestId) {
		return this.get<VerdataType.DetailedSearchStatus>(
			`https://api.myverdata.com/external/api/v1/seller-request-check/${requestId}`
		);
	}

	private async getSellerRequestResult(requestId: string, redirectUrl: string | null) {
		return this.get<VerdataType.Record>(
			redirectUrl || `https://api.myverdata.com/external/api/v1/seller-request-result/${requestId}`
		);
	}

	private async post<T = any>(url, body): Promise<AxiosResponse<T, VerdataType.RequestHeaders>> {
		const config: AxiosRequestConfig<VerdataType.RequestHeaders> = {
			headers: Verdata.HEADERS
		};
		return axios.post(url, body, config);
	}

	private async get<T = any>(url): Promise<AxiosResponse<T, VerdataType.RequestHeaders>> {
		const config: AxiosRequestConfig<VerdataType.RequestHeaders> = {
			headers: Verdata.HEADERS
		};
		return axios.get(url, config);
	}

	private async getCustomerFromTask(taskId: UUID) {
		const query = `select bst.customer_id from integrations.data_business_integrations_tasks dbit
					inner join integrations.business_score_triggers bst  on dbit.business_score_trigger_id = bst.id
					where dbit.id = $1`;

		const sqlResponse = await sqlQuery({ sql: query, values: [taskId] });
		const customerId = sqlResponse.rows?.[0]?.customer_id ?? undefined;
		return customerId;
	}

	private async isBJLEnabled(taskId: UUID): Promise<boolean> {
		const customerId = await this.getCustomerFromTask(taskId);
		let isBJLEnabled = false;
		if (customerId) {
			const customerSettingsResponse = await customerIntegrationSettings.findById(customerId);
			if (customerSettingsResponse) {
				const { settings } = customerSettingsResponse;
				if (settings.bjl?.status == INTEGRATION_ENABLE_STATUS.ACTIVE) {
					return true;
				} else {
					logger.info(`Customer settings Seller Detailed search is not enabled for customer_id: ${customerId}`);
				}
			} else {
				logger.info(`Customer settings not found for customer_id: ${customerId}`);
				isBJLEnabled = await getFlagValue(
					FEATURE_FLAGS.DOS_8_INTEGRATION_WITH_VERDATAS_BJL_DATA_VIA_API_REQUEST_AND_INGEST_DATA,
					null,
					false
				);
				logger.info(
					`Feature flag DOS_8_INTEGRATION_WITH_VERDATAS_BJL_DATA_VIA_API_REQUEST_AND_INGEST_DATA is ${isBJLEnabled ? "enabled" : "disabled"}`
				);
			}
		}
		return isBJLEnabled;
	}
}
