import { fetchTaxFilings, updateTask, uploadRawIntegrationDataToS3 } from "#common/common";
import {
	CONNECTION_STATUS,
	DIRECTORIES,
	INTEGRATION_STATUS,
	TAX_STATUS_ENDPOINTS,
	ALLOWED_TAX_FORMS,
	kafkaEvents,
	kafkaTopics,
	TASK_STATUS,
	ERROR_CODES,
	WEBHOOK_EVENTS,
	INTEGRATION_TASK,
	INTEGRATION_ID,
	FORM_TO_FORM_TYPE_MAPPING,
	BUSINESS_QUARTERLY_FORMS,
	INDIVIDUAL_QUARTERLY_FORMS
} from "#constants";
import {
	sqlQuery,
	sqlTransaction,
	taxApi,
	producer,
	getBusinessDetailsForTaxConsent,
	logger,
	sqlSequencedTransaction,
	getOrCreateConnection,
	setApplicationEditData,
	extractEdits,
	getApplicationEdit
} from "#helpers/index";
import { buildInsertQuery } from "#utils/queryBuilder";
import { getCachedSignedUrl, getPeriodDay, parseFloatNum } from "#utils/index";
import { envConfig } from "#configs/index";
import {
	GetTaxFilingsParams,
	GetTaxStatsParams,
	GetTaxStatsQuery,
	TaskFilings,
	TaxFilingDataFetchParams,
	TaxFilingDataFetchQueryParams,
	GetTaxFilingsQuery,
	AddTaxFilingBody,
	OcrTaxFiling,
	TransformedOcrTaxFiling,
	ManualTaxFiling
} from "./types";
import { IDBConnection, SqlQueryResult } from "#types/db";
import { TaxationApiError } from "./error";
import { StatusCodes } from "http-status-codes";
import { db } from "#helpers/knex";
import { UUID } from "crypto";
import { sendWebhookEvent, triggerSectionCompletedKafkaEventWithRedis } from "#common/index";
import dayjs from "dayjs";
import { UserInfo } from "#types/common";

class Taxation {
	/**
	 * Retrieves tax filings based on the provided parameters. Priority given to Manual Tax filing then Tax Status
	 *
	 * @param {Object} params - The parameters for retrieving tax filings.
	 * @param {string} params.caseID - The ID of the case.`
	 * @param {string} [params.formType] - The type of the tax form. Defaults to an empty string.
	 * @returns {Promise<Object>} - A promise that resolves to an object containing the tax filings data and additional information.
	 * @throws {Error} - If an error occurs while retrieving the tax filings.
	 */
	async getTaxFilings(params: GetTaxFilingsParams, query: GetTaxFilingsQuery) {
		try {
			let getTaxFilingTasksQuery = "";
			let getTaxFilingTasksQueryValues: any[] = [];
			if (Object.hasOwn(query, "score_trigger_id")) {
				getTaxFilingTasksQuery = `SELECT dbit.id, dbit.task_status, dbit.metadata, rti.task_category_id FROM integrations.data_business_integrations_tasks dbit
					INNER JOIN integrations.business_score_triggers bst ON bst.id = dbit.business_score_trigger_id
					INNER JOIN integrations.rel_tasks_integrations rti ON rti.id = dbit.integration_task_id
					WHERE bst.id = $1
					AND rti.task_category_id IN ($2, $3)
					ORDER BY dbit.created_at DESC`;

				getTaxFilingTasksQueryValues = [
					query.score_trigger_id,
					INTEGRATION_TASK.fetch_tax_filings,
					INTEGRATION_TASK.manual_tax_filing
				];
			} else if (Object.hasOwn(query, "caseID")) {
				getTaxFilingTasksQuery = `SELECT dbit.id, dbit.task_status, dbit.metadata, rti.task_category_id FROM integrations.data_business_integrations_tasks dbit
					INNER JOIN data_cases ON data_cases.score_trigger_id = dbit.business_score_trigger_id
					INNER JOIN integrations.rel_tasks_integrations rti ON rti.id = dbit.integration_task_id
					WHERE data_cases.id = $1
					AND rti.task_category_id IN ($2, $3)
					ORDER BY dbit.created_at DESC`;

				getTaxFilingTasksQueryValues = [
					query.caseID,
					INTEGRATION_TASK.fetch_tax_filings,
					INTEGRATION_TASK.manual_tax_filing
				];
			} else if (Object.hasOwn(params, "businessID")) {
				getTaxFilingTasksQuery = `SELECT dbit.id, dbit.task_status, dbit.metadata, rti.task_category_id FROM integrations.data_business_integrations_tasks dbit
					INNER JOIN integrations.data_connections dc ON dc.id = dbit.connection_id
					INNER JOIN integrations.rel_tasks_integrations rti ON rti.id = dbit.integration_task_id
					WHERE dc.business_id = $1
					AND rti.task_category_id IN ($2, $3)
					ORDER BY dbit.created_at DESC`;

				getTaxFilingTasksQueryValues = [
					params.businessID,
					INTEGRATION_TASK.fetch_tax_filings,
					INTEGRATION_TASK.manual_tax_filing
				];
			}

			const getTaxFilingTasksResult: SqlQueryResult = await sqlQuery({
				sql: getTaxFilingTasksQuery,
				values: getTaxFilingTasksQueryValues
			});
			const manualTaxFilingTasks = getTaxFilingTasksResult.rows.filter(
				row => row.task_category_id === INTEGRATION_TASK.manual_tax_filing && row.task_status === TASK_STATUS.SUCCESS
			);
			// If manual tax filing task is successful, return the data
			const alreadyExistPeriods = new Set();
			let manualTaskFilingResult = await Promise.all(
				manualTaxFilingTasks.map(async manualTaxFilingTask => {
					if (manualTaxFilingTask?.id) {
						const manualTaxFiling = await this._getTaxFilingByTaskID(manualTaxFilingTask.id);
						if (manualTaxFiling[0]?.period && !alreadyExistPeriods.has(manualTaxFiling[0]?.period)) {
							let metadata = { ...manualTaxFilingTask.metadata };

							if (metadata?.ocr_document) {
								metadata.ocr_document = await Promise.all(
									metadata.ocr_document
										.filter(doc => doc.file_name && doc.file_path)
										.map(async doc => ({
											...doc,
											file: await getCachedSignedUrl(doc.file_name, doc.file_path)
										}))
								);
							}
							alreadyExistPeriods.add(manualTaxFiling[0]?.period);
							return { ...manualTaxFiling[0], metadata };
						}
					}
					return null;
				})
			);

			if (manualTaskFilingResult.length) {
				manualTaskFilingResult = manualTaskFilingResult.filter(item => item !== null);
				// Note: For backward compatibility added tax status details to the response
				// TODO: remove tax status details from the response when we are sure that the FE is not using it
				const taxStatusTask = getTaxFilingTasksResult.rows.find(
					row => row.task_category_id === INTEGRATION_TASK.fetch_tax_filings
				);
				const taxStatusTaskDetails = this._getIrsStatusAndConsentProvidedUtil(taxStatusTask?.task_status);

				const applicationEdit = await getApplicationEdit(params.businessID, { stage_name: "tax_filing" });
				const guestOwnerEdit =
					Array.isArray(applicationEdit?.data) && applicationEdit.data.length
						? [...new Set(applicationEdit.data.map(record => record.field_name))]
						: undefined;
				// transform the response to the required format
				const transformedTaxFiling = this._transformOcrTaxFilingUtil(manualTaskFilingResult as TaskFilings[]);
				return {
					data: {
						...transformedTaxFiling,
						irs_status: taxStatusTaskDetails.irsStatus,
						is_consent_provided: taxStatusTaskDetails.isConsentProvided,
						guest_owner_edits: guestOwnerEdit
					},
					message: "success"
				};
			}

			// If no manual tax filing task is successful, try to fetch tax filings from EConsent
			const connection: IDBConnection = await getOrCreateConnection(
				params.businessID as UUID,
				INTEGRATION_ID.ELECTRONIC_SIGNATURE
			);
			if (connection.connection_status === CONNECTION_STATUS.SUCCESS) {
				const fileName = `${params.businessID}/${connection.configuration.documentId}`;
				const file = await getCachedSignedUrl(
					fileName,
					DIRECTORIES.ELECTRONIC_CONSENT,
					envConfig.AWS_ELECTRONIC_CONSENT_BUCKET
				);

				return {
					data: { consent_file: { ...file, fileName: "Form 8821.pdf" } },
					message: "Consent file fetched successfully"
				};
			}

			// fallback to the tax status tax filing
			const response = await this._getTaxFilingsFromTaxStatus(params, query);

			return response;
		} catch (error) {
			throw error;
		}
	}

	async getIRSEsignDocument(businessID: UUID) {
		const connection: IDBConnection = await getOrCreateConnection(businessID, INTEGRATION_ID.ELECTRONIC_SIGNATURE);

		if (connection.connection_status === CONNECTION_STATUS.SUCCESS) {
			const fileName = `${businessID}/${connection.configuration.documentId}`;
			const file = await getCachedSignedUrl(
				fileName,
				DIRECTORIES.ELECTRONIC_CONSENT,
				envConfig.AWS_ELECTRONIC_CONSENT_BUCKET
			);

			return {
				data: { consent_file: file },
				message: "Consent file fetched successfully"
			};
		}

		return {
			data: null,
			message: "No consent file found"
		};
	}

	/**
	 * @deprecated We don't use Tax Status for tax filing but it is being used as fallback for existing businesses
	 * @description Retrieves tax filings based on the provided parameters.
	 * @param {Object} params - The parameters for retrieving tax filings.
	 * @param {string} params.caseID - The ID of the case.`
	 * @param {string} [params.formType] - The type of the tax form. Defaults to an empty string.
	 * @returns {Promise<Object>} - A promise that resolves to an object containing the tax filings data and additional information.
	 * @throws {Error} - If an error occurs while retrieving the tax filings.
	 */
	private async _getTaxFilingsFromTaxStatus(params: GetTaxFilingsParams, query: GetTaxFilingsQuery) {
		try {
			const formType = params.formType || "";
			let finalFormType = "RETR";
			if (formType && formType !== ":formType") {
				finalFormType = formType;
			}
			// TODO: Handle check for customerID in token === customerID of the case

			let getTaxFilingTasksQuery = "";
			let getTaxFilingTasksQueryValues: any[] = [];
			if (Object.hasOwn(query, "score_trigger_id")) {
				getTaxFilingTasksQuery = `SELECT integrations.data_business_integrations_tasks.id FROM integrations.data_business_integrations_tasks
					LEFT JOIN data_cases ON data_cases.score_trigger_id = integrations.data_business_integrations_tasks.business_score_trigger_id
					LEFT JOIN integrations.data_connections dc ON dc.id = integrations.data_business_integrations_tasks.connection_id
					WHERE data_cases.score_trigger_id = $1
					AND dc.platform_id = (
							SELECT id
							FROM integrations.core_integrations_platforms
							WHERE code = $2
						)`;

				getTaxFilingTasksQueryValues = [query.score_trigger_id, "tax_status"];
			} else if (Object.hasOwn(query, "caseID")) {
				getTaxFilingTasksQuery = `SELECT integrations.data_business_integrations_tasks.id FROM integrations.data_business_integrations_tasks
					LEFT JOIN data_cases ON data_cases.score_trigger_id = integrations.data_business_integrations_tasks.business_score_trigger_id
					LEFT JOIN integrations.data_connections dc ON dc.id = integrations.data_business_integrations_tasks.connection_id
					WHERE data_cases.id = $1
					AND dc.platform_id = (
							SELECT id
							FROM integrations.core_integrations_platforms
							WHERE code = $2
						)`;

				getTaxFilingTasksQueryValues = [query.caseID, "tax_status"];
			} else if (Object.hasOwn(params, "businessID")) {
				getTaxFilingTasksQuery = `SELECT dbit.id FROM integrations.data_connections dc
					LEFT JOIN integrations.data_business_integrations_tasks dbit ON dbit.connection_id = dc.id
					WHERE dc.business_id = $1
					AND dc.platform_id = (
							SELECT id
							FROM integrations.core_integrations_platforms
							WHERE code = $2
						)
					AND dbit.id = (
							SELECT id
							FROM integrations.data_business_integrations_tasks
							WHERE connection_id = dc.id
							ORDER BY created_at DESC
							LIMIT 1
						)`;

				getTaxFilingTasksQueryValues = [params.businessID, "tax_status"];
			}
			const getTaxFilingTasksResult: SqlQueryResult = await sqlQuery({
				sql: getTaxFilingTasksQuery,
				values: getTaxFilingTasksQueryValues
			});

			if (!getTaxFilingTasksResult.rows.length) {
				return {
					data: { irs_status: "NOT_STARTED" },
					message: "No Tax Filings Found"
				};
			}

			// TODO: check for customer_id

			const integrationTaskIDs = getTaxFilingTasksResult.rows.map(row => row.id);
			const getTaskFilingsQuery = `SELECT * FROM integration_data.tax_filings 
				WHERE integration_data.tax_filings.business_integration_task_id IN ('${integrationTaskIDs.join("','")}')
				AND version = (
					SELECT MAX(version) as version FROM integration_data.tax_filings 
					WHERE integration_data.tax_filings.business_integration_task_id = $1
				)`;

			const getTaskStatusQuery = `SELECT task_status FROM integrations.data_business_integrations_tasks WHERE integrations.data_business_integrations_tasks.id = $1`;

			const getTaskStatusResult: SqlQueryResult = await sqlQuery({
				sql: getTaskStatusQuery,
				values: [integrationTaskIDs[0]]
			});
			let irsStatus, isConsentProvided;
			if (getTaskStatusResult && getTaskStatusResult.rows[0]) {
				const taskStatus = getTaskStatusResult.rows[0].task_status;
				if (taskStatus === "INITIALIZED") {
					return {
						data: {
							annual_data: [],
							is_consent_provided: true,
							irs_status: "PENDING",
							version: 0
						},
						message: "success"
					};
				}
				switch (taskStatus) {
					case "CREATED":
						irsStatus = "NOT_STARTED";
						isConsentProvided = false;
						break;
					case "INITIALIZED":
						irsStatus = "PENDING";
						isConsentProvided = true;
						break;
					case "SUCCESS":
						irsStatus = "COMPLETED";
						isConsentProvided = true;
						break;
					case "FAILED":
						irsStatus = "REJECTED";
						isConsentProvided = true;
						break;
					default:
						break;
				}
			}
			const getTaskFilingsResult: SqlQueryResult = await sqlQuery({
				sql: getTaskFilingsQuery,
				values: [integrationTaskIDs[0]]
			});

			if (!getTaskFilingsResult.rows.length) {
				// connection exists but data is not pulled yet or it failed to pull the data
				//  Do we need to Add getLastStatus call and return response based on the status of the business
				//  TODO : await taxStatus.getLastStatus();

				return {
					data: { irs_status: "NOT_STARTED" },
					message: "No Tax Filings Found"
				};
			}

			const taxStatusResponse: TaskFilings[] = getTaskFilingsResult.rows;
			const quarterlyData: any[] = [];
			const lastMonthsOfQuarter = [3, 6, 9, 12];
			const quaterCoveredMap: any[] = [];
			/**
			 * Filtering the data based on the form(941) for quarterlyData
			 * and creating array to send to FE
			 */
			taxStatusResponse.forEach(element => {
				const periodMonth = parseInt(element.period.toString().substring(4, 6));
				if (
					element.form === ALLOWED_TAX_FORMS["941"] &&
					lastMonthsOfQuarter.includes(periodMonth) &&
					!quaterCoveredMap.includes(element.period)
				) {
					const newDataObj = {
						periodYear: parseInt(element.period.toString().substring(0, 4)),
						periodMonth: parseInt(element.period.toString().substring(4, 6)),
						form: element.form,
						form_type: element.form_type,
						interest: element.interest,
						interest_date: element.interest_date,
						penalty: element.penalty,
						penalty_date: element.penalty_date,
						filed_date: element.filed_date,
						balance: element.balance,
						tax_period_ending_date: element.tax_period_ending_date,
						amount_filed: element.amount_filed
					};
					quarterlyData.push(newDataObj);
					quaterCoveredMap.push(element.period);
				}
			});

			const annualAggregateMapping = {};
			const businessType = getTaskFilingsResult.rows[0].business_type;
			taxStatusResponse.forEach(row => {
				const period = parseInt(row.period.toString().substring(0, 4));
				/**
				 * Mapping data based on the period and form(1120) for annualData
				 * and also checking the business type to map the data
				 */
				if (!Object.hasOwn(annualAggregateMapping, period)) {
					if (businessType === "INDIVIDUAL" && row.form_type === finalFormType) {
						annualAggregateMapping[period] = {
							period,
							business_type: businessType,
							adjusted_gross_income: row.adjusted_gross_income ? parseInt(row.adjusted_gross_income) : 0,
							total_income: row.total_income ? parseInt(row.total_income) : 0,
							irs_balance: row.irs_balance ? parseInt(row.irs_balance) : 0,
							lien_balance: row.lien_balance ? parseInt(row.lien_balance) : 0
						};
					} else if (
						businessType === "BUSINESS" &&
						row.form_type === finalFormType &&
						row.form === ALLOWED_TAX_FORMS["1120"]
					) {
						annualAggregateMapping[period] = {
							period,
							business_type: businessType,
							total_sales: row.total_sales ? parseInt(row.total_sales) : 0,
							total_compensation: row.total_compensation ? parseInt(row.total_compensation) : 0,
							total_wages: row.total_wages ? parseInt(row.total_wages) : 0,
							irs_balance: row.irs_balance ? parseInt(row.irs_balance) : 0,
							lien_balance: row.lien_balance ? parseInt(row.lien_balance) : 0,
							cost_of_goods_sold: row.cost_of_goods_sold ? parseInt(row.cost_of_goods_sold) : 0
						};
					}
				} else if (businessType === "INDIVIDUAL" && row.form_type === finalFormType) {
					annualAggregateMapping[period].adjusted_gross_income += row.adjusted_gross_income
						? parseInt(row.adjusted_gross_income)
						: 0;
					annualAggregateMapping[period].total_income += row.total_income ? parseInt(row.total_income) : 0;
					annualAggregateMapping[period].irs_balance += row.irs_balance ? parseInt(row.irs_balance) : 0;
					annualAggregateMapping[period].lien_balance += row.lien_balance ? parseInt(row.lien_balance) : 0;
				} else if (
					businessType === "BUSINESS" &&
					row.form_type === finalFormType &&
					row.form === ALLOWED_TAX_FORMS["1120"]
				) {
					annualAggregateMapping[period].total_sales += row.total_sales ? parseInt(row.total_sales) : 0;
					annualAggregateMapping[period].total_compensation += row.total_compensation
						? parseInt(row.total_compensation)
						: 0;
					annualAggregateMapping[period].total_wages += row.total_wages ? parseInt(row.total_wages) : 0;
					annualAggregateMapping[period].irs_balance += row.irs_balance ? parseInt(row.irs_balance) : 0;
					annualAggregateMapping[period].lien_balance += row.lien_balance ? parseInt(row.lien_balance) : 0;
					annualAggregateMapping[period].cost_of_goods_sold += row.cost_of_goods_sold
						? parseInt(row.cost_of_goods_sold)
						: 0;
				}
			});
			const annualData: any = Object.values(annualAggregateMapping);
			const groups = {};
			quarterlyData.forEach(employee => {
				const { periodYear } = employee;
				if (!groups[periodYear]) {
					groups[periodYear] = [];
				}
				groups[periodYear].push(employee);
			});
			if (businessType === "BUSINESS") {
				annualData.forEach(element => {
					const { period } = element;
					if (groups[period]) {
						element.quarterlyData = groups[period];
					}
				});
			}
			return {
				data: {
					annual_data: annualData,
					is_consent_provided: isConsentProvided,
					irs_status: irsStatus,
					version: taxStatusResponse[0].version
				},
				message: "success"
			};
		} catch (error) {
			throw error;
		}
	}

	/**
	 * @description This function will fetch the tax filing data from the database
	 * @param {UUID} taskID : id of the task
	 * @returns
	 */
	private async _getTaxFilingByTaskID(taskID: UUID): Promise<TaskFilings[]> {
		const getTaskFilingsQuery = `SELECT tf.*,
			(
				SELECT uod.file_name
				FROM integrations.data_business_integrations_tasks dbit 
				JOIN integrations.data_connections dc ON dc.id = dbit.connection_id
				JOIN integration_data.uploaded_ocr_documents uod ON uod.business_id = dc.business_id
				WHERE dbit.id = $1
				AND uod.job_type = $2
				ORDER BY uod.created_at DESC 
				OFFSET 1 LIMIT 1
			) as file_name
			FROM integration_data.tax_filings tf
			JOIN (
				SELECT business_integration_task_id, MAX(version) as max_version 
				FROM integration_data.tax_filings 
				WHERE business_integration_task_id = $3
				GROUP BY business_integration_task_id
			) latest_tf
			ON tf.business_integration_task_id = latest_tf.business_integration_task_id
			AND tf.version = latest_tf.max_version`;

		const getTaskFilingsResult: SqlQueryResult = await sqlQuery({
			sql: getTaskFilingsQuery,
			values: [taskID, "extraction", taskID]
		});

		return getTaskFilingsResult.rows;
	}

	/**
	 * @description Transforms data from tax filing to the required format for FE
	 * @param {TaskFilings[]} taxStatusResponse : rows of the tax filing data queried on tax_filings table
	 * @returns
	 */
	private _transformOcrTaxFilingUtil(taxStatusResponse: TaskFilings[]) {
		if (taxStatusResponse?.length === 0) {
			return {
				annual_data: [],
				version: 0
			};
		}
		const quarterlyData: any[] = [];
		const lastMonthsOfQuarter = [3, 6, 9, 12];
		const quarterlyCoveredMap: any[] = [];
		/**
		 * Filtering the data based on the quarterly forms for quarterlyData
		 * and creating array to send to FE
		 */
		taxStatusResponse.forEach(element => {
			const periodMonth = this._getTaxQuarterMonth(parseInt(element.period.toString().substring(4, 6)));
			if (
				[...Object.values(BUSINESS_QUARTERLY_FORMS), ...Object.values(INDIVIDUAL_QUARTERLY_FORMS)].includes(
					element.form
				) &&
				lastMonthsOfQuarter.includes(periodMonth) &&
				!quarterlyCoveredMap.includes(element.period)
			) {
				const newDataObj = {
					periodYear: parseInt(element.period.toString().substring(0, 4)),
					periodMonth: parseInt(element.period.toString().substring(4, 6)),
					form: element.form,
					form_type: element.form_type,
					interest: element.interest,
					interest_date: element.interest_date,
					penalty: element.penalty,
					penalty_date: element.penalty_date,
					filed_date: element.filed_date,
					balance: element.balance,
					tax_period_ending_date: element.tax_period_ending_date,
					amount_filed: element.amount_filed,
					metadata: element.metadata ? element.metadata : {}
				};
				quarterlyData.push(newDataObj);
				quarterlyCoveredMap.push(element.period);
			}
		});

		const annualAggregateMapping = {};
		const businessType = taxStatusResponse[0].business_type;
		// TODO: Please check trustiness of the below code. It is copy pasted from existing and removing the hardcoded form check
		taxStatusResponse.forEach(row => {
			const period = parseInt(row.period.toString().substring(0, 4));
			if (!Object.hasOwn(annualAggregateMapping, period)) {
				if (businessType === "INDIVIDUAL") {
					annualAggregateMapping[period] = {
						period,
						business_type: businessType,
						adjusted_gross_income: row.adjusted_gross_income ? parseInt(row.adjusted_gross_income) : 0,
						total_income: row.total_income ? parseInt(row.total_income) : 0,
						irs_balance: row.irs_balance ? parseInt(row.irs_balance) : 0,
						lien_balance: row.lien_balance ? parseInt(row.lien_balance) : 0,
						metadata: row.metadata ? row.metadata : {}
					};
				} else if (businessType === "BUSINESS") {
					annualAggregateMapping[period] = {
						period,
						form: ALLOWED_TAX_FORMS["1120"] === row.form ? row.form : null,
						filed_date: ALLOWED_TAX_FORMS["1120"] === row.form ? row.filed_date : null,
						business_type: businessType,
						total_sales: row.total_sales ? parseInt(row.total_sales) : 0,
						total_compensation: row.total_compensation ? parseInt(row.total_compensation) : 0,
						total_wages: row.total_wages ? parseInt(row.total_wages) : 0,
						irs_balance: row.irs_balance ? parseInt(row.irs_balance) : 0,
						lien_balance: row.lien_balance ? parseInt(row.lien_balance) : 0,
						cost_of_goods_sold: row.cost_of_goods_sold ? parseInt(row.cost_of_goods_sold) : 0,
						metadata: row.metadata ? row.metadata : {}
					};
				}
			} else if (businessType === "INDIVIDUAL") {
				annualAggregateMapping[period].adjusted_gross_income += row.adjusted_gross_income
					? parseInt(row.adjusted_gross_income)
					: 0;
				annualAggregateMapping[period].total_income += row.total_income ? parseInt(row.total_income) : 0;
				annualAggregateMapping[period].irs_balance += row.irs_balance ? parseInt(row.irs_balance) : 0;
				annualAggregateMapping[period].lien_balance += row.lien_balance ? parseInt(row.lien_balance) : 0;
			} else if (businessType === "BUSINESS") {
				annualAggregateMapping[period].total_sales += row.total_sales ? parseInt(row.total_sales) : 0;
				annualAggregateMapping[period].total_compensation += row.total_compensation
					? parseInt(row.total_compensation)
					: 0;
				annualAggregateMapping[period].total_wages += row.total_wages ? parseInt(row.total_wages) : 0;
				annualAggregateMapping[period].irs_balance += row.irs_balance ? parseInt(row.irs_balance) : 0;
				annualAggregateMapping[period].lien_balance += row.lien_balance ? parseInt(row.lien_balance) : 0;
				annualAggregateMapping[period].cost_of_goods_sold += row.cost_of_goods_sold
					? parseInt(row.cost_of_goods_sold)
					: 0;
			}
		});
		const annualData: any = Object.values(annualAggregateMapping);
		const groups = {};
		quarterlyData.forEach(employee => {
			const { periodYear } = employee;
			if (!groups[periodYear]) {
				groups[periodYear] = [];
			}
			groups[periodYear].push(employee);
		});
		if (quarterlyData.length) {
			annualData.forEach(element => {
				const { period } = element;
				if (groups[period]) {
					element.quarterlyData = groups[period];
				}
			});
		}
		return {
			annual_data: annualData,
			version: taxStatusResponse[0].version
		};
	}

	/**
	 * @description This util function return the IRS status and consent provided status based on the task status
	 * @param taskStatus: status of the TaxStatus platform task for fetch tax filing
	 * @returns
	 */
	private _getIrsStatusAndConsentProvidedUtil(taskStatus: string | undefined) {
		const data = {
			irsStatus: "NOT_STARTED",
			isConsentProvided: false
		};
		switch (taskStatus) {
			case "CREATED":
				data.irsStatus = "NOT_STARTED";
				data.isConsentProvided = false;
				break;
			case "INITIALIZED":
				data.irsStatus = "PENDING";
				data.isConsentProvided = true;
				break;
			case "SUCCESS":
				data.irsStatus = "COMPLETED";
				data.isConsentProvided = true;
				break;
			case "FAILED":
				data.irsStatus = "REJECTED";
				data.isConsentProvided = true;
				break;
			default:
				break;
		}

		return data;
	}

	/**
	 * @description This util function will transform the month to its quarter month
	 * @param {number} month: The month for which the quarter month is to be calculated.
	 * @returns quarter month ie 3, 6, 9, or 12
	 */
	private _getTaxQuarterMonth(month: number) {
		const lastMonthsOfQuarter = [3, 6, 9, 12];
		const quarterMonth = lastMonthsOfQuarter.reverse().find(lastMonth => month <= lastMonth);
		return quarterMonth || 12;
	}

	/**
	 * Retrieves tax statistics based on the provided parameters.
	 *
	 * @param {Object} params - The parameters for retrieving tax statistics.
	 * @param {string} params.caseID - The ID of the case.
	 * @returns {Promise<Object>} - A promise that resolves to an object containing tax statistics.
	 * @throws {Error} - If an error occurs while retrieving tax statistics.
	 */
	async getTaxStats(params: GetTaxStatsParams, query: GetTaxStatsQuery) {
		try {
			let period = "yearly";
			if (Object.hasOwn(query, "period")) {
				period = query.period;
			}

			const getTaxFilingTasksQuery = `SELECT dbit.id FROM integrations.data_connections dc
				LEFT JOIN integrations.data_business_integrations_tasks dbit ON dbit.connection_id = dc.id
				WHERE dc.business_id = $1
				AND dc.platform_id = (
						SELECT id
						FROM integrations.core_integrations_platforms
						WHERE code = $2
					)
				AND dbit.id = (
						SELECT id
						FROM integrations.data_business_integrations_tasks
						WHERE connection_id = dc.id
						ORDER BY created_at DESC
						LIMIT 1
					)`;

			const getTaxFilingTasksResult: SqlQueryResult = await sqlQuery({
				sql: getTaxFilingTasksQuery,
				values: [params.businessID, "tax_status"]
			});

			if (!getTaxFilingTasksResult.rows.length) {
				return {
					data: {},
					message: "No Tax Filings Found"
				};
			}
			if (getTaxFilingTasksResult.rows.length) {
				if (getTaxFilingTasksResult.rows[0].task_status === "INITIALIZED") {
					return {
						data: {
							sales_records: {},
							wages_records: {},
							version: 0
						},
						message: "success"
					};
				}
			}

			const integrationTaskIDs = getTaxFilingTasksResult.rows.map(row => row.id);

			const getTaskFilingsQuery = `SELECT * FROM integration_data.tax_filings WHERE integration_data.tax_filings.business_integration_task_id IN ('${integrationTaskIDs.join("','")}')
				AND version = (
					SELECT MAX(version) as version FROM integration_data.tax_filings 
					WHERE integration_data.tax_filings.business_integration_task_id = $1
				)`;
			const getTaskFilingsResult: SqlQueryResult = await sqlQuery({
				sql: getTaskFilingsQuery,
				values: [integrationTaskIDs[0]]
			});
			if (!getTaskFilingsResult.rows.length) {
				return {
					data: {},
					message: "No Tax Filings Found"
				};
			}

			const taxStatusResponse: TaskFilings[] = getTaskFilingsResult.rows;
			const salesData: any[] = [];
			const wagesData: any[] = [];
			taxStatusResponse.forEach(element => {
				if (parseInt(element.total_sales) && element.form_type === "RETR") {
					const newObj = {
						periodYear: parseInt(element.period.toString().substring(0, 4)),
						periodMonth: parseInt(element.period.toString().substring(4, 6)),
						totalSales: parseInt(element.total_sales),
						formType: element.form_type
					};
					salesData.push(newObj);
				}
				if (parseInt(element.total_wages) && element.form_type === "RETR") {
					const newObj = {
						periodYear: parseInt(element.period.toString().substring(0, 4)),
						periodMonth: parseInt(element.period.toString().substring(4, 6)),
						totalWages: parseInt(element.total_wages),
						formType: element.form_type
					};
					wagesData.push(newObj);
				}
			});
			let salesGroups = {};
			let wagesGroups = {};

			if (period === "yearly") {
				// data for last 5 years
				for (let i = 0; i < 5; i++) {
					const element = new Date().getFullYear() - i;
					salesGroups[element] = 0;
					wagesGroups[element] = 0;
				}
			}

			salesData.forEach(data => {
				const { periodYear, periodMonth } = data;
				switch (period) {
					case "quartely": {
						if (!salesGroups[periodYear]) {
							salesGroups[periodYear] = {
								"3": [],
								"6": [],
								"9": [],
								"12": []
							};
						}
						salesGroups[periodYear][periodMonth].push(data);
						break;
					}

					case "yearly": {
						if (!salesGroups[periodYear]) {
							salesGroups[periodYear] = 0;
						}
						salesGroups[periodYear] += parseFloatNum(data.totalSales);
						break;
					}

					default:
						throw new TaxationApiError(`Invalid period: ${period}`, StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
				}
			});
			wagesData.forEach(data => {
				const { periodYear, periodMonth } = data;
				switch (period) {
					case "quartely": {
						if (!wagesGroups[periodYear]) {
							wagesGroups[periodYear] = {
								"3": [],
								"6": [],
								"9": [],
								"12": []
							};
						}
						wagesGroups[periodYear][periodMonth].push(data);
						break;
					}

					case "yearly": {
						if (!wagesGroups[periodYear]) {
							wagesGroups[periodYear] = 0;
						}
						wagesGroups[periodYear] += parseFloatNum(data.totalWages);
						break;
					}

					default:
						throw new TaxationApiError(`Invalid period: ${period}`, StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
				}
			});

			return {
				data: {
					sales_records: salesGroups,
					wages_records: wagesGroups,
					version: taxStatusResponse[0].version
				},
				message: "success"
			};
		} catch (error) {
			throw error;
		}
	}

	/**
	 * Retrieves data for transcript details.
	 * @param item - The item object.
	 * @param apiObj - The API object.
	 * @returns An object containing the retrieved data for transcript details.
	 */
	async getDataForTranscriptDetails(item, apiObj, webhookID) {
		try {
			let interest = 0;
			let interestDate = "";
			let penalty = 0;
			let penaltyDate = "";
			let fileDate = "";
			let balance = 0;
			let taxPeriodEndingDate = "";
			let amountFiled = 0.0;
			let costOfGoodsSold = 0;

			if (item.Form === ALLOWED_TAX_FORMS["941"] || item.Form === ALLOWED_TAX_FORMS["1120"]) {
				const transcriptDetailsResponse = await taxApi.fetchTranscriptDetails(
					apiObj,
					TAX_STATUS_ENDPOINTS.TRANSCRIPTDETAIL,
					"tax_filings"
				);

				/**
				 * fetchTranscriptDetails function to get and save Cost of goods sold to the database for the Business Anual data
				 */
				if (
					transcriptDetailsResponse &&
					transcriptDetailsResponse.Message !== "Transcript not found" &&
					transcriptDetailsResponse.Data
				) {
					if (item.Form === ALLOWED_TAX_FORMS["941"]) {
						const periodYear = parseInt(item.Period.toString().substring(0, 4));
						const periodMonth = item.Period.toString().substring(4, 6);
						const periodDay = getPeriodDay(`${periodYear}-${periodMonth}-01`);

						if (Object.hasOwn(transcriptDetailsResponse.Data[0], "Transactions")) {
							for await (const transaction of transcriptDetailsResponse.Data[0].Transactions) {
								// TODO: check if 'Tax return filed' entry will be single or multiple
								if (transaction.Desc === "Tax return filed") {
									amountFiled += parseFloatNum(transaction.Amount);
									fileDate = transaction.Date;
								}
							}
						} else {
							logger.error(
								`Transactions not found for ${apiObj.tin} and taskID: ${webhookID}, response: ${JSON.stringify(transcriptDetailsResponse)}`
							);
						}

						// commenting and putting for reference
						// fileDate = transcriptDetailsResponse.Data[0].Summary.FileDate;
						balance = Object.hasOwn(transcriptDetailsResponse.Data[0].Summary, "Balance")
							? parseFloat(transcriptDetailsResponse.Data[0].Summary.Balance)
							: 0;
						taxPeriodEndingDate = `${periodYear}-${periodMonth}-${periodDay}`;
						const dataResponse = transcriptDetailsResponse.Data[0].DataValues;
						const interestIndex = dataResponse.findIndex(x => x.DataKey === "ACCRUED INTEREST");
						interestDate = dataResponse[interestIndex + 1].DataValue;

						const penaltyIndex = dataResponse.findIndex(x => x.DataKey === "ACCRUED PENALTY");
						penaltyDate = dataResponse[penaltyIndex + 1].DataValue;
						dataResponse.forEach(value => {
							switch (value.DataKey) {
								case "ACCRUED INTEREST":
									interest = Number(value.DataValue.replace(/[^0-9.-]+/gu, ""));
									break;
								case "ACCRUED PENALTY":
									penalty = Number(value.DataValue.replace(/[^0-9.-]+/gu, ""));
									break;
								default:
									break;
							}
						});
					} else if (item.Form === ALLOWED_TAX_FORMS["1120"]) {
						const dataResponse = transcriptDetailsResponse.Data[0].DataValues;
						dataResponse.forEach(value => {
							switch (value.DataKey) {
								case "COST OF GOODS SOLD":
									costOfGoodsSold = Number(value.DataValue.replace(/[^0-9.-]+/gu, ""));
									break;
								default:
									break;
							}
						});
					}
				}
			} else {
				logger.info(`Form not found for ${apiObj.tin} and taskID: ${webhookID}`);
			}
			return {
				interest,
				interestDate,
				penalty,
				penaltyDate,
				fileDate,
				balance,
				taxPeriodEndingDate,
				amountFiled,
				costOfGoodsSold
			};
		} catch (error) {
			logger.error(`Error in getDataForTranscriptDetails: ${error}`);
		}
	}

	/**
	 * Handles the webhook for tax status.
	 *
	 * @param {Object} body - The request body of the webhook.
	 * @param {Object} options - The options object containing the webhook ID.
	 * @param {string} options.webhookID - The ID of the webhook.
	 * @returns {Promise<void>} - A promise that resolves when the webhook handling is complete.
	 * @throws {Error} - If an error occurs during the webhook handling.
	 */
	async taxStatusWebHookHandler(body, { webhookID }) {
		try {
			logger.info(`Received Tax Status webhook for task : ${webhookID}`);
			// webhookID === integration_task_id
			logger.info(`TaxStatus webhook response body: ${JSON.stringify(body)}`);
			logger.info(`TaxStatus status webhookID: ${webhookID}`);
			const getConnectionIDQuery = `SELECT connection_id, business_id FROM integrations.data_business_integrations_tasks
			LEFT JOIN integrations.data_connections ON integrations.data_connections.id = integrations.data_business_integrations_tasks.connection_id 
			WHERE integrations.data_business_integrations_tasks.id = $1
			AND integration_task_id = (SELECT integrations.rel_tasks_integrations.id FROM integrations.rel_tasks_integrations
			LEFT JOIN integrations.core_tasks ON integrations.core_tasks.id = integrations.rel_tasks_integrations.task_category_id
			WHERE integrations.core_tasks.code = $2)`;
			const getTaxFilingsQuery = `SELECT MAX(version) as version FROM integration_data.tax_filings WHERE tax_filings.business_integration_task_id = $1`;

			const getWebhookPayloadQuery = `SELECT integrations.business_score_triggers.*, public.data_cases.id as case_id
				FROM integrations.business_score_triggers
				LEFT JOIN integrations.data_business_integrations_tasks ON integrations.data_business_integrations_tasks.business_score_trigger_id = integrations.business_score_triggers.id 
				LEFT JOIN public.data_cases ON integrations.business_score_triggers.id = public.data_cases.score_trigger_id
				WHERE integrations.data_business_integrations_tasks.id = $1`;

			const [connectionIDResult, taxFilingsResult, getWebhookPayloadResult] = await sqlTransaction(
				[getConnectionIDQuery, getTaxFilingsQuery, getWebhookPayloadQuery],
				[[webhookID, "fetch_tax_filings"], [webhookID], [webhookID]]
			);

			if (!connectionIDResult.rows.length) {
				throw new TaxationApiError(
					`Connection not found for given task-id: ${webhookID}`,
					StatusCodes.BAD_REQUEST,
					ERROR_CODES.INVALID
				);
			}

			const updateConnectionStatusQuery = `UPDATE integrations.data_connections SET connection_status = $1 WHERE integrations.data_connections.id = $2`;
			const updateIntegrationTaskStatusQuery = `UPDATE integrations.data_business_integrations_tasks SET task_status = $1 WHERE integrations.data_business_integrations_tasks.id = $2`;

			let updateConnectionStatus = "";
			let updateIntegrationTaskStatus = "";
			let businessID = "";
			const customerID = getWebhookPayloadResult.rows[0].customer_id;
			let tin = "";
			let version = 1;

			const webhookPayload = {
				business_id: getWebhookPayloadResult.rows[0].business_id,
				case_id: getWebhookPayloadResult.rows[0].case_id,
				integration_category: "Taxation",
				integration_platform: "Tax Status"
			};

			if (connectionIDResult && connectionIDResult.rows[0]) {
				businessID = connectionIDResult.rows[0].business_id;
				const { data } = await getBusinessDetailsForTaxConsent(businessID);
				tin = data.tin;
			}
			// If the callback has a status then it's an intermediate webhook or an errored webhook. A successful webhook call doesn't have status key , instead TaxStatus sends the complete data that needs to be stored
			if (Object.hasOwn(body, "Status")) {
				if (body.Status === "Consent completed") {
					logger.info(`Received Consent completed Tax Status webhook for task : ${webhookID}`);
					updateConnectionStatus = CONNECTION_STATUS.SUCCESS;
					updateIntegrationTaskStatus = TASK_STATUS.INITIALIZED;

					await uploadRawIntegrationDataToS3(
						body,
						businessID,
						"tax_filing_conest_webhook",
						DIRECTORIES.TAXATION,
						"TAX_STATUS"
					);

					if (customerID) {
						await sendWebhookEvent(customerID, WEBHOOK_EVENTS.INTEGRATION_CONNECTED, webhookPayload);
					}
				} else if (body.Status === "IRS Rejected") {
					logger.info(`Received IRS Rejected Tax Status webhook for task : ${webhookID}`);
					updateConnectionStatus = CONNECTION_STATUS.FAILED;
					updateIntegrationTaskStatus = TASK_STATUS.FAILED;

					// Send message to case service to update case status to Under Manual Review
					const getCaseQuery = `SELECT public.data_cases.id FROM public.data_cases
					LEFT JOIN integrations.data_business_integrations_tasks ON integrations.data_business_integrations_tasks.business_score_trigger_id = public.data_cases.score_trigger_id
					WHERE integrations.data_business_integrations_tasks.id = $1`;
					const getCaseResult: SqlQueryResult = await sqlQuery({ sql: getCaseQuery, values: [webhookID] });

				const message = {
					case_id: getCaseResult.rows[0].id,
					integration_category: "Taxation"
				};

				await producer.send({
					topic: kafkaTopics.CASES,
					messages: [
						{
							key: businessID,
							value: {
								event: kafkaEvents.INTEGRATION_TASK_FAILED,
								...message
							}
						}
					]
				});

					if (customerID) {
						await sendWebhookEvent(customerID, WEBHOOK_EVENTS.INTEGRATION_FAILED, webhookPayload);
					}
				}

				await sqlTransaction(
					[updateConnectionStatusQuery, updateIntegrationTaskStatusQuery],
					[
						[updateConnectionStatus, connectionIDResult.rows[0].connection_id],
						[updateIntegrationTaskStatus, webhookID]
					]
				);

				await uploadRawIntegrationDataToS3(
					body,
					businessID,
					"tax_filing_irs_rejected_webhook",
					DIRECTORIES.TAXATION,
					"TAX_STATUS"
				);

				return;
			}
			updateConnectionStatus = CONNECTION_STATUS.SUCCESS;
			updateIntegrationTaskStatus = INTEGRATION_STATUS.SUCCESS;

			if (taxFilingsResult.rows.length && taxFilingsResult.rows[0].version) {
				// Data is already filled for this business_integration_task_id
				version = parseInt(taxFilingsResult.rows[0].version) + 1;
				logger.info(`Received duplicate webhook from tax status, current version is ${version}`);
			}

			logger.info(`Received IRS Accepted Tax Status webhook for task : ${webhookID}`);

			// Store data for past 5 years
			const yearRange: any = [];
			for (let i = 0; i < 5; i++) {
				const element = new Date().getFullYear() - i;
				yearRange.push(element);
			}
			const businessType = Object.hasOwn(body, "SSN") ? "INDIVIDUAL" : "BUSINESS";
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

			const rows: any[] = [];
			for await (const item of body.Data) {
				let industryCode = 0;
				let industryTitle = "";

				const apiObj = {
					companyId: envConfig.TAX_STATUS_COMPANY_ID,
					tin,
					transcriptType: item.FormType.toString(),
					transcriptForm: item.Form.toString(),
					transcriptPeriod: item.Period.toString()
				};
				/**
				 * Using fetchTranscriptDetails function for fetching and saving the data to the database for the quarterly data
				 */
				const transcriptData: any = await this.getDataForTranscriptDetails(item, apiObj, webhookID);

				/**
				 * Fetches the transcript details for the industry.
				 * If the industry is found then it will be saved to the database
				 */
				const industryTranscriptDetails = await taxApi.fetchTranscriptDetails(
					apiObj,
					TAX_STATUS_ENDPOINTS.TRANSCRIPTDETAIL,
					"industry"
				);
				if (
					industryTranscriptDetails &&
					industryTranscriptDetails.industry &&
					industryTranscriptDetails.Message !== "Transcript not found"
				) {
					industryCode = industryTranscriptDetails.code;
					industryTitle = industryTranscriptDetails.industry;
					const message = {
						business_id: businessID,
						naics_code: industryCode,
						naics_title: industryTitle,
						platform: "tax_status"
					};
					logger.info(message);
				const payload = {
					topic: kafkaTopics.BUSINESS,
					messages: [
						{
							key: businessID,
							value: {
								event: kafkaEvents.UPDATE_NAICS_CODE,
								...message
							}
						}
					]
				};
				producer.send(payload);
				} else {
					logger.info(`Industry not found for ${apiObj.tin} and taskID: ${webhookID}`);
				}
				const period = parseInt(item.Period.toString().substring(0, 4));
				if (yearRange.includes(period)) {
					rows.push([
						webhookID,
						businessType,
						item.Period,
						item.Form,
						item.FormType,
						item.FilingStatus,
						item.AGI ? item.AGI : 0,
						item.TotalIncome ? item.TotalIncome : 0,
						item.TotalSales ? item.TotalSales : 0,
						item.TotalCompensation ? item.TotalCompensation : 0,
						item.TotalWages ? item.TotalWages : 0,
						item.IRSBalance ? item.IRSBalance : 0,
						item.LienBalance ? item.LienBalance : 0,
						industryCode ? industryCode : 0,
						industryTitle ? industryTitle : "",
						transcriptData.interest ? transcriptData.interest : 0,
						transcriptData.interestDate ? transcriptData.interestDate : "",
						transcriptData.penalty ? transcriptData.penalty : 0,
						transcriptData.penaltyDate ? transcriptData.penaltyDate : "",
						transcriptData.fileDate ? transcriptData.fileDate : "",
						transcriptData.balance ? transcriptData.balance : 0,
						transcriptData.taxPeriodEndingDate ? transcriptData.taxPeriodEndingDate : "",
						transcriptData.amountFiled ? transcriptData.amountFiled : 0,
						transcriptData.costOfGoodsSold ? transcriptData.costOfGoodsSold : 0,
						version
					]);
				}
			}
			/**
			 * if we have data to store in the database then we are storing the data in the database
			 * and also updating the connection status and integration task status
			 */
			if (rows.length) {
				const insertTaxFilingQuery = buildInsertQuery(table, columns, rows);
				await sqlTransaction(
					[insertTaxFilingQuery, updateConnectionStatusQuery, updateIntegrationTaskStatusQuery],
					[
						rows.flat(),
						[updateConnectionStatus, connectionIDResult.rows[0].connection_id],
						[updateIntegrationTaskStatus, webhookID]
					]
				);
			}
			/**
			 * Storing the webhook data in S3 bucket
			 */

			await uploadRawIntegrationDataToS3(body, businessID, "tax_filings", DIRECTORIES.TAXATION, "TAX_STATUS");

			// For the invited business two cases are created one for invited and other for standalone
			// Suppose applicant gave consent for invited case so he will be able to see the taxation details through webhook data
			// but for standalone case there is not way as tax-status webhook data may take longer (1 day)
			// hence this will trigger kafka event to fetch taxation data for all other cases of current business
			const message = {
				business_id: businessID,
				task_id: webhookID
			};

		const payload = {
			topic: kafkaTopics.BUSINESS,
			messages: [
				{
					key: businessID,
					value: {
						event: kafkaEvents.TAX_STATUS_DATA_FETCHING,
						...message
					}
				}
			]
		};
		await producer.send(payload);
		} catch (error) {
			const caseRows = await db("public.data_cases.id, public.data_cases.business_id")
				.leftJoin(
					"integrations.data_business_integrations_tasks",
					"integrations.data_business_integrations_tasks.business_score_trigger_id",
					"public.data_cases.score_trigger_id"
				)
				.where("integrations.data_business_integrations_tasks.id", webhookID);

			const auditMessage = {
				business_id: caseRows?.[0]?.business_id,
				case_id: caseRows?.[0]?.id,
				integration_category: "Taxation",
				integration_platform: "Tax Status"
			};

		// Create an audit log
		await producer.send({
			topic: kafkaTopics.NOTIFICATIONS,
			messages: [
				{
					key: caseRows?.[0]?.business_id,
					value: {
						event: kafkaEvents.INTEGRATION_DATA_FETCH_FAILED_AUDIT,
						...auditMessage
					}
				}
			]
		});
		throw error;
		}
	}

	/**
	 * This api is to fetch taxation data of connected tax status account for given case-id
	 * @param params {caseID}
	 */
	async taxFilingDataFetch(params: TaxFilingDataFetchParams, query: TaxFilingDataFetchQueryParams) {
		try {
			let forceFetch = query.force ? query.force : false;

			const getConnectionQuery = `SELECT connection_status, task_status, data_cases.business_id, integrations.data_business_integrations_tasks.id as task_id 
				FROM data_cases
				LEFT JOIN integrations.data_business_integrations_tasks ON integrations.data_business_integrations_tasks.business_score_trigger_id = data_cases.score_trigger_id
				LEFT JOIN integrations.data_connections ON integrations.data_connections.id = integrations.data_business_integrations_tasks.connection_id
				WHERE data_cases.id = $1
				AND integrations.data_business_integrations_tasks.integration_task_id = (SELECT id FROM integrations.rel_tasks_integrations WHERE task_category_id =(SELECT id FROM integrations.core_tasks WHERE code = $2))`;

			const getConnectionResult: SqlQueryResult = await sqlQuery({
				sql: getConnectionQuery,
				values: [params.caseID, "fetch_tax_filings"]
			});

			if (getConnectionResult.rows[0].connection_status !== CONNECTION_STATUS.SUCCESS) {
				throw new TaxationApiError("Connection status is not success", StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
			}

			if (getConnectionResult.rows[0].task_status === CONNECTION_STATUS.SUCCESS && !forceFetch) {
				throw new TaxationApiError("Task is already succeed", StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
			}

			const { data } = await getBusinessDetailsForTaxConsent(getConnectionResult.rows[0].business_id);

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

			const taxFilings = await taxApi.send(taxApiPayload, endpoint);

			const { rows } = await fetchTaxFilings(
				taxFilings,
				getConnectionResult.rows[0].business_id,
				data,
				getConnectionResult.rows[0].task_id
			);

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

			/**
			 * if we have data to store in the database then we are storing the data in the database
			 * and also updating the connection status and integration task status
			 */
			if (rows.length) {
				const insertTaxFilingQuery = buildInsertQuery(table, columns, rows);
				await sqlQuery({ sql: insertTaxFilingQuery, values: rows.flat() });
			}

			await updateTask(getConnectionResult.rows[0].task_id, TASK_STATUS.SUCCESS);
		} catch (error) {
			throw error;
		}
	}

	/**
	 * Tax Status data fetching for all cases with connection status as success
	 */
	async fetchAllCasesData(query: TaxFilingDataFetchQueryParams) {
		try {
			let forceFetch = query.force ? query.force : false;

			let getConnectionQuery = `SELECT connection_status, task_status, data_cases.business_id, integrations.data_business_integrations_tasks.id as task_id 
				FROM data_cases
				LEFT JOIN integrations.data_business_integrations_tasks ON integrations.data_business_integrations_tasks.business_score_trigger_id = data_cases.score_trigger_id
				LEFT JOIN integrations.data_connections ON integrations.data_connections.id = integrations.data_business_integrations_tasks.connection_id
				WHERE  integrations.data_business_integrations_tasks.integration_task_id = (SELECT id FROM integrations.rel_tasks_integrations WHERE task_category_id =(SELECT id FROM integrations.core_tasks WHERE code = $1))
					AND connection_status = 'SUCCESS'`;

			if (!forceFetch) {
				getConnectionQuery += ` AND task_status != 'SUCCESS'`;
			}

			const getConnectionResult: SqlQueryResult = await sqlQuery({
				sql: getConnectionQuery,
				values: ["fetch_tax_filings"]
			});

			for await (const row of getConnectionResult.rows) {
				let data = {
					tin: "123123123",
					title: "title"
				};

				try {
					let businessData = await getBusinessDetailsForTaxConsent(row.business_id);
					data = businessData.data;
				} catch (error) {
					logger.error(
						`Error in getting business details for business_id: ${row.business_id}, data: ${JSON.stringify(data)}`
					);
					data.tin = "123123123";
					data.title = "title";
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

				const { rows } = await fetchTaxFilings(taxFilings, row.business_id, data, row.task_id);

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

				/**
				 * if we have data to store in the database then we are storing the data in the database
				 * and also updating the connection status and integration task status
				 */
				if (rows.length) {
					const insertTaxFilingQuery = buildInsertQuery(table, columns, rows);
					await sqlQuery({ sql: insertTaxFilingQuery, values: rows.flat() });
				}
				await updateTask(row.task_id, TASK_STATUS.SUCCESS);
			}
		} catch (error) {
			throw error;
		}
	}

	/**
	 * @description Update the tax filing record received as a manual entry from FE
	 * @param params
	 * @param body
	 * @returns
	 */
	async addTaxFiling(params: { businessID: UUID }, body: AddTaxFilingBody, userInfo: UserInfo) {
		try {
			const { businessID } = params;
			const { case_id: caseID, customer_id: customerID } = body;

			// get business task id
			const getBusinessTaskIDQuery = `SELECT dbit.id, dbit.task_status, tf.version  FROM integrations.data_business_integrations_tasks dbit
			INNER JOIN integrations.data_connections ON integrations.data_connections.id = dbit.connection_id
			INNER JOIN data_cases ON data_cases.score_trigger_id = dbit.business_score_trigger_id
			INNER JOIN integrations.rel_tasks_integrations rti ON rti.id = dbit.integration_task_id
			INNER JOIN integrations.core_tasks ct ON ct.id = rti.task_category_id
			INNER JOIN integrations.core_integrations_platforms cip ON cip.id = rti.platform_id
			LEFT JOIN integration_data.tax_filings tf ON tf.business_integration_task_id = dbit.id
			WHERE integrations.data_connections.business_id = $1
			AND data_cases.id = $2
			AND ct.id = $3
			AND cip.id = $4`;

			const getBusinessTaskIDResult: SqlQueryResult = await sqlQuery({
				sql: getBusinessTaskIDQuery,
				values: [businessID, caseID, INTEGRATION_TASK.manual_tax_filing, INTEGRATION_ID.MANUAL]
			});

			if (!getBusinessTaskIDResult.rows.length) {
				throw new TaxationApiError("Business task not found", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
			}

			const integrationTaskMetadata = {};

			const version = getBusinessTaskIDResult.rows[0].version
				? parseInt(getBusinessTaskIDResult.rows[0].version) + 1
				: 1;

			// If ocr file upload, prepare the data and store it in the database
			if (body?.validation_ocr_document_ids) {
				// check if the ocr documents are present in the database
				// TODO: This function will not work correctly as maybe it is yet to be added in DB. Because this happen async
				// await this._checkOcrDocumentsForBusiness(body.ocr_document_ids, businessID);
				const ocrData = await this._getTaxFilingFromOCR(body.validation_ocr_document_ids);
				integrationTaskMetadata["ocr_document"] = ocrData.map(item => {
					return {
						validation_document_id: item.id,
						file_name: item.file_name,
						file_path: item.file_path,
						ocr_extraction_document_id: item.extracted_data?.extractionJobId?.split("::")[2]
					};
				});

				const updateIntegrationTaskStatus = `UPDATE integrations.data_business_integrations_tasks SET task_status = $1, metadata = $2 WHERE integrations.data_business_integrations_tasks.id = $3`;
				await sqlQuery({
					sql: updateIntegrationTaskStatus,
					values: [TASK_STATUS.SUCCESS, integrationTaskMetadata, getBusinessTaskIDResult.rows[0].id]
				});

				return;
			}

			// If manual, then we need to validate the fields according to stage field config stored in case-svc
			// TODO: get business tax stage fields config
			// validate the body with the config for data consistency
			// const taxStageFields = await getTaxStageFields(customerID);

			if (!body?.manual) {
				throw new TaxationApiError("Invalid data", StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
			}

			const data: Array<ManualTaxFiling> = [body?.manual];

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
			const businessFormTypes = ["1120", "990", "1065", "1120-S", "941", "943", "944", "720"];

			const rows = data.map(item => [
				getBusinessTaskIDResult.rows[0].id, // NOT NULL
				businessFormTypes.includes(item.form) ? "BUSINESS" : "INDIVIDUAL", // NOT NULL
				this._getTaxPeriodFromDate(item.tax_period_end as string) || `${dayjs(item.tax_filed_date).year()}12`, // NOT NULL
				item.form, // NOT NULL
				FORM_TO_FORM_TYPE_MAPPING[item.form],
				item.filing_status,
				item.adjusted_gross_income,
				item.total_income,
				item.total_sales,
				item.total_compensation,
				item.total_wages,
				item.irs_balance,
				item.irs_liens,
				item.accrued_interest,
				item.interest_date,
				item.accrued_penalty,
				item.penalty_date,
				item.tax_filed_date,
				item.account_balance,
				item.tax_period_end,
				item.amount_filed,
				item.cost_of_goods_sold,
				version // NOT NULL
			]);

			if (userInfo?.is_guest_owner) {
				const [existingRecord] = await this._getTaxFilingByTaskID(getBusinessTaskIDResult.rows[0].id);

				const newRecord = data[0]; // body.manual

				const edits: any[] = [];

				const fieldsToCompare = [
					{ field: "form", label: "form" },
					{ field: "filing_status", label: "filing_status" },
					{ field: "adjusted_gross_income", label: "adjusted_gross_income" },
					{ field: "total_income", label: "total_income" },
					{ field: "total_sales", label: "total_sales" },
					{ field: "total_compensation", label: "total_compensation" },
					{ field: "total_wages", label: "total_wages" },
					{ field: "irs_balance", label: "irs_balance" },
					{ field: "lien_balance", label: "irs_liens" },
					{ field: "interest", label: "accrued_interest" },
					{ field: "interest_date", label: "interest_date" },
					{ field: "penalty", label: "accrued_penalty" },
					{ field: "penalty_date", label: "penalty_date" },
					{ field: "filed_date", label: "tax_filed_date" },
					{ field: "balance", label: "account_balance" },
					{ field: "tax_period_ending_date", label: "tax_period_end" },
					{ field: "amount_filed", label: "amount_filed" },
					{ field: "cost_of_goods_sold", label: "cost_of_goods_sold" },
					{ field: "file_name", label: "file_name" }
				];

				for (const { field, label } of fieldsToCompare) {
					const oldVal = existingRecord?.[field] ?? null;
					const newVal = newRecord[label as keyof ManualTaxFiling];

					const fieldEdits = extractEdits(field, oldVal, newVal);
					for (const edit of fieldEdits) {
						edits.push({
							field_name: edit.field_name,
							old_value: edit.old_value,
							new_value: edit.new_value
						});
					}
				}

				if (edits.length > 0) {
					await setApplicationEditData(businessID, {
						case_id: caseID,
						customer_id: userInfo?.issued_for?.customer_id,
						stage_name: "tax_filing",
						user_name: `${userInfo?.issued_for?.first_name ?? ""} ${userInfo?.issued_for?.last_name ?? ""}`.trim(),
						created_by: userInfo?.issued_for?.user_id,
						data: edits
					});
				}
			}

			// delete the tax-filing for this tax as we want to replace it
			// Reason for replacing We would not want to keep the old data as it is manual entry for the same task
			const deleteTaxFilingQuery = `DELETE FROM integration_data.tax_filings WHERE business_integration_task_id = $1`;

			// store data in the database and update the task status
			const insertTaxFilingQuery = buildInsertQuery(table, columns, rows);

			// update the task status to success
			const updateIntegrationTaskStatus = `UPDATE integrations.data_business_integrations_tasks SET task_status = $1, metadata = $2 WHERE integrations.data_business_integrations_tasks.id = $3`;

			await sqlSequencedTransaction(
				[deleteTaxFilingQuery, insertTaxFilingQuery, updateIntegrationTaskStatus],
				[
					[getBusinessTaskIDResult.rows[0].id],
					rows.flat(),
					[TASK_STATUS.SUCCESS, integrationTaskMetadata, getBusinessTaskIDResult.rows[0].id]
				]
			);
			//sending kafka event for triggering emails to co-applicant
			try {
				if (!userInfo?.is_guest_owner) {
					await triggerSectionCompletedKafkaEventWithRedis({
						businessId: businessID,
						section: "Taxation",
						userId: userInfo.user_id as UUID,
						customerId: customerID as UUID
					});
				}
			} catch (err: any) {
				logger.error(`Error sending Kafka event for section 'Taxation': ${err.message}`);
			}
		} catch (error) {
			throw error;
		}
	}

	/**
	 * @description Update the tax filing table with the extracted data from the ocr document
	 * @param {object} data
	 * @param {UUID} data.businessID: id of the business
	 * @param {UUID} data.ocrDocumentID: id of the ocr document
	 */
	async processTaxFilingExtraction(data: {
		businessID: UUID;
		ocrDocumentID: UUID;
		userInfo?: UserInfo;
		caseID?: UUID | null;
	}) {
		try {
			const { businessID, ocrDocumentID, userInfo, caseID } = data;
			let customerId;
			if (caseID) {
				// get customer-id based on case-id
				customerId = await this.getCustomerIdByCaseId(caseID);
			}

			// get business task id where the ocr document is uploaded
			const getBusinessTaskIDQuery = `SELECT dbit.id FROM integrations.data_business_integrations_tasks dbit
			INNER JOIN integrations.data_connections dc ON dc.id = dbit.connection_id
			INNER JOIN integrations.rel_tasks_integrations rti ON rti.id = dbit.integration_task_id
			INNER JOIN integrations.core_tasks ct ON ct.id = rti.task_category_id
			INNER JOIN integrations.core_integrations_platforms cip ON cip.id = rti.platform_id
			LEFT JOIN LATERAL json_array_elements(dbit.metadata->'ocr_document') AS ocr ON true
			WHERE dc.business_id = $1
			AND ct.id = $2
			AND cip.id = $3
			AND dbit.task_status = $4
			AND ocr->>'ocr_extraction_document_id' = $5`;

			const getBusinessTaskIDResult: SqlQueryResult = await sqlQuery({
				sql: getBusinessTaskIDQuery,
				values: [
					businessID,
					INTEGRATION_TASK.manual_tax_filing,
					INTEGRATION_ID.MANUAL,
					TASK_STATUS.SUCCESS,
					ocrDocumentID
				]
			});
			logger.info(`PROCESS_EXTRACTED_TAX_DOCUMENT: QUERY: ${JSON.stringify(getBusinessTaskIDResult)}`);

			if (!getBusinessTaskIDResult.rows.length) {
				throw new TaxationApiError(
					`Business task not found for businessID: ${businessID}, ocrDocumentID: ${ocrDocumentID}`,
					StatusCodes.NOT_FOUND,
					ERROR_CODES.NOT_FOUND
				);
			}

			getBusinessTaskIDResult.rows.forEach(async row => {
				const taskID = row.id;

				// check if job is processed or not
				const ocrData = await this._getTaxFilingFromOCR([ocrDocumentID]);

				const transformedOcrData = ocrData.map(
					item => this._transformTaxFilingData(item.file_name, item.extracted_data) as TransformedOcrTaxFiling
				);

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

				const rows = transformedOcrData.map(item => [
					taskID, // NOT NULL
					item.filing_for === "business" ? "BUSINESS" : "INDIVIDUAL", // NOT NULL
					item.period ? item.period : this._getTaxPeriodFromDate(item.tax_period_ending_date as string), // NOT NULL
					item.form, // NOT NULL
					item.form_type ? item.form_type : FORM_TO_FORM_TYPE_MAPPING[item.form],
					item.filing_status,
					item.adjusted_gross_income,
					item.total_income,
					item.total_sales,
					item.total_compensation,
					item.total_wages,
					item.irs_balance,
					item.irs_liens,
					null,
					null,
					null,
					null,
					item.tax_filed_date,
					item.account_balance,
					item.tax_period_ending_date,
					item.amount_filed,
					item.cost_of_goods_sold,
					1 // NOT NULL
				]);

				const newRecord = transformedOcrData[0];
				let existingRecord = (await this._getTaxFilingByTaskID(taskID))[0];
				if (!existingRecord) {
					existingRecord = {} as TaskFilings;
				}

				logger.info(`existingRecord tax: ${JSON.stringify(existingRecord)}`);

				const edits: any[] = [];
				const fieldsToCompare = [
					{ field: "form", label: "form" },
					{ field: "filing_status", label: "filing_status" },
					{ field: "adjusted_gross_income", label: "adjusted_gross_income" },
					{ field: "total_income", label: "total_income" },
					{ field: "total_sales", label: "total_sales" },
					{ field: "total_compensation", label: "total_compensation" },
					{ field: "total_wages", label: "total_wages" },
					{ field: "irs_balance", label: "irs_liens" },
					{ field: "interest", label: "accrued_interest" },
					{ field: "interest_date", label: "interest_date" },
					{ field: "penalty", label: "accrued_penalty" },
					{ field: "penalty_date", label: "penalty_date" },
					{ field: "filed_date", label: "tax_filed_date" },
					{ field: "balance", label: "account_balance" },
					{ field: "tax_period_ending_date", label: "tax_period_ending_date" },
					{ field: "amount_filed", label: "amount_filed" },
					{ field: "cost_of_goods_sold", label: "cost_of_goods_sold" },
					{ field: "file_name", label: "file_name" }
				];

				for (const { field, label } of fieldsToCompare) {
					const oldVal = existingRecord[field] ?? null;
					const newVal = newRecord[label as keyof TransformedOcrTaxFiling];

					const fieldEdits = extractEdits(field, oldVal, newVal);
					for (const edit of fieldEdits) {
						const trimmedNewValue =
							typeof edit.new_value === "string" && edit.new_value.trim() === "" ? null : edit.new_value;
						edits.push({
							field_name: edit.field_name,
							old_value: edit.old_value,
							new_value: trimmedNewValue
						});
					}
				}

				logger.info(`edits tax: ${JSON.stringify(edits)}`);

				if (userInfo?.is_guest_owner && edits.length > 0) {
					await setApplicationEditData(businessID, {
						case_id: caseID,
						customer_id: userInfo?.issued_for?.customer_id,
						stage_name: "tax_filing",
						created_by: userInfo?.issued_for?.user_id,
						user_name: `${userInfo?.issued_for?.first_name ?? ""} ${userInfo?.issued_for?.last_name ?? ""}`.trim(),
						data: edits
					});
				}

				// delete the tax-filing for this tax as we want to replace it
				// const deleteTaxFilingQuery = `DELETE FROM integration_data.tax_filings WHERE business_integration_task_id = $1`;

				// store data in the database and update the task status
				const insertTaxFilingQuery = buildInsertQuery(table, columns, rows);
				await sqlSequencedTransaction([insertTaxFilingQuery], [rows.flat()]);
				if (caseID) {
					// send kafka event for audit
					await producer.send({
						topic: kafkaTopics.NOTIFICATIONS,
						messages: [
							{
								key: businessID,
								value: {
									event: kafkaEvents.DOCUMENT_UPLOADED_AUDIT,
									business_id: businessID,
									integration: "Taxation",
									document_name: `Tax Form ${newRecord.form}`,
									case_id: caseID,
									customer_id: customerId
								}
							}
						]
					});
				}
			});
		} catch (error) {
			logger.error(
				`PROCESS_EXTRACTED_TAX_DOCUMENT: Error processing tax filing insertion for business: ${data.businessID}, ocrDocumentID: ${data.ocrDocumentID}, ERROR: ${error}`
			);
			throw error;
		}
	}

	/**
	 * @description Update the metadata for task with the ocr document id
	 * @param documentID : ocr document id
	 * @param caseID : case id
	 */
	async _updateTaxFilingIntegrationTaskMetadata(documentID: UUID, caseID: UUID, isValidated: Boolean) {
		try {
			let integrationTaskMetadata = {};
			let taskStatus: string = TASK_STATUS.FAILED;

			if (isValidated) {
				const ocrData = await this._getTaxFilingFromOCR([documentID]);
				integrationTaskMetadata = {
					ocr_document: ocrData.map(item => {
						return {
							validation_document_id: item.id,
							file_name: item.file_name,
							file_path: item.file_path,
							ocr_extraction_document_id: item.extracted_data?.extractionJobId?.split("::")[2]
						};
					})
				};

				taskStatus = TASK_STATUS.SUCCESS;
			}
			const createNewTask = `INSERT INTO integrations.data_business_integrations_tasks (
										business_score_trigger_id,
										connection_id,
										integration_task_id,
										task_status,
										metadata
									)
									SELECT
										data_cases.score_trigger_id,
										dc.id,
										(SELECT id FROM integrations.rel_tasks_integrations 
											WHERE task_category_id = $1 AND platform_id = $2),
										$3,
										$4::json
									FROM integrations.data_connections dc
									INNER JOIN data_cases ON data_cases.business_id = dc.business_id
									WHERE data_cases.id = $5
									AND dc.platform_id = $6`;
			// Mark the task as success
			// const updateIntegrationTaskStatus = `UPDATE integrations.data_business_integrations_tasks dbit SET metadata = $1::json, task_status = $2
			// 				FROM data_cases
			// 				WHERE dbit.business_score_trigger_id = data_cases.score_trigger_id
			// 				AND data_cases.id = $3
			// 				AND dbit.integration_task_id = (
			// 					SELECT rti.id FROM integrations.rel_tasks_integrations rti
			// 					INNER JOIN integrations.core_tasks ct ON ct.id = rti.task_category_id
			// 					INNER JOIN integrations.core_integrations_platforms cip ON cip.id = rti.platform_id
			// 					WHERE ct.id = $4
			// 					AND cip.id = $5
			// 				)`;

			await sqlQuery({
				sql: createNewTask,
				values: [
					INTEGRATION_TASK.manual_tax_filing,
					INTEGRATION_ID.MANUAL,
					taskStatus,
					integrationTaskMetadata,
					caseID,
					INTEGRATION_ID.MANUAL
				]
			});
		} catch (error) {
			logger.error({ error }, '_updateTaxFilingIntegrationTaskMetadata failed');
			throw error;
		}
	}

	async _checkOcrDocumentsForBusiness(ocr_document_ids: UUID[], businessID: UUID) {
		const getOCRTaxFilingQuery = `SELECT extracted_data FROM integration_data.uploaded_ocr_documents WHERE id IN (${ocr_document_ids.map(id => `'${id}'`).join(",")}) AND business_id = $1`;
		const getOCRTaxFilingResult: SqlQueryResult = await sqlQuery({ sql: getOCRTaxFilingQuery, values: [businessID] });

		if (!getOCRTaxFilingResult.rows.length || getOCRTaxFilingResult.rows.length != ocr_document_ids.length) {
			throw new TaxationApiError(
				"Tax filing not found for some or all ocr documents",
				StatusCodes.NOT_FOUND,
				ERROR_CODES.NOT_FOUND
			);
		}
	}

	async _getTaxFilingFromOCR(ocr_document_ids: UUID[]) {
		try {
			const getOCRTaxFilingQuery = `SELECT id, file_name, file_path, extracted_data FROM integration_data.uploaded_ocr_documents WHERE id IN (${ocr_document_ids.map(id => `'${id}'`).join(",")})`;
			const getOCRTaxFilingResult: SqlQueryResult = await sqlQuery({ sql: getOCRTaxFilingQuery });

			return getOCRTaxFilingResult.rows;
		} catch (error) {
			throw error;
		}
	}

	_transformTaxFilingData(fileName: string, data: { taxReturnData: OcrTaxFiling }) {
		try {
			const { taxReturnData } = data;

			// form from chatgpt is form_type for our DB ie ACTR, RECA etc
			const form_type = taxReturnData?.form;
			// formType from chatgpt is form for our DB ie 1040, 941, 1120 etc
			const form = taxReturnData?.formType;
			const filing_for = taxReturnData.filingFor;
			const tax_filed_date = dayjs().year(taxReturnData?.taxYear).month(12).date(31).format("YYYY-MM-DD");
			const tax_period_ending_date = dayjs().year(taxReturnData?.taxYear).month(11).date(31).format("YYYY-MM-DD");
			const filing_status = taxReturnData?.taxPayerInfo?.filingStatus;
			const adjusted_gross_income = taxReturnData?.income?.adjustedGrossIncome;
			const total_income = taxReturnData?.income?.totalIncome;
			const total_sales = taxReturnData?.financials?.grossRevenue;
			const total_compensation = 0; // check with allison
			const total_wages = taxReturnData?.financials?.totalWages;
			const cost_of_goods_sold = taxReturnData?.financials?.costOfGoodsSold;
			const irs_balance = null;
			const irs_liens = null;
			const account_balance = taxReturnData?.financials?.netIncome;
			const amount_filed = taxReturnData?.deductionsAndTax?.totalPayments;
			const business_type = taxReturnData?.businessType;

			return {
				form_type,
				form,
				filing_for,
				tax_filed_date,
				tax_period_ending_date,
				filing_status,
				adjusted_gross_income,
				total_income,
				total_sales,
				total_compensation,
				total_wages,
				cost_of_goods_sold,
				irs_balance,
				irs_liens,
				account_balance,
				amount_filed,
				business_type,
				file_name: fileName
			};
		} catch (error) {
			throw error;
		}
	}

	_getTaxPeriodFromDate(date: string) {
		if (!date) {
			return null;
		}
		// this will convert 1 to 3 as it belongs to Q1 and 5 to 6 as it belongs to Q2
		const month = this._getTaxQuarterMonth(dayjs(date).month() + 1);
		return `${dayjs(date).year()}${month < 10 ? `0${month}` : month}`;
	}

	async getCustomerIdByCaseId(caseId: UUID | null): Promise<UUID | null> {
		if (!caseId) return null;

		const result = await db("integrations.business_score_triggers")
			.select("customer_id")
			.join("public.data_cases", "public.data_cases.score_trigger_id", "integrations.business_score_triggers.id")
			.where("public.data_cases.id", caseId)
			.first();

		return result?.customer_id ?? null;
	}
}

export const taxation = new Taxation();
