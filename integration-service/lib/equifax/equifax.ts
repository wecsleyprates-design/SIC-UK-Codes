import BureauBase from "#api/v1/modules/bureau/bureauBase";
import { BureauApiError } from "#api/v1/modules/bureau/error";
import { TaskManager } from "#api/v1/modules/tasks/taskManager";
import { getBusinessEntityVerificationService } from "#api/v1/modules/verification/businessEntityVerification";
import { envConfig } from "#configs";
import { ErrorCodeMapping, EquifaxErrorData, TransformedEquifaxError } from "./types";
import {
	CONNECTION_STATUS,
	DIRECTORIES,
	ERROR_CODES,
	INTEGRATION_ID,
	TASK_STATUS,
	TaskCode,
	kafkaEvents,
	kafkaTopics,
	type TaskStatus
} from "#constants";
import {
	getOwners,
	producer,
	logger,
	redis,
	executeAndUnwrapRedshiftQuery,
	serializeBigInt,
	getCustomerBasicDetails
} from "#helpers/index";
import { db } from "#helpers/knex";
import { getConnectionByTaskId, platformFactory } from "#helpers/platformHelper";
import { IBusinessIntegrationTaskEnriched } from "#types";
import {
	IBureauCreditScore,
	IDBConnection,
	IDBConnectionEgg,
	IRequestResponse,
	type IBusinessIntegrationTask,
	type IBusinessIntegrationTaskEvent
} from "#types/db";
import { Owner } from "#types/worthApi";
import { decryptData, encryptData } from "#utils/encryption";
import { deleteKeysFromObject } from "#utils/pick";
import { putFile } from "#utils/s3";
import axios, { AxiosError, AxiosRequestConfig, AxiosResponse } from "axios";
import { UUID } from "crypto";
import dayjs from "dayjs";
import { StatusCodes } from "http-status-codes";
import { getBasePayload } from "./baseRequestPayload";
import {
	EquifaxBureauCreditScore,
	EquifaxFetchOwnerScoreTask,
	ICreditReportRequest,
	ICreditReportResponse,
	IOAuthResponse,
	type EquifaxEntityMatchTask,
	type IEquifaxAIScoreModel,
	type IEquifaxJudgementsLiens,
	type IEquifaxJudgementsLiensReport
} from "./types";
import { EntityMatching } from "#lib/entityMatching/entityMatching";
import { VerificationApiError } from "#api/v1/modules/verification/error";
import { uploadRawIntegrationDataToS3 } from "#common/index";
import { Athena } from "#helpers/athena";

import type { EquifaxUSRaw } from "./redshiftTypes";
import type { TDateISO } from "#types/datetime";
import type { EntityMatchTask } from "#lib/entityMatching/types";
import type { EquifaxFirmographicsEvent } from "@joinworth/types/dist/types/kafka/entity_matching.v1/FirmographicsEvent";
import { IntegrationMode } from "#api/v1/modules/customer-integration-settings/types";
import { strategyPlatformFactory } from "#helpers/strategyPlatformFactory";
import { fetchReportWithRetry } from "./util";

type StrategyConfig = {
	baseUrl: string;
	clientId: string;
	secret: string;
	memberNumber: string;
	securityCode: string;
	accessTokenKey: string;
	mode?: IntegrationMode;
};

export class Equifax extends BureauBase {
	private static readonly PLATFORM_ID = INTEGRATION_ID["EQUIFAX"];
	private readonly ACCESS_TOKEN_KEY: string;
	private static readonly MINIMUM_PREDICTION_SCORE = 0.81;
	private static readonly MATCH_SCORE_MULTIPLIER = 55;
	private readonly ENCRYPTED_PROPERTIES = { owners: ["ssn", "date_of_birth"], report_response: ["subjectSocialNum"] };
	private readonly strategyConfig: StrategyConfig;

	constructor(dbConnection?: IDBConnection, strategyConfig?: StrategyConfig) {
		super(dbConnection);

		this.strategyConfig = strategyConfig || {
			baseUrl: envConfig.EQUIFAX_BASE_URL!,
			clientId: envConfig.EQUIFAX_CLIENT_ID!,
			secret: envConfig.EQUIFAX_CLIENT_SECRET!,
			memberNumber: envConfig.EQUIFAX_MEMBER_NUMBER!,
			securityCode: envConfig.EQUIFAX_SECURITY_CODE!,
			accessTokenKey: "equifax.access_token.production"
		};

		this.ACCESS_TOKEN_KEY = this.strategyConfig.accessTokenKey;
	}

	taskHandlerMap: Partial<Record<TaskCode, (() => Promise<boolean>) | ((taskId: UUID) => Promise<boolean>)>> = {
		fetch_bureau_score_owners: async taskId => this.fetchBureauScoreOwners(taskId).then(response => !!response),
		fetch_public_records: async taskId => {
			const task = await Equifax.getEnrichedTask<EquifaxEntityMatchTask | IEquifaxJudgementsLiens>(taskId);
			const isEntityMatchingEnabled = await EntityMatching.isEnabled(Equifax.PLATFORM_ID);

			if (!EntityMatching.isEntityMatchingTask(task) || !isEntityMatchingEnabled) {
				// TODO: Check with the product team if we should run heuristic match at all.
				return await this.runHeuristicMatch({ taskId }).then(response => !!response);
			}

			return await this.processEntityMatching(task as IBusinessIntegrationTaskEnriched<EquifaxEntityMatchTask>);
		}
	};

	/**
	 * Injects the customer's business name into the request payload
	 * @param requestPayload
	 * @param customerID
	 * @returns updated request payload with the customer name updated
	 */
	private async injectCustomerNameIntoRequestPayload(
		requestPayload: Partial<ICreditReportRequest> & Required<Pick<ICreditReportRequest, "customerConfiguration">>,
		customerID: UUID
	): Promise<ICreditReportRequest> {
		try {
			const customerBasicDetails = await getCustomerBasicDetails(customerID);
			const { name } = customerBasicDetails;
			if (name && name.length > 2) {
				const nameTruncated = name.substring(0, 20);
				requestPayload.customerConfiguration.equifaxUSConsumerCreditReport.endUserInformation.endUsersName =
					nameTruncated;
			}
		} catch (error: unknown) {
			// Keep at Worth AI if we cannot resolve
			if (error instanceof Error && error.name === "InternalApiError") {
				// Swallow this error, it's fine - we're just going to keep it as "Worth AI"
				logger.warn(
					{ customerID, error },
					"Failed to get customer basic details - requesting credit report on behalf of default Worth AI name"
				);
			} else {
				throw error;
			}
		}
		return requestPayload as ICreditReportRequest;
	}

	private async generateGetScorePayload(
		encryptedOwner: Owner,
		task: EquifaxFetchOwnerScoreTask
	): Promise<ICreditReportRequest> {
		const connection = this.getDBConnection();

		if (!connection) {
			throw new BureauApiError("Connection not initialized");
		}

		const ownerInfo = this.decrypt("owners", encryptedOwner);

		// Create a deep copy of the request payload to avoid mutating the original object
		const requestPayload = getBasePayload();
		requestPayload.consumers = {
			name: [{ identifier: "current", firstName: ownerInfo.first_name || "", lastName: ownerInfo.last_name || "" }]
		};

		const normalizedSsn = this.getNormalizedFullSsn(ownerInfo);
		if (normalizedSsn) {
			requestPayload.consumers.socialNum = [{ identifier: "current", number: normalizedSsn }];
		}
		requestPayload.consumers.addresses = [
			{
				identifier: "current",
				streetName: ownerInfo.address_line_1 || "",
				city: ownerInfo.address_city || "",
				state: ownerInfo.address_state || "",
				zip: ownerInfo.address_postal_code || ""
			}
		];
		requestPayload.customerReferenceidentifier = `${connection.business_id}-${ownerInfo.id}`;

		if (!this.strategyConfig.memberNumber || !this.strategyConfig.securityCode) {
			throw new BureauApiError("Member number and security code are required");
		}
		requestPayload.customerConfiguration.equifaxUSConsumerCreditReport.memberNumber = this.strategyConfig.memberNumber;
		requestPayload.customerConfiguration.equifaxUSConsumerCreditReport.securityCode = this.strategyConfig.securityCode;
		// Inject the customer name into the request payload
		if (
			task.customer_id &&
			requestPayload.customerConfiguration?.equifaxUSConsumerCreditReport?.endUserInformation?.endUsersName
		) {
			return (await this.injectCustomerNameIntoRequestPayload(
				requestPayload,
				task.customer_id
			)) as ICreditReportRequest;
		}

		return requestPayload as ICreditReportRequest;
	}

	protected archiveRequest(...args: any[]) {}
	callbackHandler(...args: any[]) {}
	async initialUpdate() {
		await this.ensureTasksExist();
		await this.processPendingTasks();
	}

	/**
	 * Returns normalized 9-digit SSN for Equifax.
	 */
	private getNormalizedFullSsn(ownerInfo: {
		ssn?: string | null;
		last_four_of_ssn?: string | number | null;
	}): string | null {
		const digits = (ownerInfo.ssn != null ? String(ownerInfo.ssn) : "").replace(/\D/g, "");
		const last4 =
			ownerInfo.last_four_of_ssn != null
				? String(ownerInfo.last_four_of_ssn).replace(/\D/g, "").padStart(4, "0").slice(-4)
				: null;
		const four = last4 && last4.length === 4 ? last4 : digits.length === 4 ? digits : null;

		if (digits.length === 9) {
			return four && digits.slice(-4) !== four ? null : digits;
		}
		return four ? "00000" + four : null;
	}

	private async getOwners(): Promise<Owner[]> {
		const connection = this.getDBConnection();

		if (!connection) {
			throw new BureauApiError("No connection defined");
		}
		const { business_id } = connection;
		return getOwners(business_id);
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
	private encryptNestedProperty(input: any, targetKey: string): any {
		const obj = { ...input };
		for (const key in obj) {
			if (obj.hasOwnProperty(key)) {
				if (key === targetKey) {
					logger.debug(`Encrypting ${key} from ${obj[key]}`);
					obj[key] = encryptData(obj[key]);
				} else if (typeof obj[key] === "object" && obj[key] !== null) {
					this.encryptNestedProperty(obj[key], targetKey);
				}
			}
		}
		return obj;
	}

	private async getBearerToken(): Promise<string> {
		try {
			const token = (await redis.get(this.ACCESS_TOKEN_KEY)) as unknown as string;
			if (token) {
				return token;
			}
			const { baseUrl, clientId, secret } = this.strategyConfig;
			const path = `${baseUrl}/v2/oauth/token`;

			const formData = new URLSearchParams();
			formData.append("grant_type", "client_credentials");
			formData.append("scope", "https://api.equifax.com/business/oneview/consumer-credit/v1");

			const response = await this.post<IOAuthResponse>(path, formData, {
				headers: { "Content-Type": "application/x-www-form-urlencoded" },
				auth: { username: clientId, password: secret }
			});
			if (response && response.data) {
				redis.setex(this.ACCESS_TOKEN_KEY, response.data.access_token, response.data.expires_in - 5);
				return response.data.access_token;
			}
		} catch (ex) {
			logger.error(ex, "getBearerToken");
			throw ex;
		}
		throw new BureauApiError("couldn't get access token");
	}

	/* Override to ensure we create a 1:1 task for Owner in each business */
	public async ensureTasksExist(forceCreation = false): Promise<UUID[]> {
		const connection = this.getDBConnection();
		if (connection) {
			const requiredTasks = await db("integrations.rel_tasks_integrations")
				.select("rel_tasks_integrations.id", "core_tasks.code")
				.join("integrations.core_tasks", "core_tasks.id", "rel_tasks_integrations.task_category_id")
				.where("rel_tasks_integrations.platform_id", connection.platform_id);
			let metadata = {};
			if (forceCreation) {
				metadata = { forceCreation: true };
			}
			const tasks = await Promise.all(
				requiredTasks.flatMap(async requiredTask => {
					const taskCode: TaskCode = requiredTask.code;
					try {
						if (taskCode == "fetch_bureau_score_owners") {
							return await this.createFetchBureauScoreOwnersTasks();
						} else {
							if (forceCreation) {
								return [await this.createTaskForCode({ taskCode: taskCode, metadata })];
							}
							return [await this.getOrCreateTaskForCode({ taskCode: taskCode, metadata })];
						}
					} catch (ex) {
						logger.error({ error: ex }, `Could not create task for ${taskCode}`);
					}
				})
			);
			logger.debug("Task Ids created");
			logger.debug(tasks.flat());
			return tasks.flat().filter(taskId => Boolean(taskId)) as UUID[];
		}
		throw new BureauApiError("Could not ensure tasks exist!");
	}

	public async createFetchBureauScoreOwnersTasks(scoreTriggerId?: UUID): Promise<UUID[]> {
		const owners = await this.getOwners();
		const tasksToExecute = new Set<UUID>();
		if (!owners?.length) {
			return [];
		}

		// For a scoreTriggerId attempt an idempotent approach
		if (scoreTriggerId) {
			const existingTasks = await TaskManager.findEnrichedTasks([
				{ column: "business_score_trigger_id", value: scoreTriggerId, operator: "=" },
				{ column: "task_code", value: "fetch_bureau_score_owners", operator: "=" },
				{ column: "platform_id", value: Equifax.PLATFORM_ID, operator: "=" },
				{ column: "reference_id", isNull: false }
			]);

			// Reduce all the existing tasks to a map of those that have a reference_id
			const ownerToTaskMap: Map<UUID, IBusinessIntegrationTaskEnriched[]> = existingTasks.reduce((acc, record) => {
				if (record.reference_id) {
					acc.set(record.reference_id as UUID, [...(acc.get(record.reference_id as UUID) || []), record]);
				}
				return acc;
			}, new Map<UUID, IBusinessIntegrationTaskEnriched[]>());

			// Find owners that are not in the map
			const ownersToCreate = owners.filter(owner => !ownerToTaskMap.has(owner.id));
			// Spawn tasks for owners that do not exist at all in the map
			for (const owner of ownersToCreate) {
				const task = await this.getOrCreateFetchBureauScoreOwnersTask(owner, scoreTriggerId);
				tasksToExecute.add(task);
			}

			// Find owners that are in the map but not in a success state
			const ownersToUpdate: Owner[] = owners.filter(
				owner =>
					ownerToTaskMap.has(owner.id) &&
					ownerToTaskMap.get(owner.id)?.some(task => !Equifax.TERMINAL_TASK_STATUSES.includes(task.task_status))
			);
			// Update tasks that are not success
			for (const owner of ownersToUpdate) {
				const taskId = ownerToTaskMap.get(owner.id)?.[0].id;
				if (taskId) {
					await Promise.all([
						this.updateTask(taskId, { reference_id: owner.id, metadata: { owner } }),
						this.updateTaskStatus(taskId, TASK_STATUS.CREATED, { message: "Re-initializing task for another attempt" })
					]);
					tasksToExecute.add(taskId);
				}
			}
			return Array.from(tasksToExecute);
		}
		// If no scoreTriggerId, create a task for each owner without trying too hard to be idempotent
		for (const owner of owners) {
			const taskId = await this.getOrCreateFetchBureauScoreOwnersTask(owner);
			tasksToExecute.add(taskId);
		}
		return Array.from(tasksToExecute);
	}

	/**
	 * Return a task for the given owner and scoreTriggerId
	 * Will either create or return a pending task for the given owner and scoreTriggerId
	 * @param owner
	 * @param scoreTriggerId
	 * @returns
	 */
	public async getOrCreateFetchBureauScoreOwnersTask(owner: Owner, scoreTriggerId?: UUID): Promise<UUID> {
		//  Reuse already created tasks before creating new ones
		return await this.getOrCreateTaskForCode({
			taskCode: "fetch_bureau_score_owners",
			conditions: [
				{
					column: "data_business_integrations_tasks.reference_id" as keyof IBusinessIntegrationTaskEnriched,
					value: owner.id,
					operator: "="
				}
			],
			metadata: { owner: owner },
			reference_id: owner.id,
			scoreTriggerId
		});
	}

	public async getOwnerScores(
		options: { latest?: boolean; case_id?: string; score_trigger_id?: string } = {}
	): Promise<unknown> {
		const { latest, case_id, score_trigger_id } = options;
		const connection = this.getDBConnection();
		if (connection) {
			let selectScores = db("integration_data.bureau_credit_score")
				.select(
					db.raw("bureau_credit_score.id as score_id"),
					db.raw("integrations.data_business_integrations_tasks.id as task_id"),
					db.raw("data_business_integrations_tasks.reference_id as owner_id"),
					"bureau_credit_score.as_of",
					"bureau_credit_score.score",
					db.raw(`CASE
						WHEN bureau_credit_score.score IS NULL THEN
							jsonb_build_object(
								'hitCode', 
								CASE 
									WHEN bureau_credit_score.meta->'rawResponse'->'consumers'->'equifaxUSConsumerCreditReport'->0->'hitCode'->>'code' IS NOT NULL
									THEN jsonb_build_object(
										'code', bureau_credit_score.meta->'rawResponse'->'consumers'->'equifaxUSConsumerCreditReport'->0->'hitCode'->>'code',
										'description', bureau_credit_score.meta->'rawResponse'->'consumers'->'equifaxUSConsumerCreditReport'->0->'hitCode'->>'description'
									)
									ELSE NULL
								END,
								'fraudAlerts',
								CASE 
									WHEN jsonb_array_length(COALESCE(bureau_credit_score.meta->'rawResponse'->'consumers'->'equifaxUSConsumerCreditReport'->0->'fraudIDScanAlertCodes', '[]'::jsonb)) > 0
									THEN (
										SELECT jsonb_agg(
											jsonb_build_object(
												'code', fraud->>'code',
												'description', fraud->>'description'
											)
										)
										FROM jsonb_array_elements(
											bureau_credit_score.meta->'rawResponse'->'consumers'->'equifaxUSConsumerCreditReport'->0->'fraudIDScanAlertCodes'
										) AS fraud
									)
									ELSE NULL
								END
							)
						ELSE NULL
					END as error`),
					"bureau_credit_score.created_at",
					"bureau_credit_score.updated_at"
				)
				.join(
					"integrations.data_business_integrations_tasks",
					"data_business_integrations_tasks.id",
					"bureau_credit_score.business_integration_task_id"
				)
				.where("bureau_credit_score.business_id", connection.business_id)
				.orderBy("bureau_credit_score.created_at", "desc")
				.orderBy("bureau_credit_score.as_of", "desc");
			let out;
			if (case_id) {
				selectScores = selectScores
					.join(
						"public.data_cases",
						"public.data_cases.score_trigger_id",
						"integrations.data_business_integrations_tasks.business_score_trigger_id"
					)
					.andWhere("public.data_cases.id", case_id);
			}
			if (score_trigger_id) {
				selectScores = selectScores.andWhere(
					"integrations.data_business_integrations_tasks.business_score_trigger_id",
					score_trigger_id
				);
			}
			if (latest == true) {
				out = await selectScores.distinctOn("data_business_integrations_tasks.reference_id");
			} else {
				const scores = await selectScores;
				out = {};
				for (const score of scores) {
					if (!out[score.owner_id]) {
						out[score.owner_id] = [];
					}
					// Transform error object if it exists
					if (score.error) {
						score.error = this.transformErrorObject(score.error);
					}
					out[score.owner_id].push(score);
				}
			}
			return out;
		}
		throw new BureauApiError("connection not initialized");
	}

	// Fraud code mapping based on the legend
	private getFraudCodeMapping(code: string): ErrorCodeMapping | null {
		const fraudCodeMap: Record<string, ErrorCodeMapping> = {
			A: {
				title: "Invalid SSN Provided",
				description: "Inquiry SSN has never been issued or was issued after June 2011."
			},
			B: { title: "Misused SSN", description: "Inquiry SSN reported as misused." },
			C: { title: "Shared Address", description: "Inquiry address associated with more than one name or SSN." },
			D: { title: "Address Validation Failed", description: "Inquiry address unverifiable." },
			I: { title: "Deceased SSN Provided", description: "Inquiry SSN associated with person reported as deceased." },
			L: { title: "Fraud Alert", description: "Fraud victim alert present in database." },
			O: { title: "SSN Issued Prior to DoB", description: "Inquiry SSN issued prior to inquiry date of birth." },
			Q: {
				title: "Deceased SSN/Last Name Mismatch",
				description: "Inquiry SSN reported as deceased and last name does not match."
			},
			R: { title: "Address/Name Mismatch", description: "Inquiry address is not associated with this consumer name." },
			X: { title: "Reported Fraud", description: "Inquiry address associated with reported fraud." },
			"0": { title: "Incomplete Scan", description: "Limited data sources available." },
			"2": { title: "Misused Address", description: "Inquiry address has been reported as misused." },
			"4": { title: "Invalid SSN Provided", description: "The inquiry SSN may be a tax ID number or invalid." },
			"7": {
				title: "SSN Validation Failed",
				description: "Unable to perform SSN validation due to insufficient SSN input."
			},
			"9": { title: "Invalid SSN Provided", description: "Inquiry SSN is invalid." },
			"-": { title: "Score Generation Failed", description: "A score is unavailable due to an unknown error." }
		};

		return fraudCodeMap[code] || null;
	}

	// Hit code mapping based on the legend
	private getHitCodeMapping(code: string): ErrorCodeMapping | null {
		const hitCodeMap: Record<string, ErrorCodeMapping> = {
			"2": {
				title: "Credit Score Not Found",
				description: "Unable to locate a credit score or report for this individual."
			},
			"3": {
				title: "Manual Credit Request Required",
				description: "This individual's credit must be manually verified due to the individual's preferences."
			},
			"4": {
				title: "Manual Credit Request Required",
				description:
					"This individual's credit must be manually verified due to reasons such fraud/active duty alert(s) or address discrepancies."
			},
			"5": {
				title: "Manual Credit Request Required",
				description:
					"This individual's credit must be manually verified as it is currently under review by the credit agencies."
			},
			"7": {
				title: "Missing Required Data",
				description:
					"A request for a credit report was submitted without the right system settings. Please reach out to your CS representative for further assistance."
			},
			"9": {
				title: "Credit Score Not Found",
				description: "Unable to locate a credit score or report for this individual."
			},
			A: {
				title: "Report Unavailable",
				description:
					"A report cannot be generated due to this individual requesting a security freeze on their credit file."
			},
			C: {
				title: "Credit Score Not Found",
				description: "Unable to locate a credit score or report for this individual."
			},
			D: {
				title: "Manual Credit Request Required",
				description: "This individual's credit must be manually verified due to the individual's preferences."
			},
			E: {
				title: "Manual Credit Request Required",
				description:
					"This individual's credit must be manually verified due to reasons such fraud/active duty alert(s) or address discrepancies."
			},
			F: {
				title: "Manual Credit Request Required",
				description:
					"This individual's credit must be manually verified as it is currently under review by the credit agencies."
			},
			G: {
				title: "Report Unavailable",
				description:
					"A report cannot be generated due to this individual requesting a security freeze on their credit file."
			},
			I: {
				title: "Potential Fraud",
				description:
					"Information has been identified as potentially fraudulent or misused, therefore the credit report is not available for delivery."
			},
			J: {
				title: "Potential Fraud",
				description:
					"Information has been identified as potentially fraudulent or misused, therefore the credit report is not available for delivery."
			},
			L: { title: "Report Unavailable", description: "This individual has requested a lock on their file." },
			M: { title: "Report Unavailable", description: "This individual has requested a lock on their file." }
		};

		return hitCodeMap[code] || null;
	}

	// Transform error object to structured format
	private transformErrorObject(errorData: EquifaxErrorData): TransformedEquifaxError[] | null {
		if (!errorData) return null;

		const errors: TransformedEquifaxError[] = [];

		// Transform hit code
		if (errorData.hitCode) {
			const hitMapping = this.getHitCodeMapping(errorData.hitCode.code);
			if (hitMapping) {
				errors.push({
					title: hitMapping.title,
					description: hitMapping.description
				});
			}
		}

		// Transform fraud alerts
		if (errorData.fraudAlerts && Array.isArray(errorData.fraudAlerts)) {
			errorData.fraudAlerts.forEach(alert => {
				const fraudMapping = this.getFraudCodeMapping(alert.code);
				if (fraudMapping) {
					errors.push({
						title: fraudMapping.title,
						description: fraudMapping.description
					});
				}
			});
		}

		return errors.length > 0 ? errors : null;
	}

	async getUserCreditScore(ownerEmail: string) {
		const connection = this.getDBConnection();
		if (connection) {
			const scores = await db("integration_data.bureau_credit_score")
				.select(
					db.raw("bureau_credit_score.id as score_id"),
					db.raw("data_business_integrations_tasks.reference_id as owner_id"),
					"bureau_credit_score.as_of",
					"bureau_credit_score.score",
					"bureau_credit_score.meta",
					"bureau_credit_score.created_at",
					"bureau_credit_score.updated_at"
				)
				.join(
					"integrations.data_business_integrations_tasks",
					"data_business_integrations_tasks.id",
					"bureau_credit_score.business_integration_task_id"
				)
				.where("bureau_credit_score.business_id", connection.business_id)
				.orderBy("bureau_credit_score.created_at", "desc")
				.orderBy("bureau_credit_score.as_of", "desc");

			if (scores.length === 0) {
				return {};
			}
			const ownerScores = scores.filter(score => score.meta?.owner?.email === ownerEmail);

			// Get the latest score for the current month
			const latestScoreCurrentMonth = ownerScores[0];

			if (!latestScoreCurrentMonth) {
				// No score for the current month
				return {};
			}
			if (ownerScores.length < 2) {
				delete latestScoreCurrentMonth.meta;
				latestScoreCurrentMonth.score_difference = 0;
				return { [latestScoreCurrentMonth.owner_id]: latestScoreCurrentMonth };
			}

			// Get the latest score for the previous month
			const previousMonth = new Date(latestScoreCurrentMonth.as_of);
			previousMonth.setMonth(previousMonth.getMonth() - 1);

			const latestScorePreviousMonth = ownerScores.find(score => {
				const scoreDate = new Date(score.as_of);
				return (
					scoreDate.getMonth() === previousMonth.getMonth() && scoreDate.getFullYear() === previousMonth.getFullYear()
				);
			});

			if (!latestScorePreviousMonth) {
				// No score for the previous month
				delete latestScoreCurrentMonth.meta;
				latestScoreCurrentMonth.score_difference = 0;
				return { [latestScoreCurrentMonth.owner_id]: latestScoreCurrentMonth };
			}

			// Calculate the score difference
			const scoreDifference = latestScoreCurrentMonth.score - latestScorePreviousMonth.score;

			// Return the score information and difference
			delete latestScoreCurrentMonth.meta;
			latestScoreCurrentMonth.score_difference = scoreDifference;
			return { [latestScoreCurrentMonth.owner_id]: latestScoreCurrentMonth };
		}
	}

	/**
	 * Inject an event log into the database without directly mutating task_status on the parent task
	 * @param taskId
	 * @param task_status
	 * @param log
	 * @returns
	 */
	private async addEventLog(
		taskId: UUID,
		task_status: TaskStatus,
		log?: Error | string | Record<any, any>
	): Promise<void> {
		if (typeof log === "string") {
			log = { message: log };
		}
		return db<IBusinessIntegrationTaskEvent>("integrations.integration_data_business_integrations_tasks_events").insert(
			{ task_status, business_integration_task_id: taskId, log }
		);
	}

	private async fetchBureauScoreOwners(taskId): Promise<boolean> {
		const task = (await TaskManager.getEnrichedTask(taskId)) as EquifaxFetchOwnerScoreTask;
		const encryptedOwner = task.metadata?.owner;
		if (!encryptedOwner) {
			await this.addEventLog(
				taskId,
				TASK_STATUS.SUCCESS,
				"This task has no associated owner information to fetch a credit score for"
			);
			// Returns true because the task should be in a success state: the task ran but there's nothing to do because there's no owner information
			// This will happen when a business gets onboarded with no owners -- we shouldn't put the original task in an error state because of this
			return true;
		}
		const score = await this.getScore(encryptedOwner, task);
		if (score && this.isValidScoreResponse(score)) {
			return true;
		}
		await this.addEventLog(taskId, TASK_STATUS.FAILED, "Invalid score response");
		return false;
	}

	protected async getScore(
		encryptedOwner: Owner,
		task: EquifaxFetchOwnerScoreTask
	): Promise<ICreditReportResponse | { error?: string } | null> {
		// Sanitize the owner name, keeping only letters (including international characters), spaces and hyphens
		const sanitizedOwner: Owner = {
			...encryptedOwner,
			first_name: encryptedOwner.first_name?.replace(/[^\p{L} -]/gu, "") || encryptedOwner.first_name,
			last_name: encryptedOwner.last_name?.replace(/[^\p{L} -]/gu, "") || encryptedOwner.last_name
		};
		const payload = await this.generateGetScorePayload(sanitizedOwner, task);

		const message: { case_id: string; integration_category: string } = { case_id: "", integration_category: "Credit Bureau" };

		const sendFailureMessage = async () => {
			await producer.send({
				topic: kafkaTopics.CASES,
				messages: [{ 
					key: task.business_id, 
					value: { 
						event: kafkaEvents.INTEGRATION_TASK_FAILED,
						...message 
					}
				}]
			});
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
				.where("integrations.data_business_integrations_tasks.id", task.id)
				.limit(1)
				.first();
			if (row && row.case_id) {
				message.case_id = row.case_id;
			}
		}

		const { baseUrl } = this.strategyConfig;
		const path = `${baseUrl}/business/oneview/consumer-credit/v1/reports/credit-report`;
		const fetchCreditReportFromEquifax = async token => {
			const axiosOptions = {
				headers: {
					"efx-client-correlation-id": payload.customerReferenceidentifier,
					"Content-Type": "application/json",
					Authorization: `Bearer ${token}`
				}
			};
			const equifaxResponse = await this.post<ICreditReportResponse>(path, payload, axiosOptions).catch(ex => {
				if (ex instanceof AxiosError && ex.response && [400, 415].includes(ex.response.status)) {
					logger.error(`taskId=${task.id} | equifax rejected request most liklely due to an invalid person`);
					this.updateTaskStatus(task.id, TASK_STATUS.FAILED, { error: JSON.stringify(ex.response.data) });
					return { data: ex.response.data, error: "Request rejected - validate Owner biodemo information" };
				}
				throw ex;
			});
			if (!equifaxResponse?.data) {
				throw new BureauApiError(
					`taskId=${task.id} | Could not fetch credit report`,
					equifaxResponse,
					StatusCodes.BAD_REQUEST,
					ERROR_CODES.INVALID
				);
			}
			return equifaxResponse.data;
		};
		try {
			const equifaxAccessToken = await this.getBearerToken();

			const report: ICreditReportResponse | unknown = await fetchCreditReportFromEquifax(equifaxAccessToken);

			// Sanitized owner name will be included in the metadata property to maintain consistency with the value sent to Equifax
			await this.saveScore(task, sanitizedOwner, report as ICreditReportResponse);

			if (report && this.isValidScoreResponse(report)) {
				return report;
			} else if (report && (report as { error?: string }).error) {
				throw new BureauApiError(
					(report as { error: string }).error,
					report,
					StatusCodes.UNPROCESSABLE_ENTITY,
					ERROR_CODES.INVALID
				);
			}
			throw new BureauApiError(`taskId=${task.id}; Credit report response is invalid`, report);
		} catch (ex: unknown) {
			if (message.case_id) {
				await sendFailureMessage();
			}
			if (ex instanceof AxiosError) {
				if (ex.response?.status === 401) {
					logger.error(
						`taskId=${task.id} Could not fetch Credit Report: Authentication failure -- Please check credentials.`
					);
					return null;
				}
			}
			throw ex;
		}
	}

	private isValidScoreResponse(scoreResponse: unknown): boolean {
		const response = scoreResponse as ICreditReportResponse;
		return (
			response.consumers?.equifaxUSConsumerCreditReport &&
			response.consumers.equifaxUSConsumerCreditReport.length > 0 &&
			response.consumers.equifaxUSConsumerCreditReport[0].models &&
			response.consumers.equifaxUSConsumerCreditReport[0].models.length > 0
		);
	}

	private async saveScore(
		task: EquifaxFetchOwnerScoreTask,
		owner: Owner,
		response: ICreditReportResponse
	): Promise<IBureauCreditScore> {
		let externalId: string | null = null;
		let score: number | null = null;
		let formattedDate: TDateISO | null = null;
		let meta: any = { owner, rawResponse: response };
		let pdfLink: string | null = null;

		if (this.isValidScoreResponse(response)) {
			const { baseUrl } = this.strategyConfig;

			//Use the ID at the end of the link for the "external id"
			if (response.links && response.links.length > 0 && response.links[0]?.href) {
				pdfLink = `${baseUrl}${response.links[0]?.href}`;
				externalId = pdfLink.split("/").pop() || null;
			}

			//Extract the scores from the response, save the highest score in a MODEL as the score
			const scoreModels = response.consumers.equifaxUSConsumerCreditReport[0].models;
			let chosenModel = scoreModels[0];
			score =
				scoreModels
					.filter(model => model.type === "MODEL")
					.reduce((max, current) => {
						if (current.score && current.score > (max || 0)) {
							chosenModel = current;
							return current.score;
						}
						return max;
					}, chosenModel.score) || null;

			//Extract the report date, it is in this format: MMDDYYYY
			const dateString = response.consumers.equifaxUSConsumerCreditReport[0].reportDate;
			formattedDate = `${dateString.slice(4, 8)}-${dateString.slice(0, 2)}-${dateString.slice(2, 4)}` as TDateISO;
			//Encrypt any sensitive keys before being stored
			let encryptedResponse = { ...response };
			this.ENCRYPTED_PROPERTIES["report_response"].forEach(key => {
				encryptedResponse = this.encryptNestedProperty(response, key);
			});

			meta = { pdfLink: pdfLink as string, chosenModel, owner, rawResponse: encryptedResponse };
		}
		const inserted = await db<EquifaxBureauCreditScore>("integration_data.bureau_credit_score")
			.insert({
				business_integration_task_id: task.id,
				business_id: task.business_id,
				platform_id: INTEGRATION_ID.EQUIFAX,
				external_id: externalId,
				score: score,
				as_of: formattedDate,
				meta
			})
			.returning("*")
			.onConflict(["business_id", "platform_id", "external_id"])
			.merge();
		if (inserted && inserted[0]) {
			if (pdfLink) {
				await this.savePdfReport(pdfLink, task.id).catch(ex => {
					logger.error("Could not save pdf info");
				});
			}
			return inserted[0];
		}

		throw new BureauApiError("Could not insert credit score for task " + task.id);
	}

	/**
	 *
	 * @param owner_id : this is a person UUID (owner)
	 * @returns the base link
	 */
	public async getPdfLink(owner_id: UUID): Promise<string> {
		const connection = this.getDBConnection();
		if (connection) {
			const row = await db("integration_data.bureau_credit_score")
				.select(
					db.raw("bureau_credit_score.id as score_id"),
					db.raw("integrations.data_business_integrations_tasks.id as task_id"),
					"bureau_credit_score.score"
				)
				.join(
					"integrations.data_business_integrations_tasks",
					"data_business_integrations_tasks.id",
					"bureau_credit_score.business_integration_task_id"
				)
				.where("data_business_integrations_tasks.reference_id", owner_id)
				.where("bureau_credit_score.business_id", connection.business_id)
				.whereNotNull("bureau_credit_score.score")
				.orderBy("bureau_credit_score.as_of", "desc")
				.limit(1)
				.first();
			if (row && row.task_id) {
				return row.task_id;
			}
			throw new BureauApiError("No PDF found for owner_id " + owner_id);
		}
		throw new BureauApiError("Business does not have a bureau credit score connection");
	}

	public async getPdfLinks(owner_id: UUID): Promise<string[]> {
		const connection = this.getDBConnection();
		if (connection) {
			const rows = await db("integration_data.bureau_credit_score")
				.select(
					db.raw("bureau_credit_score.id as score_id"),
					db.raw("integrations.data_business_integrations_tasks.id as task_id"),
					"bureau_credit_score.score"
				)
				.join(
					"integrations.data_business_integrations_tasks",
					"data_business_integrations_tasks.id",
					"bureau_credit_score.business_integration_task_id"
				)
				.where("data_business_integrations_tasks.reference_id", owner_id)
				.where("bureau_credit_score.business_id", connection.business_id)
				.whereNotNull("bureau_credit_score.score")
				.orderBy("bureau_credit_score.as_of", "desc");

			if (rows && rows.length) {
				return rows.map(r => r.task_id);
			}
			throw new BureauApiError("No PDF found for owner_id " + owner_id);
		}
		throw new BureauApiError("Business does not have a bureau credit score connection");
	}

	private async savePdfReport(path: string, taskId: UUID): Promise<boolean> {
		const connection = this.getDBConnection();
		if (!connection) {
			throw new BureauApiError(`taskId=${taskId} | No connection defined`);
		}
		const directory = DIRECTORIES.EQUIFAX.replace(":businessID", connection.business_id || "").replace(
			":integrationPlatform",
			"equifax"
		);

		/**
		 * TODO: Perhaps remove this `await`? `setTimeout` doesn't return a promise, so we can't actually await it.
		 * 		 As it is now, the `savePdfReport` function will *always* return true, regardless of whether the PDF was saved or not.
		 */
		await setTimeout(
			async () => {
				try {
					const token = await this.getBearerToken();
					const retryUntil = Date.now() + 120 * 1000; /** 120 seconds */
					const pdfData = await fetchReportWithRetry(token, path, retryUntil);
					await putFile({ buffer: pdfData, fileName: taskId + ".pdf" }, directory);
					return true;
				} catch (error) {
					logger.error(
						error,
						`savePdfReport:Could not fetch equifax pdf report for taskId: ${taskId} Error: ${JSON.stringify(error)}`
					);
					return false;
				}
			},
			/** Wait 10 seconds for the PDF to be ready */
			10 * 1000
		);
		return true;
	}

	private async post<T>(path: string, data, options): Promise<AxiosResponse<T, any>> {
		return axios.post<T, any>(path, data, options);
	}

	private isBelowMinimumPredictionScore(task: IBusinessIntegrationTask<EntityMatchTask>): boolean {
		const staticRef = this.constructor as typeof Equifax;
		const predictionThresdhold = staticRef.MINIMUM_PREDICTION_SCORE;
		if (!task.metadata?.prediction) {
			return true;
		}
		return task.metadata.prediction < predictionThresdhold;
	}

	public async processFirmographicsEvent(
		task: IBusinessIntegrationTaskEnriched<EquifaxEntityMatchTask>,
		payload: EquifaxFirmographicsEvent
	): Promise<void> {
		const efx = payload.firmographics;
		const usRaw = efx.equifax_us_raw?.[0];
		const bmaRaw = efx.equifax_bma_raw?.[0];
		if (!usRaw?.efx_id) {
			logger.error({ task_id: task.id, payload }, "No firmographic found for match");
			throw new VerificationApiError("No firmographic found for match");
		}
		const reportDate = new Date(payload.collected_at);
		const reportDateString = reportDate.toISOString();
		const serializedAIScore = serializeBigInt<IEquifaxAIScoreModel>(
			this.transformToAIScoreModel(usRaw as unknown as EquifaxUSRaw),
			true
		);
		const aiScoreModel =
			typeof serializedAIScore === "object" && serializedAIScore !== null
				? (serializedAIScore as IEquifaxAIScoreModel)
				: null;
		const equifaxMatch: IEquifaxJudgementsLiens = {
			business_id: task.business_id,
			report_date: reportDate,
			report: bmaRaw ?? undefined,
			scoring_model: aiScoreModel ?? undefined,
			matches: { score: this.convertPredictionToIndex(task.metadata?.prediction ?? 0), data: task.metadata?.match }
		};
		const externalId = usRaw.efx_id.toString();

		const newMetadata = { ...task.metadata, result: { ...equifaxMatch } };
		const extraFields: Record<string, any> = {
			...usRaw,
			...aiScoreModel,
			match_id: payload.match_id,
			prediction: payload.prediction,
			additional_fields: {
				minority_business_enterprise: usRaw?.efx_mbe ?? "N/A",
				woman_owned_enterprise: usRaw?.efx_wbe ?? "N/A",
				veteran_owned_enterprise: usRaw?.efx_vet ?? "N/A",
				number_of_employees: usRaw?.efx_corpempcnt ?? "N/A"
			},
			bankruptcy_most_recent_age: null,
			lien_most_recent_age: null,
			judgement_most_recent_age: null,
			lien_count: null,
			judgement_count: null,
			bankruptcy_count: null
		};
		if (bmaRaw) {
			extraFields.bankruptcy_most_recent_age = this.daysBetween(reportDateString, bmaRaw.efxbma_pubrec_age_bkp, bmaRaw);
			extraFields.lien_most_recent_age = this.daysBetween(reportDateString, bmaRaw.efxbma_pubrec_age_lien, bmaRaw);
			extraFields.judgement_most_recent_age = this.daysBetween(reportDateString, bmaRaw.efxbma_pubrec_age_judg, bmaRaw);
			extraFields.lien_count = bmaRaw.efxbma_pubrec_status_fi >= 99 ? null : bmaRaw.efxbma_pubrec_status_fi;
			extraFields.judgement_count = bmaRaw.efxbma_pubrec_status_ju === 99 ? null : bmaRaw.efxbma_pubrec_status_ju;
			// Equifax doesn't have a field for # of bankruptcies, only if it is in bankruptcy so we need to just indicate "1"
			extraFields.bankruptcy_count = bmaRaw.efxbma_pubrec_bkp_ind === 9 ? null : 1;
		}

		type ScoringWithExtraFields = IEquifaxJudgementsLiensReport & Record<string, any>;

		const scoring: ScoringWithExtraFields = { ...equifaxMatch.report, ...extraFields } as ScoringWithExtraFields;
		await this.storeEntityMatch({ ...task, reference_id: externalId, metadata: newMetadata }, scoring);

		logger.info({ task_id: task.id, payload }, "Firmographics event processed");
	}

	private async storeEntityMatch(
		task: IBusinessIntegrationTaskEnriched,
		payload: IEquifaxJudgementsLiensReport & Record<string, any>
	) {
		await Promise.all([
			this.updateTask(task.id, { reference_id: task.reference_id, metadata: task.metadata }),
			this.saveRequestResponse(task, payload)
		]);
		try {
			return uploadRawIntegrationDataToS3(
				payload,
				this.dbConnection?.business_id,
				"judgementsLiens",
				DIRECTORIES.EQUIFAX,
				"EQUIFAX"
			);
		} catch (ex) {
			logger.error({ error: ex, task_id: task.id }, `task could not upload entry to S3`);
		}
	}

	/**
	 * Process the entity matching for a given task
	 * @param task The task to process
	 * @returns true if the match was successful otherwise throws
	 */
	protected async processEntityMatching(
		task: IBusinessIntegrationTaskEnriched<EquifaxEntityMatchTask>
	): Promise<boolean> {
		try {
			logger.debug(
				`Processing Equifax entity matching for businessId=${this.dbConnection?.business_id} taskId=${task.id}`
			);
			if (!task.metadata || !task.metadata.match_id) {
				logger.error(
					`Task not setup as an EntityMatching Task taskId=${task.id} businessId=${this.dbConnection?.business_id}`
				);
				throw new VerificationApiError("Not an entity matching task");
			}
			if (!task.metadata.match?.efx_id) {
				logger.debug(
					`No match found for businessId=${this.dbConnection?.business_id} taskId=${task.id} - Throwing VerificationApiError`
				);
				throw new VerificationApiError("No Match Found");
			}
			if (this.isBelowMinimumPredictionScore(task)) {
				logger.warn(
					`Prediction score of ${task.metadata.prediction} is below the minimum threshold of ${Equifax.MINIMUM_PREDICTION_SCORE}, not using as basis for match`
				);
				throw new VerificationApiError("Below minimum threshold");
			}

			const [bmaRaw, usRaw, aiScoreModel] = await this.getRedshiftData(task.metadata.match.efx_id);

			let reportDate = new Date();
			let reportDateString = reportDate.toISOString();
			try {
				if (task?.metadata?.match?.collected_at) {
					reportDate = new Date(task.metadata.match.collected_at);
					reportDateString = reportDate.toISOString();
				}
			} catch (ex) {
				logger.warn({ error: ex, task_id: task.id }, `Could not parse collected_at date, using current date`);
			}
			const equifaxMatch: IEquifaxJudgementsLiens = {
				business_id: task.business_id,
				report_date: reportDate,
				report: bmaRaw ?? undefined,
				scoring_model: aiScoreModel ?? undefined,
				matches: { score: this.convertPredictionToIndex(task.metadata.prediction ?? 0), data: task.metadata.match }
			};

			const externalId = task.metadata.match.efx_id.toString();
			const newMetadata = { ...task.metadata, result: { ...equifaxMatch, match_mode: "ai" } };
			const extraFields: Record<string, any> = {
				...usRaw,
				...aiScoreModel,
				additional_fields: {
					minority_business_enterprise: usRaw?.efx_mbe ?? "N/A",
					woman_owned_enterprise: usRaw?.efx_wbe ?? "N/A",
					veteran_owned_enterprise: usRaw?.efx_vet ?? "N/A",
					number_of_employees: usRaw?.efx_corpempcnt ?? "N/A"
				},
				bankruptcy_most_recent_age: null,
				lien_most_recent_age: null,
				judgement_most_recent_age: null,
				lien_count: null,
				judgement_count: null,
				bankruptcy_count: null
			};
			if (bmaRaw) {
				extraFields.bankruptcy_most_recent_age = this.daysBetween(
					reportDateString,
					bmaRaw.efxbma_pubrec_age_bkp,
					bmaRaw
				);
				extraFields.lien_most_recent_age = this.daysBetween(reportDateString, bmaRaw.efxbma_pubrec_age_lien, bmaRaw);
				extraFields.judgement_most_recent_age = this.daysBetween(
					reportDateString,
					bmaRaw.efxbma_pubrec_age_judg,
					bmaRaw
				);
				extraFields.lien_count = bmaRaw.efxbma_pubrec_status_fi >= 99 ? null : bmaRaw.efxbma_pubrec_status_fi;
				extraFields.judgement_count = bmaRaw.efxbma_pubrec_status_ju == 99 ? null : bmaRaw.efxbma_pubrec_status_ju;
				// Equifax doesn't have a field for # of bankruptcies, only if it is in bankruptcy so we need to just indicate "1"
				extraFields.bankruptcy_count = bmaRaw.efxbma_pubrec_bkp_ind == 9 ? null : 1;
			}
			const scoring = serializeBigInt({ ...equifaxMatch.report, ...extraFields }, true);
			await Promise.all([
				this.updateTask(task.id, { reference_id: externalId, metadata: newMetadata }),
				this.saveRequestResponse(task, scoring)
			]);
			try {
				await uploadRawIntegrationDataToS3(
					scoring,
					task.business_id,
					"judgementsLiens",
					DIRECTORIES.EQUIFAX,
					"EQUIFAX"
				);
			} catch (ex) {
				logger.error({ error: ex, task_id: task.id }, `task could not upload entry to S3`);
			}
			return true;
		} catch (ex) {
			if (ex instanceof VerificationApiError) {
				logger.warn(
					`Entity Matching could not return a result for taskId=${task.id} businessId=${this.dbConnection?.business_id}`
				);
				logger.warn({ error: ex, task_id: task.id }, `VerificationApiError`);
				return true; // We return true here to indicate that the task was processed, even if no match was found
			}
			logger.error(
				{ error: ex, business_id: this.dbConnection?.business_id, task_id: task.id },
				`unhandled equifax entity matching error `
			);
			throw ex;
		}
	}

	private async getRedshiftData(
		efx_id: number
	): Promise<[IEquifaxJudgementsLiensReport | null, EquifaxUSRaw | null, IEquifaxAIScoreModel | null]> {
		let bma: IEquifaxJudgementsLiensReport | null = null;
		let us: EquifaxUSRaw | null = null;
		let aiScore: IEquifaxAIScoreModel | null = null;

		const bmaRawPromise = executeAndUnwrapRedshiftQuery<IEquifaxJudgementsLiensReport>(
			`select * from warehouse.equifax_bma_raw where efx_id = ${efx_id} order by yr desc,mon desc limit 1`
		);
		const usRawPromise = executeAndUnwrapRedshiftQuery<EquifaxUSRaw>(
			`select * from warehouse.equifax_us_raw where efx_id = ${efx_id} order by yr desc,mon desc limit 1`
		);

		try {
			const [bmaRaw, usRaw] = await Promise.all([bmaRawPromise, usRawPromise]);
			if (bmaRaw?.[0]) {
				bma = serializeBigInt<IEquifaxJudgementsLiensReport>(bmaRaw[0], true) as IEquifaxJudgementsLiensReport;
			} else {
				logger.error(`No BMA raw data found for efx_id=${efx_id}`);
			}
			if (usRaw?.[0]) {
				const serializedAIScore = serializeBigInt<IEquifaxAIScoreModel>(this.transformToAIScoreModel(usRaw[0]), true);
				aiScore =
					typeof serializedAIScore === "object" && serializedAIScore !== null
						? (serializedAIScore as IEquifaxAIScoreModel)
						: null;
				const serializedUS = serializeBigInt<EquifaxUSRaw>(usRaw[0], true);
				us = typeof serializedUS === "object" && serializedUS !== null ? (serializedUS as EquifaxUSRaw) : null;
			} else {
				logger.error(`No US raw data found for efx_id=${efx_id}`);
			}
		} catch (ex) {
			logger.error({ error: ex }, `Error fetching Redshift data for efx_id=${efx_id}`);
		}
		return [bma, us, aiScore];
	}

	private transformToAIScoreModel(raw: EquifaxUSRaw): IEquifaxAIScoreModel {
		return {
			legultnameall: raw.efx_legultnameall,
			legultnumall: raw.efx_legultnumall?.toString() || "",
			legultstateall: raw.efx_legultstateall,
			legultcityall: raw.efx_legultcityall,
			efx_legultzipcodeall: raw.efx_legultzipcodeall,
			address_string: `${raw.efx_address}, ${raw.efx_city}, ${raw.efx_state} ${raw.efx_zipcode}`,
			extract_month: `${raw.yr}-${raw.mon.toString().padStart(2, "0")}`,
			location_cnt: BigInt(1), // Default to 1 for single record
			location_ids: [raw.efx_id],
			location_active_cnt: BigInt(raw.efx_busstat === "A" ? 1 : 0),
			location_inactive_cnt: BigInt(raw.efx_busstat !== "A" ? 1 : 0),
			location_inactiveold_cnt: BigInt(0), // Not available in raw data
			location_inactivedt_cnt: BigInt(0), // Not available in raw data
			deadmon_array: raw.efx_dead || "",
			lat_array: raw.efx_lat?.toString() || "",
			lon_array: raw.efx_lon?.toString() || "",
			location_latitude_avg: raw.efx_lat || 0,
			location_longitude_avg: raw.efx_lon || 0,
			location_soho_cnt: BigInt(raw.efx_soho === "Y" ? 1 : 0),
			location_biz_cnt: BigInt(raw.efx_biz === "Y" ? 1 : 0),
			location_res_cnt: BigInt(raw.efx_res === "Y" ? 1 : 0),
			location_small_cnt: BigInt(raw.efx_bussize === "S" ? 1 : 0),
			location_large_cnt: BigInt(raw.efx_bussize === "L" ? 1 : 0),
			location_unknown_size_cnt: BigInt(raw.efx_bussize === "U" ? 1 : 0),
			location_gov_cnt: BigInt(raw.efx_gov === "Y" ? 1 : 0),
			location_fedgov_cnt: BigInt(raw.efx_fgov === "Y" ? 1 : 0),
			location_nonprofitind_cnt: BigInt(raw.efx_nonprofit === "Y" ? 1 : 0),
			location_edu_cnt: BigInt(raw.efx_edu === "Y" ? 1 : 0),
			min_year_est: raw.efx_yrest?.toString() || "",
			max_year_est: raw.efx_yrest?.toString() || "",
			year_est_array: raw.efx_yrest?.toString() || "",
			location_indsole_cnt: BigInt(raw.efx_busstat === "I" ? 1 : 0),
			location_partner_cnt: BigInt(raw.efx_busstat === "P" ? 1 : 0),
			location_limpartner_cnt: BigInt(raw.efx_busstat === "L" ? 1 : 0),
			location_corp_cnt: BigInt(raw.efx_busstat === "C" ? 1 : 0),
			location_scorp_cnt: BigInt(raw.efx_busstat === "S" ? 1 : 0),
			location_llc_cnt: BigInt(raw.efx_busstat === "L" ? 1 : 0),
			location_llp_cnt: BigInt(raw.efx_busstat === "P" ? 1 : 0),
			location_other_cnt: BigInt(raw.efx_busstat === "O" ? 1 : 0),
			location_ccorp_cnt: BigInt(raw.efx_busstat === "C" ? 1 : 0),
			location_nonprofitstat_cnt: BigInt(raw.efx_nonprofit === "Y" ? 1 : 0),
			location_mutual_cnt: BigInt(0), // Not available in raw data
			location_trust_cnt: BigInt(0), // Not available in raw data
			location_lllp_cnt: BigInt(0), // Not available in raw data
			bankrupt_cnt_failrt: BigInt(raw.efx_bankruptcy === "Y" ? 1 : 0),
			bankrupt_cnt_credcls: BigInt(raw.efx_bankruptcy === "Y" ? 1 : 0),
			bankrupt_cnt_field: BigInt(raw.efx_bankruptcy === "Y" ? 1 : 0),
			failrate_avg: raw.efx_failrate || 0,
			failrate_array: raw.efx_failrate?.toString() || "",
			corpemployees: raw.efx_corpempcnt || 0,
			corpamount: raw.efx_corpamount || 0,
			corpamount_type: raw.efx_corpamounttp || "",
			corpamount_prec: raw.efx_corpamountprec || "",
			creditscore_avg: raw.efx_creditscore || 0,
			creditscore_max: raw.efx_creditscore || 0,
			creditscore_min: raw.efx_creditscore || 0,
			creditscore_array: raw.efx_creditscore?.toString() || "",
			creditperc_avg: raw.efx_creditperc || 0,
			creditperc_max: raw.efx_creditperc || 0,
			creditperc_min: raw.efx_creditperc || 0,
			creditperc_array: raw.efx_creditperc?.toString() || "",
			mkt_telscore_avg: raw.efx_mrkt_telescore || 0,
			mkt_telscore_max: raw.efx_mrkt_telescore || 0,
			mkt_telscore_min: raw.efx_mrkt_telescore || 0,
			mkt_telscore_array: raw.efx_mrkt_telescore?.toString() || "",
			mkt_totalscore_avg: raw.efx_mrkt_totalscore || 0,
			mkt_totalscore_max: raw.efx_mrkt_totalscore || 0,
			mkt_totalscore_min: raw.efx_mrkt_totalscore || 0,
			mkt_totalscore_array: raw.efx_mrkt_totalscore?.toString() || "",
			primsic: raw.efx_primsic?.toString() || "",
			secsic1: raw.efx_secsic1?.toString() || "",
			secsic2: raw.efx_secsic2?.toString() || null,
			secsic3: raw.efx_secsic3?.toString() || null,
			secsic4: raw.efx_secsic4?.toString() || null,
			primnaicscode: raw.efx_primnaicscode?.toString() || "",
			secnaics1: raw.efx_secnaics1?.toString() || "",
			secnaics2: raw.efx_secnaics2?.toString() || "",
			secnaics3: raw.efx_secnaics3?.toString() || null,
			secnaics4: raw.efx_secnaics4?.toString() || null,
			months_since_update: BigInt(0) // Not available in raw data
		};
	}

	public convertPredictionToIndex(prediction: number): number {
		return Math.round(prediction * Equifax.MATCH_SCORE_MULTIPLIER);
	}

	/**
	 * Run the heuristic match for a given task
	 * @param { taskId UUID or task object}
	 * @returns true if the match was successful otherwise throws
	 * @deprecated Should be removed once we switch only to AI matching. This is all in Athena and hasn't been updated since early 2024
	 */
	private async runHeuristicMatch({
		taskId,
		task
	}: {
		taskId?: UUID;
		task?: IBusinessIntegrationTaskEnriched;
	}): Promise<boolean> {
		// Execution in a task context

		if (!task && taskId) {
			task = await TaskManager.getEnrichedTask(taskId);
		} else if (task && !taskId) {
			taskId = task.id;
		}
		if (!task || !taskId) {
			throw new BureauApiError("No task or task id provided");
		}
		const dbConnection = await getConnectionByTaskId(taskId);

		if (dbConnection && task) {
			const equifax = await strategyPlatformFactory<Equifax>({ dbConnection: dbConnection });
			const businessId = task.business_id;
			const reportDate = task.metadata?.reportDate;
			const out = { business_id: businessId, report_date: reportDate } as IEquifaxJudgementsLiens;
			const athena = new Athena(businessId);
			const { bestMatch: matches, result } = await athena.queryForBusiness(businessId, reportDate);
			if (!matches?.data?.efx_id) {
				// End early, no match found
				return true;
			}
			out.matches = matches;
			const scoringPromise = athena.getScoringDataForBusiness(matches.data.efx_id, reportDate);
			const reportPromise = athena.getRelevantReportForBusiness(matches.data.efx_id, reportDate);
			/* Allow both of these Athena promises to run concurrently */
			let [scoring, report] = await Promise.all([scoringPromise, reportPromise]);
			out.stats = athena.getAggregateStats();
			if (!reportDate) {
				logger.warn("No report date found");
			}

			let officialWebsite = "";
			for (const row of result) {
				if (row.efx_web) {
					officialWebsite = row.efx_web;
					break;
				}
			}

			if (scoring) {
				if (report) {
					const extraFields = {
						bankruptcy_most_recent_age: this.daysBetween(reportDate, report.efxbma_pubrec_age_bkp, report),
						lien_most_recent_age: this.daysBetween(reportDate, report.efxbma_pubrec_age_lien, report),
						judgement_most_recent_age: this.daysBetween(reportDate, report.efxbma_pubrec_age_judg, report),
						lien_count: report.efxbma_pubrec_status_fi >= 99 ? null : report.efxbma_pubrec_status_fi,
						judgement_count: report.efxbma_pubrec_status_ju == 99 ? null : report.efxbma_pubrec_status_ju,
						// Equifax doesn't have a field for # of bankruptcies, only if it is in bankruptcy so we need to just indicate "1"
						bankruptcy_count: report.efxbma_pubrec_bkp_ind == 9 ? null : 1
					};
					scoring = { ...scoring, ...report, ...extraFields };
				}
				try {
					/* Serialize bigint as string */
					const serializedScore = serializeBigInt<IEquifaxAIScoreModel>(scoring, true);
					out.scoring_model =
						typeof serializedScore === "string"
							? (JSON.parse(serializedScore) as IEquifaxAIScoreModel)
							: (serializedScore as IEquifaxAIScoreModel | undefined);
					await equifax.saveRequestResponse(task, serializedScore);
					await athena.saveReportToS3(businessId, serializedScore);
				} catch (e) {
					logger.error({ error: e }, "Couldn't write to s3");
				}
			}
			if (report) {
				out.report = report;
				task.metadata = { ...task.metadata, result: out };

				if (officialWebsite) {
					const service = await getBusinessEntityVerificationService(task.business_id);
					service.fallbackFetchMiddeskWebsiteDetails(task, officialWebsite);
				}

				await equifax.savePublicRecords(task, out, officialWebsite);
			}
		}
		return true;
	}

	/**
	 * Fetches additional public records data for a given business integration task.It only fetches 3 keys for now but It can be expanded as needed.
	 * @param task - The business integration task.
	 * @param equifax - The Equifax instance.
	 * @returns A promise that resolves to a boolean indicating whether the data was fetched successfully.
	 */
	public async fetchCreditSummary(task: IBusinessIntegrationTaskEnriched, equifax: Equifax): Promise<boolean> {
		// Task will always be provided
		const businessId = task.business_id;
		const reportDate = new Date(task.metadata?.reportDate || Date.now());
		const athena = new Athena(businessId);
		const { bestMatch: matches, result } = await athena.queryForBusiness(businessId, reportDate);
		if (!matches?.data?.efx_id) {
			// End early, no match found
			return false;
		}
		const creditSummary = await athena.getCreditSummaryForBusiness(matches.data.efx_id, reportDate);

		if (creditSummary) {
			const creditSummaryFields = {
				...creditSummary,
				non_financial_acc_reported_24_months_count: creditSummary.efxbma_24m_nfin_tr_count ?? null,
				max_non_financial_balance_24_months: creditSummary.efxbma_24m_nfin_tr_high_bal ?? null,
				og_credit_limit_non_financial_acc_reported_24_months: creditSummary.efxbma_24m_nfin_orig_credit_lim ?? null,
				max_acc_limit_non_financial_acc_reported_24_months: creditSummary.efxbma_24m_nfin_high_credit_lim ?? null,
				non_financial_acc_cycles_due_or_charge_off_24_months_count:
					creditSummary.efxbma_24m_nfin_4pc_past_due_count ?? null,
				new_non_financial_acc_opened_3_months: creditSummary.efxbma_3m_nfin_new_acc_count ?? null,
				total_non_financial_charge_off_amount_24_monts: creditSummary.efxbma_24m_nfin_total_chargeoff_amt ?? null,
				satisfactory_non_financial_acc_percentage_24_months: creditSummary.efxbma_24m_nfin_per_satisfactory_acc ?? null,
				worst_non_financial_payment_status_24_months: creditSummary.efxbma_24m_nfin_worst_payment_status ?? null
			};

			const keysToDelete = [
				"efxbma_24m_nfin_tr_count",
				"efxbma_24m_nfin_tr_high_bal",
				"efxbma_24m_nfin_orig_credit_lim",
				"efxbma_24m_nfin_high_credit_lim",
				"efxbma_24m_nfin_4pc_past_due_count",
				"efxbma_3m_nfin_new_acc_count",
				"efxbma_24m_nfin_total_chargeoff_amt",
				"efxbma_24m_nfin_per_satisfactory_acc",
				"efxbma_24m_nfin_worst_payment_status"
			];

			deleteKeysFromObject(creditSummaryFields, keysToDelete);
			// If there already exists an Object in jsonB response column then this mergeOption would append the additional_fields into the existing data without actually overwriting the existing data which previous
			// merge operation used to do.
			const serialisedCreditSummary = JSON.stringify(creditSummaryFields, (_, value) =>
				typeof value === "bigint" ? value.toString() : value
			);
			const mergeoptions = {
				response: db.raw(
					`jsonb_set(COALESCE(integration_data.request_response.response, '{}'::jsonb), '{creditSummaryFields}', '${serialisedCreditSummary}'::jsonb, true)`
				)
			};

			await equifax.saveRequestResponse(task, { creditSummaryFields: serialisedCreditSummary }, mergeoptions);

			return true;
		}

		return false;
	}

	public async savePublicRecords(
		task: IBusinessIntegrationTaskEnriched,
		input: IEquifaxJudgementsLiens,
		official_website?: string
	) {
		if (input?.report?.efx_id) {
			const data = input.report;
			const serializedMeta = serializeBigInt(task.metadata);
			const meta = typeof serializedMeta === "string" ? JSON.parse(serializedMeta) : {};
			const month = data.mon;
			const year = data.yr;

			const reportDate = dayjs(`${year}-${month.padStart(2, "0")}-01`).toISOString();
			await db("integrations.data_business_integrations_tasks").update({ metadata: meta }).where("id", task.id);

			const mostRecentBankruptcy =
				data.efxbma_pubrec_age_bkp === 999 ? null : this.daysBetween(reportDate, data.efxbma_pubrec_age_bkp, data);
			const mostRecentLien =
				data.efxbma_pubrec_age_lien === 999 ? null : this.daysBetween(reportDate, data.efxbma_pubrec_age_lien, data);
			const mostRecentJudgement =
				data.efxbma_pubrec_age_judg === 999 ? null : this.daysBetween(reportDate, data.efxbma_pubrec_age_judg, data);
			const numLiens = data.efxbma_pubrec_status_fi == 99 ? null : data.efxbma_pubrec_status_fi;
			const numJudgements = data.efxbma_pubrec_status_ju == 99 ? null : data.efxbma_pubrec_status_ju;
			// Equifax doesn't have a field for # of bankruptcies, only if it is in bankruptcy so we need to just indicate "1"
			const numBankruptcies = data.efxbma_pubrec_bkp_ind == 9 ? null : 1;
			await db("integration_data.public_records")
				.insert({
					business_integration_task_id: task.id,
					number_of_business_liens: numLiens,
					number_of_bankruptcies: numBankruptcies,
					number_of_judgement_fillings: numJudgements,
					most_recent_judgement_filling_date: mostRecentJudgement,
					most_recent_business_lien_filing_date: mostRecentLien,
					most_recent_bankruptcy_filing_date: mostRecentBankruptcy,
					most_recent_business_lien_status:
						data.efxbma_pubrec_total_cur_liab_lien === 999999999 ? null : data.efxbma_pubrec_total_cur_liab_lien,
					official_website: official_website ? official_website : ""
				})
				.returning("*");
		}
	}

	private async saveRequestResponse<T = any>(
		task: IBusinessIntegrationTaskEnriched<T>,
		input: any,
		mergeOptions: any = null
	): Promise<IRequestResponse> {
		const insertedRecord = await db<IRequestResponse>("integration_data.request_response")
			.insert({
				request_id: task.id,
				business_id: task.business_id,
				platform_id: task.platform_id,
				external_id: input.efx_id,
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

	private daysBetween(date: string, diff: number, report?: IEquifaxJudgementsLiensReport) {
		if (!date || diff === 999 || diff == 0) {
			return null;
		}
		if (!date && report?.yr && report?.mon) {
			date = `${report.yr}-${report.mon.padStart(2, "0")}-01`;
		}
		return Math.abs(dayjs(date).subtract(diff, "days").diff(date, "days"));
	}
}
