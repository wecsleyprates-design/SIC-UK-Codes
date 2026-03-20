import { TaskHandlerMap } from "#api/v1/modules/tasks/taskManager";
import { EVENTS, INTEGRATION_ID, QUEUES, TASK_STATUS } from "#constants";
import { logger, setApplicationEditData } from "#helpers";
import { IBusinessIntegrationTaskEnriched, IDBConnection } from "#types";
import { UUID } from "crypto";
import { BusinessEntityVerificationService as BusinessEntityVerification } from "../../src/api/v1/modules/verification/businessEntityVerification";
import { NPIMatchResult, NPIMatchRecord, type MatchResult, type NPIEntityMatchTask } from "./types";
import { db } from "#helpers/knex";
import { VerificationApiError } from "#api/v1/modules/verification/error";

export class NPI extends BusinessEntityVerification {
	protected static readonly PLATFORM_ID = INTEGRATION_ID.NPI;
	public static readonly BULK_NAMED_JOB = EVENTS.NPI_BUSINESS_MATCH;
	public static BULK_NAMED_QUEUE = QUEUES.NPI;
	protected staticRef: typeof NPI;

	constructor(dbConnection?: IDBConnection) {
		super(dbConnection);
		this.staticRef = this.constructor as typeof NPI;
	}

	taskHandlerMap: TaskHandlerMap = {
		fetch_healthcare_provider_verification: async taskId => {
			logger.debug("fetch NPI");
			return this.matchNPIData(taskId);
		},
		fetch_business_entity_verification: async taskId => {
			logger.debug("NPI fetch Business Entity Verification");
			return this.processBusinessEntityVerification(taskId);
		}
	};

	// submits the NPI ID to the task manager for processing
	// and returns the task ID
	public submitProviderMatch = async (
		npiId: string,
		caseId: string,
		metadata?: {
			business_id: UUID;
			customer_id: string;
			created_by: string;
			user_name: string;
			old_npi_id: string;
		} | null
	) => {
		try {
			logger.info(`Submitting NPI match for npiId=${npiId} and caseId=${caseId}`);
			let oldValue: string | null = (metadata && metadata?.old_npi_id) ?? null;
			let newValue: string | null = npiId ?? null;

			let taskId = await this.getTaskForCode({
				taskCode: "fetch_healthcare_provider_verification",
				conditions: [
					{
						column: "data_business_integrations_tasks.reference_id" as keyof IBusinessIntegrationTaskEnriched,
						isNull: true
					}
				]
			});

			// for guest user, fetch task of old npi id
			if (metadata && metadata?.old_npi_id) {
				logger.info(`Fetching task for old NPI ID: ${metadata.old_npi_id}`);
				const task = await this.getTaskByReferenceId(metadata.old_npi_id);
				taskId = task?.id ?? null;
			}

			if (taskId) {
				oldValue = metadata?.old_npi_id ?? null;
				await this.updateTask(taskId, {
					reference_id: npiId,
					metadata: { npiId, caseId },
					task_status: TASK_STATUS.CREATED
				});
				logger.info(`Task updated for NPI match: ${taskId}`);
			} else {
				taskId = await this.createTaskForCode({
					taskCode: "fetch_healthcare_provider_verification",
					reference_id: npiId,
					metadata: { npiId, caseId }
				});
				logger.info(`Task created for NPI match: ${taskId}`);
			}

			if (metadata) {
				await setApplicationEditData(metadata.business_id, {
					case_id: caseId,
					customer_id: metadata.customer_id,
					stage_name: "company",
					user_name: metadata.user_name,
					created_by: metadata.created_by,
					data: [
						{
							field_name: "npi",
							old_value: oldValue,
							new_value: newValue,
							metadata: oldValue === null ? { is_inserted: true } : { is_updated: true }
						}
					]
				});
			}

			await this.processTask({ taskId });
			return {
				taskId,
				submitted_npi: npiId,
				case_id: caseId
			};
		} catch (error) {
			logger.error({ error }, "Error submitting NPI match");
			throw error;
		}
	};

	public matchNPIData = async (taskId: UUID): Promise<boolean> => {
		try {
			const task = await NPI.getEnrichedTask(taskId);
			const { npiId, caseId } = task?.metadata;
			const businessId = task.business_id;

			// setting task as in-progress
			await this.updateTaskStatus(taskId, TASK_STATUS.IN_PROGRESS);

			logger.info(
				`Matching NPI data for taskId=${taskId} and npiId=${npiId} and caseId=${caseId} and businessId=${businessId}`
			);

			// Throw error if no NPI Information Provided, this shouldn't happen because the task wouldn't be created without it
			if (!npiId) {
				const message = "NPI match error: missing NPI ID in task metadata";
				const error = new Error(message);

				logger.error(message);
				await this.updateTaskStatus(taskId, TASK_STATUS.FAILED, error);
				throw error;
			}

			// start by creating a mostly empty record to save to the database if no match is found
			const initialRecord: NPIMatchRecord = {
				business_id: businessId, // use the business id from the task
				business_integration_task_id: taskId, // use the task id for tracking
				is_matched: false, // default to false until we find a match
				case_id: caseId, // use the case id from the task
				submitted_npi: npiId, // the submitted NPI ID
				metadata: { npi: npiId } // store the submitted NPI ID in metadata as well
			};

			await this.saveResultToDB(initialRecord);

			// fetch the NPI data
			const searchQuery = this.buildSearchQuery(npiId);
			const match = await this.executeMatchSearchQuery<NPIMatchResult>(searchQuery);

			// if no match found, update the task and return
			// this is not an error, just a lack of data
			if (match?.length === 0 || !match?.[0]?.npi) {
				const newMetadata = { ...task.metadata, match: null };
				await this.updateTask(taskId, { metadata: newMetadata });
				await this.updateTaskStatus(taskId, TASK_STATUS.SUCCESS);

				logger.debug(`No NPI match found for npiId=${npiId}`);

				return true;
			}
			// map the record to a result & save it to the DB
			const mappedRecord = this.mapResultToRecord(match[0], taskId, businessId, caseId);
			const result = await this.saveResultToDB(mappedRecord);

			if (result) {
				logger.debug(`NPI match found for npiId=${npiId}`);
				await this.updateTaskStatus(taskId, TASK_STATUS.SUCCESS);
				return true;
			}

			// Throw DB save error
			throw new Error("DB Error: failed to save the NPI match result");
		} catch (error) {
			logger.error({ error }, "Error fetching NPI Data");
			await this.updateTaskStatus(
				taskId,
				TASK_STATUS.FAILED,
				error instanceof Error ? error : new Error(error as string)
			);
			throw error;
		}
	};

	public processBusinessEntityVerification = async (taskId: UUID): Promise<boolean> => {
		try {
			const task = await NPI.getEnrichedTask<NPIEntityMatchTask>(taskId);
			const { business_id: businessId, case_id: caseId } = task;

			if (!task.metadata?.match) {
				throw new VerificationApiError("No Match Found");
			}
			if (this.isBelowMinimumPredictionScore(task)) {
				logger.warn(
					{ prediction: task.metadata.prediction, min_threshold: this.staticRef.MINIMUM_PREDICTION_SCORE },
					`Prediction score below minimum threshold for businessId=${businessId}`
				);
				throw new VerificationApiError(`Below minimum threshold for businessId=${businessId}`);
			}

			// setting task as in-progress
			await this.updateTaskStatus(taskId, TASK_STATUS.IN_PROGRESS);

			logger.info(
				`Matching NPI data for taskId=${taskId} and npiId=${task.metadata.match.npi} and caseId=${caseId} and businessId=${businessId}`
			);
			await this.saveRequestResponse(task, { task, match: task.metadata }, task.metadata.match.npi);

			// fetch the NPI data
			let providerResult = await NPI.getProviderInfoByBusinessId(businessId);

			if (providerResult) {
				logger.info(`NPI match already exists for caseId=${caseId}, updating record`);
				// update the existing record with new data
				providerResult.business_integration_task_id = taskId;
				providerResult.is_matched = true;
				providerResult.provider_first_name = task.metadata.match.first_name;
				providerResult.provider_last_name = task.metadata.match.last_name;
				providerResult.submitted_npi = task.metadata.match.npi;
				providerResult.employer_identification_number = task.metadata.match.employer_identification_number;
				providerResult.provider_organization_name = task.metadata.match.name;
				providerResult.is_sole_proprietor = task.metadata.match.is_sole_proprietor === "Y";
				providerResult.updated_at = task.metadata.match.last_update_date;
				providerResult.provider_middle_name = task.metadata.match.authorized_official_middle_name;
				providerResult.provider_credential_text = task.metadata.match.authorized_official_credential_text;
				providerResult.metadata = {
					"source": "reverse_lookup",
					...task.metadata.match.row
				};


				await this.saveResultToDB(providerResult);
				return true;
			}
			logger.info(`No existing NPI match for businessId=${businessId}, creating new record`);
			let newRecord: NPIMatchRecord = {
				business_id: businessId,
				business_integration_task_id: taskId,
				case_id: caseId,
				submitted_npi: task.metadata.match.npi,
				is_matched: true,
				provider_first_name: task.metadata.match.first_name,
				provider_last_name: task.metadata.match.last_name,
				provider_organization_name: task.metadata.match.name,
				employer_identification_number: task.metadata.match.employer_identification_number,
				is_sole_proprietor: task.metadata.match.is_sole_proprietor === "Y",
				updated_at: task.metadata.match.last_update_date,
				provider_middle_name: task.metadata.match.authorized_official_middle_name,
				provider_credential_text: task.metadata.match.authorized_official_credential_text,
				metadata: { 
					source: "reverse_lookup",
					...task.metadata.match.row
				}
			};

			const saveResult = await this.saveResultToDB(newRecord);

			if (!saveResult) {
				throw new Error(`DB Error: failed to save the NPI match result businessId=${businessId}`);
			}

			logger.info(`NPI match saved for npiId=${task.metadata.match.npi}, businessId=${businessId}`);
			await this.updateTaskStatus(taskId, TASK_STATUS.SUCCESS);

			return true;
			


		} catch (error) {
			logger.error({ error }, "Error fetching NPI Data");
			await this.updateTaskStatus(
				taskId,
				TASK_STATUS.FAILED,
				error instanceof Error ? error : new Error(error as string)
			);
			throw error;
		}
	};

	// case management currently only uses the business id to fetch the provider match,
	// but in the future, it will use the case id as well.
	public fetchProviderMatch = async (businessId?: string, caseId?: string): Promise<NPIMatchRecord | null> => {
		try {
			let record: NPIMatchRecord | undefined;
			// Try caseId first, then fallback to businessId if no record found
			record = caseId ? await this.getProviderInfoByCaseId(caseId) : undefined;
			if (!record && businessId) {
				record = await NPI.getProviderInfoByBusinessId(businessId);
			}

			if (record) {
				// filter the null values from the record for a smaller payload size
				Object.keys(record).forEach(key => record[key] === null && delete record[key]);
				// filter the null values from the metadata for a smaller payload size
				if (record?.metadata) {
					Object.keys(record.metadata || {}).forEach(
						key => record.metadata![key] === null && delete record.metadata![key]
					);
				}
				return record;
			}

			logger.debug(`No NPI match found for business id=${businessId}`);
			return null;
		} catch (error) {
			logger.error({ error }, "Error fetching NPI Data");
			throw error;
		}
	};

	public getProviderInfoByTaskId = async (TaskId: UUID): Promise<NPIMatchRecord | undefined> => {
		const result = await db<NPIMatchRecord>("integration_data.healthcare_provider_information")
			.where({ business_integration_task_id: TaskId })
			.orderBy("created_at", "desc")
			.first();
		return result;
	};
	// Breaking this out to its own query function.
	// It's simple for now, but matching will be more complex in the near future
	private buildSearchQuery(npiId: string): string {
		const query = `SELECT * from npi.records WHERE npi = '${npiId}'`;
		return query;
	}

	public saveResultToDB = async (result: NPIMatchRecord) => {
		logger.debug({ result }, "Saving NPI match result");
		try {
			const upsertResult = await db<NPIMatchRecord>("integration_data.healthcare_provider_information")
				.insert(result)
				.onConflict("business_integration_task_id")
				.merge()
				.returning("*");

			if (upsertResult.length < 1) {
				logger.error({ result }, "Error saving NPI match result");
				return false;
			}
			return true;
		} catch (error) {
			logger.error({ error, result }, "Error saving NPI match result");
			return false;
		}
	};

	public static getProviderInfoByBusinessId = async (businessId: string): Promise<NPIMatchRecord | undefined> => {
		const result = await db<NPIMatchRecord>("integration_data.healthcare_provider_information")
			.where({ business_id: businessId })
			.orderBy("created_at", "desc")
			.first();
		return result;
	};

	private getProviderInfoByCaseId = async (caseId: string): Promise<NPIMatchRecord | undefined> => {
		const result = await db<NPIMatchRecord>("integration_data.healthcare_provider_information")
			.where({ case_id: caseId })
			.orderBy("created_at", "desc")
			.first();
		return result;
	};

	private mapResultToRecord = (
		record: NPIMatchResult,
		taskId: string,
		businessId: string,
		caseId: string
	): NPIMatchRecord => {
		return {
			submitted_npi: record.npi,
			business_id: businessId,
			is_matched: true,
			case_id: caseId,
			business_integration_task_id: taskId,
			employer_identification_number: record["employer identification number (ein)"],
			provider_organization_name: record["provider organization name (legal business name)"],
			is_sole_proprietor: record["is sole proprietor"] === "Y",
			updated_at: record["last update date"],
			provider_gender_code: record["provider gender code"],
			provider_first_name: record["provider first name"],
			provider_middle_name: record["provider middle name"],
			provider_last_name: record["provider last name (legal name)"],
			provider_credential_text: record["provider credential text"],
			metadata: { ...record }
		};
	};
}
