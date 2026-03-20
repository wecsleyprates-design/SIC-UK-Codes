import { fetchTaxFilings, updateTask } from "#common/index";
import {
	ERROR_CODES,
	INTEGRATION_ID,
	TASK_STATUS,
	kafkaEvents,
	kafkaTopics,
	EVENTS,
	TAX_STATUS_ENDPOINTS,
	TaskStatus,
	DLQTOPIC,
	IntegrationPlatformId,
	DEFAULT_CUSTOMER_INTEGRATION_SETTINGS,
	type IntegrationTaskKey
} from "#constants/index";
import {
	getBusinessDetailsForTaxConsent,
	getCases,
	logger,
	sqlQuery,
	sqlTransaction,
	taxApi,
	sqlSequencedTransaction,
} from "#helpers/index";
import { producer } from "#helpers/kafka";
import { validateMessage } from "#middlewares/index";
import { buildInsertQuery, safeJsonParse } from "#utils/index";
import { schema } from "./schema";
import { UUID } from "crypto";
import { StatusCodes } from "http-status-codes";

import { type IBusinessIntegrationTaskEnriched, type SqlQueryResult } from "#types/db";
import { getBusinessEntityVerificationService } from "#api/v1/modules/verification/businessEntityVerification";
import { TaskManager } from "#api/v1/modules/tasks/taskManager";
import { taskQueue, caseSubmittedQueue, businessOnboardingQueue } from "#workers/taskHandler";
import { kafkaToQueue } from "#messaging/index";
import { riskAlerts } from "#api/v1/modules/risk-alerts/risk-alerts";
import { customerIntegrationSettings } from "#api/v1/modules/customer-integration-settings/customer-integration-settings";
import { GIACT } from "#lib/giact/giact";
import { adverseMedia } from "#api/v1/modules/adverse-media/adverse-media";
import { createTaskAndFetchWebsiteData } from "#lib/worthWebsiteScanning/worthWebsiteScanning";
import { allFacts, FactEngineWithDefaultOverrides, FactRules } from "#lib/facts";
import { stateQueue } from "#workers/stateUpdateQueue";
import { executeIntegrationTask } from "#core/taskExecution";

type caseDetailsEntries = {
	rows: {
		score_trigger_id: UUID;
		trigger_type: string;
		[key: string]: any;
	}[];
	[key: string]: any;
};

type taskConfigRow = {
	id: UUID;
	integration_task_id: string;
	platform_id: string;
	platform: string;
	task_status: TaskStatus;
	task: string;
	connection_id: UUID;
};
type taskConfigEntries = {
	rows: taskConfigRow[];
	[key: string]: any;
};

type TaxStatusDataFetchingBody = {
	business_id: UUID;
	task_id: UUID;
};

type FetchBusinessWebsiteDetailsBody = {
	business_id: UUID;
	website: string;
	case_id: UUID;
};

export class BusinessEventsHandler {
	kafkaProducer: any;
	async handleEvent(message) {
		try {
			const payload = JSON.parse(message.value?.toString());
			this.kafkaProducer = producer;
			const event = payload.event || message.key?.toString();
			switch (event) {
			case kafkaEvents.BUSINESS_INVITE_ACCEPTED:
				validateMessage(schema.businessInviteAccepted, payload);
				await kafkaToQueue(businessOnboardingQueue, EVENTS.BUSINESS_INVITE_ACCEPTED, payload);
				break;

				case kafkaEvents.OWNER_UPDATED:
					validateMessage(schema.ownerUpdated, payload);
					await kafkaToQueue(taskQueue, EVENTS.OWNER_UPDATED, payload);
					break;

				case kafkaEvents.UPDATE_CASE_STATUS_ONSUBMIT:
					validateMessage(schema.updateCaseStatusOnSubmit, payload);
					await this.updateCaseStatusOnSubmit(payload);
					break;

				case kafkaEvents.INTEGRATION_DATA_UPLOADED:
					validateMessage(schema.integrationDataUploaded, payload);
					await kafkaToQueue(taskQueue, EVENTS.INTEGRATION_DATA_UPLOADED, payload);
					break;

				case kafkaEvents.INTEGRATION_DATA_READY:
					validateMessage(schema.integrationDataReady, payload);
					await kafkaToQueue(taskQueue, EVENTS.INTEGRATION_DATA_READY, payload);
					break;

				case kafkaEvents.CASE_SUBMITTED_EXECUTE_TASKS:
					validateMessage(schema.executeTasksOnCaseSubmit, payload);
					await kafkaToQueue(caseSubmittedQueue, EVENTS.CASE_SUBMITTED_EXECUTE_TASKS, payload);
					break;

				case kafkaEvents.LINK_SCORE_TRIGGERS:
					validateMessage(schema.linkScoreTriggers, payload);
					await this.linkScoreTriggers(payload);
					break;

				case kafkaEvents.TAX_STATUS_DATA_FETCHING:
					validateMessage(schema.taxStatusDataFetching, payload);
					await this.taxStatusDataFetching(payload);
					break;

				case kafkaEvents.FETCH_BUSINESS_WEBSITE_DETAILS:
					validateMessage(schema.fetchBusinessWebsiteDetails, payload);
					// Middesk
					await this.fetchBusinessWebsiteDetails(payload);

					// Worth
					await kafkaToQueue(taskQueue, EVENTS.FETCH_WORTH_BUSINESS_WEBSITE_DETAILS, payload);
					break;

				case kafkaEvents.FETCH_WORTH_BUSINESS_WEBSITE_DETAILS:
					validateMessage(schema.fetchWorthBusinessWebsiteDetails, payload);
					await kafkaToQueue(taskQueue, EVENTS.FETCH_WORTH_BUSINESS_WEBSITE_DETAILS, payload);
					break;

				case kafkaEvents.PURGE_BUSINESS:
					validateMessage(schema.purgeBusiness, payload);
					await kafkaToQueue(taskQueue, EVENTS.PURGE_BUSINESS, payload);
					break;

				case kafkaEvents.ADD_RISK_ALERT_CONFIG:
					validateMessage(schema.addRiskAlertConfig, payload);
					await this.addRiskAlertConfig(payload);
					break;

				case kafkaEvents.ADD_CUSTOMER_INTEGRATION_SETTINGS:
					validateMessage(schema.addCustomerIntegrationSettings, payload);
					await this.addCustomerIntegrationSettings(payload);
					break;

				case kafkaEvents.FETCH_ADVERSE_MEDIA_REPORT:
					validateMessage(schema.fetchAdverseMediaReport, payload);
					await kafkaToQueue(taskQueue, EVENTS.FETCH_ADVERSE_MEDIA_REPORT, payload);
					break;

				case kafkaEvents.FETCH_GOOGLE_PROFILE:
					validateMessage(schema.fetchGoogleProfile, payload);
					await kafkaToQueue(taskQueue, EVENTS.FETCH_GOOGLE_PROFILE, payload);
					break;

				case kafkaEvents.DELETE_INTEGRATION_DATA:
					validateMessage(schema.deleteIntegrationData, payload);
					await this.deleteIntegrationData(payload);
					break;

				case kafkaEvents.CALCULATE_BUSINESS_FACTS:
					validateMessage(schema.calculateBusinessFacts, payload);
					await this.calculateBusinessFacts(payload);
					break;

				case kafkaEvents.BUSINESS_STATE_UPDATE_EVENT:
					validateMessage(schema.stateUpdate, payload);
					await kafkaToQueue(stateQueue, EVENTS.STATE_UPDATE, payload);
					break;
				default:
					break;
			}
		} catch (error) {
			await this.pushToDLQ(error, message);
		}
	}

	async pushToDLQ(error, message) {
		logger.error(error, `Unhandled exception with BusinessEventsHandler`);
		const parsedValue = message.value ? safeJsonParse(message.value?.toString()) : message.value;
		const DLQpayload = {
			topic: DLQTOPIC,
			messages: [
				{
					key: message.key?.toString(),
					value: {
						event: parsedValue?.event,
						original_event: parsedValue?.event,
						payload: parsedValue,
						kafka_topic: kafkaTopics.BUSINESS,
						error: safeJsonParse(JSON.stringify(error, Object.getOwnPropertyNames(error)))
					}
				}
			]
		};
		logger.error(`PUSHING TO DLQ: ${JSON.stringify(DLQpayload)}`);
		await producer.send(DLQpayload);
	}

	async updateCaseStatusOnSubmit(body) {
		const caseID = body.case_id;
		const scoreTriggerQuery = `SELECT score_trigger_id FROM integrations.business_score_triggers left join public.data_cases on public.data_cases.score_trigger_id=integrations.business_score_triggers.id where integrations.business_score_triggers.trigger_type=$1 and public.data_cases.id=$2`;
		const scoreTriggerData = await sqlQuery({ sql: scoreTriggerQuery, values: ["ONBOARDING_INVITE", caseID] });
		const scoreTriggerId = scoreTriggerData.rows[0]["score_trigger_id"];

		const integrationQuery = `SELECT id FROM integrations.data_business_integrations_tasks WHERE business_score_trigger_id = $1 limit 1`;
		const integrationData = await sqlQuery({ sql: integrationQuery, values: [scoreTriggerId] });

		const integrationTaskID = integrationData.rows[0]["id"];

		let caseQuery = ``;
		if (caseID !== "") {
			caseQuery = ` AND data_cases.id = $2 `;
		}

		const getBusinessIntegrationTasksQuery = `SELECT data_business_integrations_tasks.task_status, data_business_integrations_tasks.business_score_trigger_id, data_business_integrations_tasks.integration_task_id, core_tasks.id as core_task_id, data_cases.* FROM integrations.data_business_integrations_tasks
		LEFT JOIN data_cases ON data_cases.score_trigger_id = data_business_integrations_tasks.business_score_trigger_id
		LEFT JOIN integrations.rel_tasks_integrations ON integrations.rel_tasks_integrations.id = integrations.data_business_integrations_tasks.integration_task_id
		LEFT JOIN integrations.core_tasks ON integrations.core_tasks.id = integrations.rel_tasks_integrations.task_category_id
		WHERE business_score_trigger_id = (SELECT business_score_trigger_id FROM integrations.data_business_integrations_tasks WHERE id = $1) ${caseQuery}`;

		const getBusinessIntegrationTasksQueryValues = caseID === "" ? [integrationTaskID] : [integrationTaskID, caseID];

		const businessIntegrationTasksResult = await sqlQuery({
			sql: getBusinessIntegrationTasksQuery,
			values: getBusinessIntegrationTasksQueryValues
		});

		if (!businessIntegrationTasksResult.rowCount) {
			logger.warn(
				`No score trigger task found for taskId=${integrationTaskID} [${StatusCodes.NOT_FOUND}] [${ERROR_CODES.NOT_FOUND}]`
			);
			return;
		}

		const allowedCategories = [1, 2, 3, 4, 5];
		const allowedCategoriesValues = [true];
		for (let i = 1; i <= allowedCategories.length; i++) {
			allowedCategoriesValues[i] = false;
		}
		let isAllSucceeded = true;
		businessIntegrationTasksResult.rows.forEach(row => {
			if (!allowedCategories.includes(row["core_task_id"])) {
				return;
			}
			if (!allowedCategoriesValues[row["core_task_id"]] && row["task_status"] === TASK_STATUS.SUCCESS) {
				allowedCategoriesValues[row["core_task_id"]] = true;
			}
		});

		allowedCategories.forEach(val => {
			if (!allowedCategoriesValues[val]) {
				isAllSucceeded = false;
			}
		});

		const result = businessIntegrationTasksResult.rows[0];
		const message = {
			case_id: result["id"]
		};
		// send Kafka event to case service to update case status
		if (!isAllSucceeded) {
			await this.kafkaProducer.send({
				topic: kafkaTopics.BUSINESS,
				messages: [
					{
						key: result["business_id"],
						value: {
							event: kafkaEvents.UPDATE_CASE_STATUS_ON_RESPONSE,
							...message
						}
					}
				]
			});
		}
	}

	/**
	 * Constructs a unique key for a type of integration task.
	 * By default, the key is formatted as `task_code::platform_code::reference_id`, but this can be overridden for specific
	 * taskCode and platform combinations using the OVERRIDE object.
	 * To override the default key construction, add a new implementation to the OVERRIDE object.
	 *
	 * @private
	 * @param {IBusinessIntegrationTaskEnriched} task - The integration task for which to construct the key.
	 * @returns {string} A unique key representing the task.
	 */
	private getTaskKey(task: IBusinessIntegrationTaskEnriched): string {
		type GetKeyFn = (task: IBusinessIntegrationTaskEnriched) => string;

		const defaultFn: GetKeyFn = (task: IBusinessIntegrationTaskEnriched) =>
			`${task.task_code}::${task.platform_code}::${task.reference_id ?? ""}`;
		const justTaskAndPlatformFn: GetKeyFn = (task: IBusinessIntegrationTaskEnriched) =>
			`${task.task_code}::${task.platform_code}`;

		// Map of taskCode -> platformId -> fn
		type Override = Partial<Record<IntegrationTaskKey, Partial<Record<IntegrationPlatformId, GetKeyFn>>>>;
		const OVERRIDE: Override = {
			// For equifax credit scores: We only want one total task to bring this into scope for execution -- the task handler will determine the actual tasks to execute
			fetch_bureau_score_owners: { [INTEGRATION_ID.EQUIFAX]: justTaskAndPlatformFn }
		};

		const fn = OVERRIDE[task.task_code]?.[task.platform_id] ?? defaultFn;
		return fn(task);
	}

	/**
	 * When given a new task and an existing task, return the "best task" to use to send to the execution queue
	 * Rules:
	 * 1: Prefer a task in a pending state
	 * 2: Prefer a task that was updated more recently
	 * 3: If none of these were met then just return the original task
	 * @param originalTask: IBusinessIntegrationTaskEnriched
	 * @param newTask: IBusinessIntegrationTaskEnriched
	 * @returns IBusinessIntegrationTaskEnriched of the "best task" for the job
	 */
	private getBestTask(
		originalTask: IBusinessIntegrationTaskEnriched,
		newTask: IBusinessIntegrationTaskEnriched
	): IBusinessIntegrationTaskEnriched {
		// 1: Prefer a task in a pending state
		if (
			TaskManager.PENDING_TASK_STATUSES.includes(newTask.task_status) &&
			!TaskManager.PENDING_TASK_STATUSES.includes(originalTask.task_status)
		) {
			return newTask;
		} else if (
			TaskManager.PENDING_TASK_STATUSES.includes(originalTask.task_status) &&
			!TaskManager.PENDING_TASK_STATUSES.includes(newTask.task_status)
		) {
			return originalTask;
		}
		// 2: Prefer a task that was updated more recently
		if (newTask.updated_at > originalTask.updated_at) {
			return newTask;
		}
		// 3: If none of these were met then just return the original task
		return originalTask;
	}

	/**
	 * Get deduplicated tasks for a case to be attempted for execution
	 * End goal here is to make sure we're somehow only pushing a unique set of tasks per implementation into the pipe
	 * @param caseID
	 * @returns
	 */
	protected async getTasksForCase<T = any>(caseID: UUID): Promise<IBusinessIntegrationTaskEnriched<T>[]> {
		const tasks = await TaskManager.findEnrichedTasks([{ column: "case_id", value: caseID, operator: "=" }]);
		// Deduplicate tasks based on taskCode+platformId specific rules handled inside the getTaskKeyFunction  -- then set the task to execute to the 'best task'
		const deduplicatedTasks = tasks.reduce(
			(acc, task) => {
				const key = this.getTaskKey(task);
				acc[key] = this.getBestTask(acc[key] ?? task, task);
				return acc;
			},
			{} as Record<string, IBusinessIntegrationTaskEnriched<any>>
		);
		return Object.values(deduplicatedTasks);
	}

	async executeTasksOnCaseSubmit(body: { case_id: UUID; business_id: UUID }) {
		const uniqueTasks = await this.getTasksForCase(body.case_id);
		if (!uniqueTasks?.length) {
			throw new Error("No integration tasks found");
		}

		// fetch all tasks & process them asynchronously
		const taskPromises = uniqueTasks.map(task =>
			executeIntegrationTask(task).catch(ex => {
				logger.error(
					{
						ex
					},
					`businessId=${body.business_id}; case_id=${body.case_id} Error in executing integration task ${task.id} :: Error: ${(ex as Error).message}`
				);
			})
		);
		await Promise.allSettled(taskPromises);
	}

	async linkScoreTriggers({ customer_case_ids, standalone_case_id, business_id }) {
		// Get any single task through which we can trigger checkScoreTriggerTasksStatus function and that would trigger score generation event
		// fetching SUCCESS or FAILED tasks only for the platforms for which the score can calculate
		const getTaskQuery = `SELECT dbit.* FROM integrations.data_business_integrations_tasks dbit
			LEFT JOIN public.data_cases ON public.data_cases.score_trigger_id = dbit.business_score_trigger_id
			JOIN integrations.rel_tasks_integrations ON integrations.rel_tasks_integrations.id = dbit.integration_task_id
			JOIN integrations.core_tasks ON integrations.core_tasks.id = integrations.rel_tasks_integrations.task_category_id
			LEFT JOIN data_cases c ON c.score_trigger_id = dbit.business_score_trigger_id
			LEFT JOIN integrations.business_score_triggers bst ON bst.id = dbit.business_score_trigger_id
			WHERE
				dbit.task_status in ('SUCCESS','FAILED')
				AND core_tasks.id between '1' and '7'
				and public.data_cases.id = $1`;

		const {
			rows: [taskDetails]
		}: { rows: any[] } = await sqlQuery({ sql: getTaskQuery, values: [standalone_case_id] });

		if (!taskDetails) {
			throw new Error("No integration tasks found");
		}

		const table = "public.data_cases";
		const columns = ["id", "business_id", "score_trigger_id", "created_at"];
		const now = new Date().toISOString();
		const rows = customer_case_ids.map((caseID: string) => {
			return [caseID, business_id, taskDetails.business_score_trigger_id, now];
		});

		const insertCaseQuery = buildInsertQuery(table, columns, rows);
		await sqlQuery({ sql: insertCaseQuery, values: rows.flat() });

		const message = {
			customer_case_ids,
			standalone_case_id,
			score_trigger_id: taskDetails.business_score_trigger_id,
			business_id
		};

		const payload = {
			topic: kafkaTopics.SCORES,
			messages: [
				{
					key: business_id,
					value: {
						event: kafkaEvents.LINK_TRIGGERS_AND_EMIT_SCORE,
						...message
					}
				}
			]
		};

		await producer.send(payload);
	}

	// This is function is to fetch taxation data for other cases of given business for which cases are not in onboarding stage
	// and whose task status is also not succeed
	async taxStatusDataFetching(body: TaxStatusDataFetchingBody) {
		try {
			const getAllBusinessCasesQuery = `SELECT data_cases.id as case_id, integrations.data_business_integrations_tasks.id as task_id, task_status
				FROM data_cases
				LEFT JOIN integrations.data_business_integrations_tasks ON data_cases.score_trigger_id = integrations.data_business_integrations_tasks.business_score_trigger_id
				WHERE business_id = $1
				AND integrations.data_business_integrations_tasks.integration_task_id = (SELECT id FROM integrations.rel_tasks_integrations WHERE task_category_id =(SELECT id FROM integrations.core_tasks WHERE code = $2))`;

			const getAllBusinessCasesResult: SqlQueryResult = await sqlQuery({
				sql: getAllBusinessCasesQuery,
				values: [body.business_id, "fetch_tax_filings"]
			});

			const caseIDs = {};
			getAllBusinessCasesResult.rows.map(row => {
				caseIDs[row.case_id] = {
					task_id: row.task_id,
					task_status: row.task_status
				};
			});

			const caseResult: any[] = await getCases({
				pagination: false,
				filter: {
					"data_cases.id": Object.keys(caseIDs),
					"data_cases.case_type": ["1", "2"]
				}
			});
			logger.info(`caseResult: ${caseResult.length}`);

			const { data } = await getBusinessDetailsForTaxConsent(body.business_id);
			if (!data.tin || !data.title) {
				logger.error(`Business details not found: ${JSON.stringify(data)}`);
				throw new Error("Business details not found");
			}

			for await (const result of caseResult) {
				const taskID = caseIDs[result.id].task_id;
				if (["ONBOARDING", "UNDER_MANUAL_REVIEW"].includes(result.status.code)) {
					logger.error(`Case status is not submitted case id: ${result.id}, status: ${JSON.stringify(result.status)}`);
					continue;
				}

				if (caseIDs[result.id].task_status === TASK_STATUS.SUCCESS) {
					logger.error(`Task is already succeed: task-id: ${taskID}`);
					continue;
				}

				let endpoint, taxApiPayload;

				// if the owner is Sole Proprietor, then we have to use the individual endpoint of TaxStatus otherwise business endpoint
				if (data.title === "Sole Proprietor") {
					endpoint = TAX_STATUS_ENDPOINTS.INDIVIDUAL;
					taxApiPayload = {
						ssn: data.tin
					};
				} else {
					endpoint = TAX_STATUS_ENDPOINTS.BUSINESS;
					taxApiPayload = {
						ein: data.tin
					};
				}

				let taxFilings;
				try {
					taxFilings = await taxApi.send(taxApiPayload, endpoint);
				} catch (err: any) {
					logger.error(`Tax api error: ${err.message}`);
					taxFilings = {};
				}

				const { rows } = await fetchTaxFilings(taxFilings, body.business_id, data, taskID);

				const table = "integration_data.tax_filings";
				const columns = [
					"business_integration_task_id",
					"business_type",
					"period",
					"form",
					"form_type",
					"filing_status",
					"adjusted_gross_income",
					"total_income",
					"total_sales",
					"total_compensation",
					"total_wages",
					"irs_balance",
					"lien_balance",
					"naics",
					"naics_title",
					"interest",
					"interest_date",
					"penalty",
					"penalty_date",
					"filed_date",
					"balance",
					"tax_period_ending_date",
					"amount_filed",
					"cost_of_goods_sold",
					"version"
				];

				if (rows.length) {
					const insertTaxFilingQuery = buildInsertQuery(table, columns, rows);
					await sqlQuery({ sql: insertTaxFilingQuery, values: rows.flat() });
				}
				await updateTask(taskID, TASK_STATUS.SUCCESS);
			}
		} catch (error) {
			throw error;
		}
	}

	// Fetch business entity website details using Middesk
	async fetchBusinessWebsiteDetails(body: FetchBusinessWebsiteDetailsBody) {
		try {
			const service = await getBusinessEntityVerificationService(body.business_id);
			// update website details
			await service.updateBusinessEntityDetails({ businessID: body.business_id }, { website: { url: body.website } });
			await service.createTaskAndFetchMiddeskWebsiteData(body);
		} catch (error) {
			throw error;
		}
	}

	// Fetch business entity website details using Worth
	async fetchWorthBusinessWebsiteDetails(body: FetchBusinessWebsiteDetailsBody) {
		try {
			await createTaskAndFetchWebsiteData(body.business_id, body.website, body.case_id);
		} catch (error) {
			throw error;
		}
	}

	async purgeBusiness(payload) {
		logger.info(`Purging business with id ${payload.business_id}`);

		const deleteBusinessScoreTriggersQuery = `DELETE FROM integrations.business_score_triggers WHERE business_id = $1`;
		const deleteConnectionsQuery = `DELETE FROM integrations.data_connections WHERE business_id = $1`;
		await sqlSequencedTransaction(
			[deleteBusinessScoreTriggersQuery, deleteConnectionsQuery],
			[[payload.business_id], [payload.business_id]]
		);

		logger.info(`Business with id ${payload.business_id} purged successfully`);
	}

	async addRiskAlertConfig(payload) {
		try {
			if (payload.parent_customer_data?.parent_id) {
				// Copy risk alert configurations from parent customer to child customer
				await riskAlerts.copyRiskAlertConfigFromParent(
					payload.parent_customer_data.parent_id,
					payload.customer_id,
					payload.user
				);
				logger.info(
					`Risk alerts configurations copied from parent customer ${payload.parent_customer_data.parent_id} to child customer ${payload.customer_id}`
				);
			} else {
				await riskAlerts.addUpdateRiskAlertConfig(payload, payload.user);
			}

			logger.info(`Risk alerts configurations for customer ${payload.customer_id} have been saved successfully`);
		} catch (error) {
			throw error;
		}
	}

	async addCustomerIntegrationSettings(payload) {
		try {
			if (payload.parent_customer_data?.parent_id) {
				// Copy integration settings from parent customer to child customer
				await customerIntegrationSettings.copyCustomerIntegrationSettingsFromParent(
					payload.parent_customer_data.parent_id,
					payload.customerID,
					payload.customer_type
				);
				logger.info(
					`Integration settings copied from parent customer ${payload.parent_customer_data.parent_id} to child customer ${payload.customerID}`
				);

				// Copy integration status from parent customer to child customer
				await customerIntegrationSettings.copyCustomerIntegrationStatusFromParent(
					payload.parent_customer_data.parent_id,
					payload.customerID
				);
				logger.info(
					`Integration status copied from parent customer ${payload.parent_customer_data.parent_id} to child customer ${payload.customerID}`
				);
			} else {
				const { customerID, settings } = payload;

				const defaultSettings = Object.fromEntries(
					Object.entries(DEFAULT_CUSTOMER_INTEGRATION_SETTINGS).map(([key, val]) => [
						key,
						{ status: val.status, mode: val.mode }
					])
				);

				// Merge incoming overrides (status/mode) onto the default settings
				const incoming = settings || {};
				const merged = { ...defaultSettings };
				Object.keys(incoming).forEach(key => {
					if (!incoming[key]) return;
					merged[key] = {
						...(merged[key] || {}),
						...(incoming[key].status ? { status: incoming[key].status } : {}),
						...(incoming[key].mode ? { mode: incoming[key].mode } : {})
					};
				});

				await customerIntegrationSettings.createOrUpdate(customerID, merged);

				logger.info(`Integration settings for customer ${customerID} have been saved successfully`);
			}
		} catch (error) {
			throw error;
		}
	}

	// Delete existing integration data. Currently, only adverse media data is being removed as per the scope of PAT-515
	async deleteIntegrationData(body: { customer_id: UUID; business_id: UUID; case_id: UUID }) {
		const integrationsToDeleteData: IntegrationPlatformId[] = [
			INTEGRATION_ID.ADVERSE_MEDIA,
			INTEGRATION_ID.GIACT,
			INTEGRATION_ID.VERDATA
		];

		const getAllTasksQuery = `SELECT dbit.*, integrations.rel_tasks_integrations.platform_id, core_tasks.code AS task  FROM integrations.data_business_integrations_tasks dbit
				JOIN integrations.data_connections dc ON dc.id = dbit.connection_id
				join integrations.business_score_triggers bst on bst.id = dbit.business_score_trigger_id 
				JOIN public.data_cases ON public.data_cases.score_trigger_id = bst.id 
				JOIN integrations.rel_tasks_integrations ON integrations.rel_tasks_integrations.id = dbit.integration_task_id
				JOIN integrations.core_tasks ON core_tasks.id = rel_tasks_integrations.task_category_id
				JOIN integrations.core_integrations_platforms ON core_integrations_platforms.id = rel_tasks_integrations.platform_id
				WHERE public.data_cases.id = $1 and dc.platform_id IN (${integrationsToDeleteData.map(id => `'${id}'`).join(",")})`;

		const getCaseDetailsQuery = `SELECT public.data_cases.*,  integrations.business_score_triggers.trigger_type FROM public.data_cases
				LEFT JOIN integrations.business_score_triggers ON integrations.business_score_triggers.id = public.data_cases.score_trigger_id
				WHERE public.data_cases.id = $1 `;

		const [tasksResult, caseDetails] = (await sqlTransaction(
			[getAllTasksQuery, getCaseDetailsQuery],
			[[body.case_id], [body.case_id]]
		)) as [taskConfigEntries, caseDetailsEntries];

		if (!tasksResult.rows.length) {
			throw new Error("No integration tasks found");
		}

		if (!caseDetails.rows.length) {
			throw new Error("Case not found");
		}

		for (const task of tasksResult.rows) {
			try {
				switch (task.task) {
					case "fetch_adverse_media":
						// If the task is fetch_adverse_media, then we need to delete the adverse media task
						await adverseMedia.deleteAdverseMedia(task.id);
						await updateTask(task.id, TASK_STATUS.CREATED);
						logger.info(`Task updated for adverse media match: ${task.id}`);
						break;

					case "fetch_giact_verification":
						// If the task is fetch_giact_verification, then we need to delete the additional account data
						await GIACT.deleteAdditionalAccountsGiactVerificationData(body.case_id);
						await updateTask(task.id, TASK_STATUS.CREATED);
						logger.info(`Task updated for GIACT verification match: ${task.id}`);
						break;

					case "fetch_public_records":
						// just update the task status to CREATED
						await updateTask(task.id, TASK_STATUS.CREATED);
						logger.info(`Task updated for public records match: ${task.id}`);
						break;

					default:
						logger.debug(`Task ${task.task} is not supported for deletion`);
				}
			} catch (error: any) {
				logger.error(
					`Error deleting integrations data for business ${body.business_id}, case ${body.case_id}: ${error.message}`
				);
			}
		}
	}
	async calculateBusinessFacts(payload: {
		business_id: UUID;
		case_id?: UUID;
		customer_id?: UUID;
		previous_status?: string;
	}) {
		// Force Recalculation of business facts
		const { business_id, case_id, customer_id, previous_status } = payload;
		const facts = new FactEngineWithDefaultOverrides(allFacts, { business: business_id });
		await facts.applyRules(FactRules.factWithHighestConfidence);
		await facts.getResults([
			"source.confidence",
			"source.platformId",
			"source.name",
			"ruleApplied.name",
			"ruleApplied.description",
			"fact.confidence",
			"source.weight",
			"fact.weight"
		]);

		if (case_id) {
			await producer.send({
				topic: kafkaTopics.NOTIFICATIONS,
				messages: [
					{
						key: kafkaEvents.APPLICATION_EDIT_FACTS_READY,
						value: {
							event: kafkaEvents.APPLICATION_EDIT_FACTS_READY,
							business_id,
							case_id,
							customer_id,
							previous_status
						}
					}
				]
			});
			logger.info(
				`Emitted APPLICATION_EDIT_FACTS_READY event for case: ${case_id}, previous_status: ${previous_status}`
			);
		}
	}
}

export const businessEventsHandler = new BusinessEventsHandler();
