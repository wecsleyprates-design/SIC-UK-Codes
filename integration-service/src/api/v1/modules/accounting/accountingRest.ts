import { envConfig } from "#configs/index";
import {
	CONNECTION_STATUS,
	DIRECTORIES,
	ERROR_CODES,
	INTEGRATION_CATEGORIES,
	INTEGRATION_ID,
	IntegrationCategory,
	IntegrationTaskKey,
	TASK_STATUS,
	TAX_STATUS_ENDPOINTS,
	WEBHOOK_EVENTS,
	columnToActualMap,
	kafkaEvents,
	kafkaTopics,
	taskCodesForAccounting,
	type TaskCode
} from "#constants/index";
import {
	getBusinessDetailsForTaxConsent,
	sqlQuery,
	sqlTransaction,
	logger,
	taxApi,
	getBusinessApplicants,
	producer,
	getInvitationDetails,
	getOrCreateConnection,
	platformFactory
} from "#helpers/index";
import { AggregationRubric, applyConditionToQuery, applyGroupBy, applyWhereClausesFromFilter, db, getTotalRecordCount, hasAggregation } from "#helpers/knex";
import { IDBConnection, IDBConnectionEgg, IntegrationResponse, SqlQueryResult, UserInfo } from "#types/index";
import { formatNumberWithoutPlus, getCachedSignedUrl, isValidLimit, isValidPage, parseFloatNum } from "#utils/index";
import { UUID } from "crypto";
import { StatusCodes } from "http-status-codes";
import { Knex } from "knex";
import { AccountingApiError } from "./error";
import {
	IObjectTableContents,
	IValidation,
	ObjectRequest,
	ObjectResponse,
	ObjectTable,
	ReportRequest,
	ReportResponse,
	RevokeTaxStatusHeaders,
	RevokeTaxStatusParams,
	RevokeTaxStatusUserInfo,
	RevokeAccountingHeaders,
	RevokeAccountingParams,
	RevokeAccountingUserInfo,
	RevokeAccountingBody,
	type ReportTable,
	RevokeTaxStatusQuery,
	AddAccountingBody,
	IUploadedStatement
} from "./types";

import { convertState } from "#lib/plaid/convert";
import { Rutter } from "#lib/rutter/index";
import { executeOtherTasksOnApplicationEdit, getJSONFromS3, getRawIntegrationDataFromS3, sendWebhookEvent } from "#common/index";
import { TaskManager } from "../tasks/taskManager";
import dayjs from "dayjs";
import { Cases } from "#models/cases";
import { ManualAccounting } from "#lib/manual/manualAccounting";

const aggregations: AggregationRubric = {
	accounting_balancesheet: {
		business: {
			select: [
				db.raw("EXTRACT(YEAR FROM start_date)::text AS year"),
				db.raw("accounting_balancesheet.id as id"),
				"external_id",
				"platform_id",
				"currency",
				"total_assets",
				"total_liabilities",
				"total_equity",
				"start_date",
				"end_date",
				db.raw("accounting_balancesheet.created_at as created_at"),
				db.raw("accounting_balancesheet.updated_at as updated_at")
			],
			from: (queryBuilder: Knex.QueryBuilder) => {
				if (queryBuilder) {
					const business_id = queryBuilder["_statements"].find(statement => statement.column === "accounting_balancesheet.business_id").value;
					if (business_id) {
						return db("integration_data.accounting_balancesheet")
							.select(db.raw(`*,ROW_NUMBER() OVER(PARTITION BY EXTRACT(YEAR FROM start_date),platform_id ORDER BY start_date ASC) as rn, EXTRACT(YEAR FROM start_date) as year`))
							.where("start_date", ">=", db.raw(`CURRENT_DATE - INTERVAL '2 years'`))
							.where("business_id", business_id)
							.as("accounting_balancesheet");
					}
				}
				throw new AccountingApiError("No could not generate balance sheet query");
			},
			where: db.raw("rn = 1 and year >= extract(year from current_date) -3"),
			orderBy: db.raw("EXTRACT(YEAR FROM start_date)")
		}
	},
	accounting_incomestatement: {
		year: {
			select: [
				db.raw("EXTRACT(YEAR FROM start_date)::text AS year"),
				"platform_id",
				db.raw("sum(total_revenue) as total_revenue"),
				db.raw("sum(net_income) as net_income"),
				db.raw("sum(total_expenses) as total_expenses"),
				db.raw("COALESCE(sum(total_depreciation),0) as total_depreciation"),
				db.raw("COALESCE(sum(total_cost_of_goods_sold),0) as total_cost_of_goods_sold"),
				db.raw("max(currency) as currency"),
				db.raw("min(start_date) as start_period"),
				db.raw("max(end_date) as end_period")
			],
			groupBy: db.raw("EXTRACT(YEAR FROM start_date), platform_id"),
			orderBy: db.raw("EXTRACT(YEAR FROM start_date), platform_id")
		},
		businessWithFilter: {
			select: [
				"accounting_incomestatement.platform_id",
				"accounting_incomestatement.business_id",
				db.raw("sum(total_revenue) as total_revenue"),
				db.raw("sum(net_income) as net_income"),
				db.raw("sum(total_expenses) as total_expenses"),
				db.raw("COALESCE(sum(total_depreciation),0) as total_depreciation"),
				db.raw("COALESCE(sum(total_cost_of_goods_sold),0) as total_cost_of_goods_sold"),
				db.raw("min(start_date) as start_period"),
				db.raw("max(end_date) as end_period")
			],
			groupBy: ["accounting_incomestatement.business_id", "accounting_incomestatement.platform_id"],
			orderBy: 1
		},
		//Group & filter by last two years + partial current year
		business: {
			select: [
				db.raw("EXTRACT(YEAR FROM start_date)::text AS year"),
				"accounting_incomestatement.platform_id",
				db.raw("sum(total_revenue) as total_revenue"),
				db.raw("sum(net_income) as net_income"),
				db.raw("sum(total_expenses) as total_expenses"),
				db.raw("COALESCE(sum(total_depreciation),0) as total_depreciation"),
				db.raw("COALESCE(sum(total_cost_of_goods_sold),0) as total_cost_of_goods_sold"),
				db.raw("min(start_date) as start_period"),
				db.raw("max(end_date) as end_period")
			],
			where: db.raw("start_date > DATE_TRUNC('year', CURRENT_DATE) - INTERVAL '1 years' + INTERVAL '1 day' - INTERVAL '1 year'"),
			groupBy: [db.raw("EXTRACT(YEAR FROM start_date)"), "accounting_incomestatement.platform_id"],
			orderBy: 1
		}
	}
};

type ObjectTableMap = Partial<Record<ObjectTable, IObjectTableContents>>;

/* General GETs for Accounting that does not need any platform-related logic */
export abstract class AccountingRest {
	static PAGE_SIZE = 20;
	static SCHEMA = "integration_data";
	static VALID_REPORT_TABLES = ["accounting_balancesheet", "accounting_incomestatement", "accounting_cashflow"] as const;
	static VALID_OBJECT_TABLES = ["accounts", "initial:accounts", "transfers", "initial:transfers", "business_info"] as const;
	static VALID_REDIRECT_ENDPOINTS = ["integrations", "dashboard", "summary", "tax-details"] as const;

	/* As new tables get added, implement them here -- otherwise they just pull from the response table */
	public static objectToTable: ObjectTableMap = { business_info: { table: "integration_data.accounting_business_info", columns: ["*"], whereColumns: ["id", "platform_id"] } };

	static async getBusinessPlatformConnection(businessID: UUID, platform: string): Promise<IDBConnection[]> {
		const getConnectionStatusQuery = `SELECT * FROM integrations.data_connections 
			WHERE business_id = $1 AND 
				platform_id = (
					SELECT id FROM integrations.core_integrations_platforms WHERE code = $2
				)`;

		const getConnectionStatusResult: SqlQueryResult = await sqlQuery({ sql: getConnectionStatusQuery, values: [businessID, platform] });

		return getConnectionStatusResult.rows;
	}

	static async updateBusinessPlatformConnectionStatus(businessID: UUID, platform: string): Promise<void> {
		const updateConnectionQuery = `UPDATE integrations.data_connections
			SET connection_status = $1
			WHERE business_id = $2 AND
				platform_id = (
					SELECT id FROM integrations.core_integrations_platforms WHERE code = $3
				)`;

		await sqlQuery({ sql: updateConnectionQuery, values: [CONNECTION_STATUS.REVOKED, businessID, platform] });
	}

	static async getObject({ business_id, object, page = 1, params = {} }: ObjectRequest): Promise<ObjectResponse> {
		const validated = validate({ object, page, params });

		//Default table and columns to be the object type
		let table = `${AccountingRest.SCHEMA}.request_response`;
		let columns = ["request_id", "response", "request_code", "idempotency_key", "requested_at", "request_received", "platform_id"];
		let query = db.queryBuilder().where({ business_id });
		const recordType = AccountingRest.objectToTable[object];
		if (recordType && AccountingRest.objectToTable.hasOwnProperty(object)) {
			table = recordType.table;
			columns = recordType.columns;
			query = AccountingRest.buildCommonQuery(object, query, validated.params, recordType.whereColumns, columnToActualMap[object]);
		} else {
			query.where("request_type", object);
			query = AccountingRest.buildCommonQuery(object, query, validated.params, ["id", ...columns], columnToActualMap.IRequestResponse);
		}
		query = query.table(table).select(columns);

		let records = await query;
		const out: any = {};
		if (records && records[0] && hasAggregation(query)) {
			out[object] = {};
			const firstKey = Object.keys(records[0])[0];
			out.groupBy = firstKey;
			records.forEach(record => (out[object][record[firstKey]] = record));
		} else {
			out.page = page;
			out[object] = records;
			//Only get the total # if page == 1
			if (validated.page == 1) {
				out["total"] = await getTotalRecordCount(query);
			}
		}
		return out;
	}
	static async getReport<T>({ business_id, case_id, task_id, report, page = 1, params = {} }: ReportRequest): Promise<ReportResponse> {
		const validated = validate({ report, page, params });
		if (case_id && !business_id) {
			// Get business_id from case_id
			const caseRecord = await Cases.getById(case_id);
			if (!caseRecord) {
				throw new AccountingApiError("Case record not found for the provided case_id", { case_id });
			}
			business_id = caseRecord.getRecord().business_id;
		}
		if (!business_id) {
			throw new AccountingApiError("business_id or case_id must be provided", { business_id, case_id });
		}

		if (!task_id) {
			try {
				const reportToTask = new Map<ReportTable, TaskCode>();
				reportToTask.set("accounting_balancesheet", "fetch_balance_sheet");
				reportToTask.set("accounting_incomestatement", "fetch_profit_and_loss_statement");
				reportToTask.set("accounting_cashflow", "fetch_cash_flow");
				const taskCode = reportToTask.get(report);
				if (taskCode) {
					const mostRecentTask = await TaskManager.findOneTask({ business_id: business_id, query: { task_status: TASK_STATUS.SUCCESS, task_code: taskCode } });
					task_id = mostRecentTask?.id ?? undefined;
					logger.debug(`Set most recent task to ${task_id}`);
				}
			} catch (ex) {
				logger.warn("exception finding most recent task for report -- not filtering by task");
				task_id = undefined;
			}
		}
		const reportQuery = AccountingRest.getReportQuery({ report, query: params, business_id, case_id, task_id });
		let records = await reportQuery;

		// if revenue is 0 then find for different sources
		const revenue = await this.revenueFallback(business_id);
		if (report === "accounting_incomestatement" && records && records.length) {
			for (let i = 0; i < records.length; i++) {
				if (parseFloat(records[i].total_revenue) === 0) {
					// check for fallback
					records[i].total_revenue = revenue;
				}
			}
		}

		const out: any = {};
		if (records && records[0] && hasAggregation(reportQuery)) {
			out[report] = {};
			const firstKey = Object.keys(records[0])[0];
			out.groupBy = firstKey;
			out.total_revenue = revenue;
			records.forEach(record => (out[report][record[firstKey]] = record));
		} else {
			out.page = page;
			out[report] = records;
			out.total_revenue = revenue;
			//Only get the total # if page == 1
			if (validated.page == 1) {
				out.total_items = await getTotalRecordCount(reportQuery);
			}
		}

		return out;
	}

	static async revenueFallback(businessID: string): Promise<number | null> {
		// 1. check for bulk-update json
		const revenueUpdateDataFromS3 = await getRawIntegrationDataFromS3(businessID, "BulkUpdateBusinessMap", DIRECTORIES.MANUAL, "MANUAL", false);
		if (revenueUpdateDataFromS3?.data?.is_revenue) {
			return parseFloatNum(revenueUpdateDataFromS3.data.is_revenue);
		}

		// 2. if not found then check into bulk-create json
		const revenueCreateDataFromS3 = await getRawIntegrationDataFromS3(businessID, "bulkCreateBusinessMapper", DIRECTORIES.MANUAL, "MANUAL", false);
		if (revenueCreateDataFromS3?.data?.is_revenue) {
			return parseFloatNum(revenueCreateDataFromS3.data.is_revenue);
		}

		// 3. check for plaid
		const revenuePlaidDataFromS3: { income_statements: Array<{ total_income: string }> } | null = await getRawIntegrationDataFromS3(
			businessID,
			"incomestatement",
			DIRECTORIES.ACCOUNTING,
			"PLAID",
			false
		);
		if (revenuePlaidDataFromS3?.income_statements?.length) {
			let revenue: number = 0.0;
			revenuePlaidDataFromS3.income_statements.forEach(income => {
				revenue += parseFloatNum(income.total_income);
			});
			return revenue;
		}

		// 4. check for equifax
		const revenueEquifaxDataFromS3 = await getRawIntegrationDataFromS3(businessID, "judgementsLiens", DIRECTORIES.EQUIFAX, "EQUIFAX", false);
		if (revenueEquifaxDataFromS3?.corpamount) {
			return parseFloatNum(revenueEquifaxDataFromS3.corpamount);
		}

		return null;
	}

	/* Handle Where Clause Generation */
	static buildCommonQuery<T extends object>(object: string, queryBuilder: Knex.QueryBuilder, params, validColumns: string[], columnToActualMap?): Knex.QueryBuilder<T> {
		const groupByRubric = params.groupBy && aggregations && aggregations[object] && aggregations[object][params.groupBy] ? aggregations[object][params.groupBy] : null;

		if (!params.limit) {
			params.limit = AccountingRest.PAGE_SIZE;
		}
		if (params.limit && params.limit != "all") {
			const offset = params.limit * ((params.page || 1) - 1);
			queryBuilder.limit(params.limit, { skipBinding: true }).offset(offset, { skipBinding: true });
		}

		if (groupByRubric) {
			queryBuilder = applyGroupBy(queryBuilder, groupByRubric);
			//When a "where" is set, we do not apply any of the filtering logic
			if (groupByRubric.where) {
				return queryBuilder;
			}
		}
		for (const column in params) {
			let value = params[column];
			if (validColumns && validColumns.includes(column)) {
				if (column && value) {
					queryBuilder = applyConditionToQuery({ query: queryBuilder, condition: { column, operator: "=", value }, validColumns, columnToActualMap });
				}
			} else if (column === "filter") {
				queryBuilder = applyWhereClausesFromFilter({ filter: value, validColumns, queryBuilder, columnToActualMap });
			}
		}
		return queryBuilder;
	}

	private static getReportQuery({ report, query, business_id, case_id, task_id }): Knex.QueryBuilder<any> {
		const validated = validate({ report, params: query });

		try {
			if (!business_id) {
				throw new AccountingApiError("business_id or connection_id must be provided", { business_id });
			}
			const joinConditions = {
				tableName: "integrations.data_business_integrations_tasks",
				leftColumnName: "data_business_integrations_tasks.id",
				rightColumnName: `${report}.business_integration_task_id`
			};
			let reportQuery = db(`${AccountingRest.SCHEMA}.${report}`)
				.select([`${report}.*`, "data_business_integrations_tasks.task_status"])
				.where(`${report}.business_id`, business_id)
				.join(joinConditions.tableName, joinConditions.leftColumnName, joinConditions.rightColumnName)
				.orderBy(validated.params.orderBy || "start_date", validated.params.orderDirection || "desc");
			if (case_id || task_id) {
				// overwrite the report table's business_integration_task_id as this value for this case
				reportQuery.select(`${report}_tasks.task_id AS business_integration_task_id`);
				reportQuery.join(`integration_data.${report}_tasks`, function () {
					this.on(`${report}_tasks.id`, "=", `${report}.id`);
					this.on(`${report}_tasks.task_id`, "=", "data_business_integrations_tasks.id");
				});
				if (case_id) {
					reportQuery.select("data_cases.id as case_id");
					reportQuery.join("public.data_cases", "data_cases.score_trigger_id", "data_business_integrations_tasks.business_score_trigger_id");
					reportQuery.where("data_cases.id", case_id);
				} else {
					reportQuery.where(`${report}_tasks.task_id`, task_id);
				}
			}
			const validColumns = ["start_date", "end_date", "id", "platform_id", "external_id", "business_integration_task_id", "created_at", "updated_at"];
			reportQuery = AccountingRest.buildCommonQuery(report, reportQuery, validated.params, validColumns);
			return reportQuery;
		} catch (ex) {
			logger.error(ex);
			throw new AccountingApiError("Could not generate report query", { exception: ex, params: query });
		}
	}

	/**
	 * This function is used to initialize the tax-status consent
	 * @param {Object} params
	 * @param {Object} headers
	 * @returns {Object} response
	 */
	static async taxStatusConsentInit<T>({ case_id, redirect_endpoint, connection_phase }, { business_id }, headers: any, userInfo: { user_id: UUID }) {
		try {
			const getBusinessConnectionQuery = `SELECT integrations.data_connections.id, integrations.data_connections.connection_status FROM integrations.data_connections
				LEFT JOIN data_cases ON data_cases.business_id = integrations.data_connections.business_id
				WHERE integrations.data_connections.business_id = $1 AND
					platform_id = (SELECT id FROM integrations.core_integrations_platforms WHERE code = 'tax_status')`;

			const getBusinessConnectionResult = await sqlQuery({ sql: getBusinessConnectionQuery, values: [business_id] });

			if (!getBusinessConnectionResult.rowCount) {
				throw new AccountingApiError("No business connection found", {}, StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
			}

			if (getBusinessConnectionResult.rows[0]["connection_status"] === CONNECTION_STATUS.SUCCESS) {
				return { data: { is_tax_status_connected: true }, message: "A connected tax status account has been located." };
			}

			let { data } = await getBusinessDetailsForTaxConsent(business_id);

			if (!Object.keys(data).length) {
				logger.error({ data, case_id, business_id }, "TaxStatus getBusinessDetailsForTaxConsent");
				throw new AccountingApiError("No business details found", data, StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
			}

			try {
				data.address_state = convertState(data.address_state);
			} catch (ex) {}

			// mobile number consistencies
			// mobile number should be send without country code and '+' sign, only 10 digits
			let mobileArray;
			if (data.mobile) {
				mobileArray = formatNumberWithoutPlus(data.mobile, false);
				data.mobile = `${mobileArray[1]}`;
			}
			if (data.owner_mobile) {
				mobileArray = formatNumberWithoutPlus(data.owner_mobile, false);
				data.owner_mobile = `${mobileArray[1]}`;
			}

			let integrationTaskID = "";
			if (connection_phase === "POST_ONBOARDING") {
				const tasks = await executeOtherTasksOnApplicationEdit(INTEGRATION_ID.TAX_STATUS, business_id, headers.authorization, {
					action: "connected",
					integration_category: "Taxation",
					integration_platform: "Tax Status"
				});
				// We can directly assign the integrationTaskID as zeroth task id because there exists only 1 task for TAX_STATUS platform
				integrationTaskID = tasks[0].id;
			} else {
				const getBusinessIntegrationID = await sqlQuery({
					sql: `SELECT * FROM integrations.data_business_integrations_tasks WHERE
					business_score_trigger_id = (SELECT integrations.business_score_triggers.id FROM integrations.business_score_triggers 
						INNER JOIN data_cases ON data_cases.score_trigger_id = integrations.business_score_triggers.id WHERE data_cases.business_id = $1 
						AND integrations.business_score_triggers.trigger_type = $2 AND data_cases.id = $3) AND task_status = $4
					AND integration_task_id IN (SELECT id FROM integrations.rel_tasks_integrations WHERE platform_id IN
						(SELECT id FROM integrations.core_integrations_platforms WHERE category_id = (SELECT id FROM integrations.core_categories WHERE code = $5)
						AND code = $6))`,
					values: [business_id, "ONBOARDING_INVITE", case_id, "CREATED", "taxation", "tax_status"]
				});
				integrationTaskID = getBusinessIntegrationID.rows[0]["id"];
			}

			const consentPayload = {
				callback: `${envConfig.TAX_STATUS_CALLBACK_URL}/${integrationTaskID}`,
				onSuccess: redirect_endpoint ? `${envConfig.APPLICANT_FRONTEND_BASE_URL}/${redirect_endpoint}` : envConfig.TAX_STATUS_SUCCESS_REDIRECT_URL,
				participants: {
					individuals: [
						{
							firstName: data.first_name,
							lastName: data.last_name,
							ssn: data.ssn,
							mobile: data.owner_mobile || "",
							address: {
								addressType: "domestic",
								street: data.address_line_1,
								city: data.address_city,
								state: data.address_state,
								zip: data.address_postal_code,
								country: data.owner_country || "United States"
							},
							businesses: [
								{
									ein: data.tin,
									businessName: data.business_name,
									phone: data.mobile || data.owner_mobile || "",
									title: data.title,
									collectTaxRecords: true,
									address: {
										addressType: "domestic",
										street: data.address_line_1,
										city: data.address_city,
										state: data.address_state,
										zip: data.address_postal_code,
										country: data.business_country || "United States"
									}
								}
							]
						}
					]
				}
			};

			const response = await taxApi.send(consentPayload, TAX_STATUS_ENDPOINTS.TAXPAYERS);

			const updateConnectionInfo = `UPDATE integrations.data_connections
				SET configuration = $1, connection_status = $2 
				WHERE id = $3 AND business_id = $4 AND platform_id = (SELECT id FROM integrations.core_integrations_platforms WHERE code = 'tax_status')`;

			await sqlQuery({ sql: updateConnectionInfo, values: [response, CONNECTION_STATUS.INITIALIZED, getBusinessConnectionResult.rows[0]["id"], business_id] });

			if (connection_phase !== "POST_ONBOARDING") {
				const auditMessage = {
					business_name: data.business_name,
					business_id: business_id,
					case_id: case_id,
					integration_category: "Taxation",
					integration_platform: "Tax Status",
					applicant_id: userInfo.user_id
				};

			// Create an audit log
			await producer.send({ 
				topic: kafkaTopics.NOTIFICATIONS, 
				messages: [{ 
					key: business_id, 
					value: { 
						event: kafkaEvents.INTEGRATION_CONNECTED_AUDIT,
						...auditMessage 
					}
				}] 
			});
			}

			return { data: { is_tax_status_connected: false, consent_link: response.ConsentLinks[0].ConsentLink }, message: "TaxStatus consent process has been started." };
		} catch (error) {
			throw error;
		}
	}

	static formatBalanceSheet(balanceSheetData: any[]): Record<string, any> {
		const formattedData: Record<string, any> = {};

		// Helper function to deduplicate items based on `name`
		const deduplicateItems = (items: any[]): any[] => {
			const seen = new Set();
			return items.filter(item => {
				const identifier = item.name;
				if (seen.has(identifier)) {
					return false;
				}
				seen.add(identifier);
				return true;
			});
		};

		// Helper function to recursively flatten nested items and parse their values
		const extractItems = (items: any[]): any[] => {
			const result: any[] = [];
			items.forEach(item => {
				if (item.value !== null && item.value !== undefined) {
					const value = parseFloat(item.value);
					if (!isNaN(value)) {
						result.push({ name: item.name, value });
					}
				}
				if (item.items && Array.isArray(item.items)) {
					result.push(...extractItems(item.items));
				}
			});
			return deduplicateItems(result);
		};

		// Calculate totals from a list of items
		const calculateTotal = (items: any[]): number => {
			return items.reduce((sum, item) => sum + (item.value || 0), 0);
		};

		// Process each entry in the balance sheet data
		for (const entry of balanceSheetData) {
			const year: number = new Date(entry.start_date).getFullYear(); // Extract year from `start_date`

			if (!formattedData[year]) {
				formattedData[year] = {
					end_date: entry.end_date,
					assets: { checking_savings: [], other_current_assets: [], fixed_assets: [], deposit_assets: [] },
					liabilities_and_equity: { liabilities: { current_liabilities: [], long_term_liabilities: [] }, equity: [] }
				};
			}

			// Extract and categorize Assets
			if (entry.assets?.items) {
				entry.assets.items.forEach(item => {
					const extractedItems = extractItems([item]);

					extractedItems.forEach(extractedItem => {
						if (["Checking", "Savings", "Bank Accounts"].includes(extractedItem.name)) {
							formattedData[year].assets.checking_savings.push(extractedItem);
						} else if (["Fixed Assets", "Long-Term Assets"].includes(item.name)) {
							formattedData[year].assets.fixed_assets.push(extractedItem);
						} else {
							formattedData[year].assets.other_current_assets.push(extractedItem);
						}
					});
				});
			}

			// Extract and categorize Liabilities
			if (entry.liabilities?.items) {
				entry.liabilities.items.forEach(item => {
					if (item.name === "Long-Term Liabilities") {
						formattedData[year].liabilities_and_equity.liabilities.long_term_liabilities.push(...extractItems([item]));
					} else if (item.name === "Current Liabilities") {
						formattedData[year].liabilities_and_equity.liabilities.current_liabilities.push(...extractItems([item]));
					}
				});
			}

			// Extract Equity
			if (entry.equity?.items) {
				formattedData[year].liabilities_and_equity.equity.push(...extractItems(entry.equity.items));
			}

			// Deduplicate items
			const dedupe = (category: any[]) => deduplicateItems(category);
			const yearAssets = formattedData[year].assets;
			const yearLiabilities = formattedData[year].liabilities_and_equity.liabilities;
			const yearEquity = formattedData[year].liabilities_and_equity.equity;

			const assetTypes = ["checking_savings", "other_current_assets", "fixed_assets", "deposit_assets"];

			assetTypes.forEach(assetType => {
				yearAssets[assetType] = dedupe(yearAssets[assetType]);
			});

			const liabilitiesTypes = ["current_liabilities", "long_term_liabilities"];

			liabilitiesTypes.forEach(liabilityType => {
				yearLiabilities[liabilityType] = dedupe(yearLiabilities[liabilityType]);
			});

			formattedData[year].liabilities_and_equity.equity = dedupe(yearEquity);

			// Calculate totals
			const totalCheckingSavings = calculateTotal(yearAssets.checking_savings);
			const totalOtherCurrentAssets = calculateTotal(yearAssets.other_current_assets);
			const totalFixedAssets = calculateTotal(yearAssets.fixed_assets);
			const totalDepositAssets = calculateTotal(yearAssets.deposit_assets);

			const totalCurrentAssets = totalCheckingSavings + totalOtherCurrentAssets;
			const totalAssets = totalCurrentAssets + totalFixedAssets + totalDepositAssets;

			const totalCurrentLiabilities = calculateTotal(yearLiabilities.current_liabilities);
			const totalLongTermLiabilities = calculateTotal(yearLiabilities.long_term_liabilities);
			const totalLiabilities = totalCurrentLiabilities + totalLongTermLiabilities;

			const totalEquity = calculateTotal(yearEquity);

			formattedData[year].assets.total_assets = totalAssets;
			formattedData[year].assets.total_checking_savings = totalCheckingSavings;
			formattedData[year].assets.total_other_current_assets = totalOtherCurrentAssets;
			formattedData[year].assets.total_fixed_assets = totalFixedAssets;
			formattedData[year].assets.total_deposit_assets = totalDepositAssets;

			formattedData[year].liabilities_and_equity.total_current_liabilities = totalCurrentLiabilities;
			formattedData[year].liabilities_and_equity.total_long_term_liabilities = totalLongTermLiabilities;
			formattedData[year].liabilities_and_equity.total_liabilities = totalLiabilities;
			formattedData[year].liabilities_and_equity.total_equity = totalEquity;
			formattedData[year].liabilities_and_equity.total_liabilities_and_equity = totalLiabilities + totalEquity;
		}

		// Filter out the last 3 years from formattedData
		const last3Years = Object.keys(formattedData)
			.map(Number)
			.sort((a, b) => b - a)
			.slice(0, 3)
			.reduce((acc, year) => {
				acc[year] = formattedData[year];
				return acc;
			}, {});

		return last3Years;
	}

	static formatIncomeStatement(incomeStatementData) {
		const groupedByYear = {};

		const processCategoryItems = (items, category, subCategoryPath, year, groupedByYear) => {
			items.forEach(item => {
				if (!item.name) return;
				const accountName = item.name;
				const accountValue = parseFloat(item.value) || 0;

				// Construct sub-category path (e.g., 'Revenue > Sales')
				const currentPath = subCategoryPath ? `${subCategoryPath} > ${accountName}` : accountName;

				// Initialize category and sub-category in grouped data
				if (!groupedByYear[year].income_statement[category][currentPath]) {
					groupedByYear[year].income_statement[category][currentPath] = 0;
				}

				groupedByYear[year].income_statement[category][currentPath] += accountValue;
				groupedByYear[year].income_statement[`total_${category}`] += accountValue;

				// Recur for nested items
				if (item.items && item.items.length > 0) {
					processCategoryItems(item.items, category, currentPath, year, groupedByYear);
				}
			});
		};

		incomeStatementData.forEach(row => {
			const year = new Date(row.start_date).getFullYear();

			// Initialize year entry if it doesn't exist
			if (!groupedByYear[year]) {
				groupedByYear[year] = {
					year: year,
					start_date: `01/${year.toString()?.slice(-2)}`,
					end_date: `12/${year.toString()?.slice(-2)}`,
					income_statement: { revenue: {}, cost_of_goods_sold: {}, expenses: {}, total_revenue: 0, total_cost_of_goods_sold: 0, total_expenses: 0, gross_profit: 0, net_income: 0 }
				};
			}

			// Process Revenue, Cost of Goods Sold, and Expenses
			["revenue", "cost_of_sales", "expenses"].forEach(categoryKey => {
				const categoryData = row[categoryKey];
				if (categoryData && categoryData.items?.length) {
					const categoryName = categoryKey === "revenue" ? "revenue" : categoryKey === "cost_of_sales" ? "cost_of_goods_sold" : "expenses";
					processCategoryItems(categoryData.items, categoryName, "", year, groupedByYear);
				}
			});
		});

		// Post-process each year's data
		for (const year in groupedByYear) {
			const incomeStatement = groupedByYear[year].income_statement;

			// Calculate Gross Profit and Net Income
			incomeStatement.gross_profit = incomeStatement.total_revenue - incomeStatement.total_cost_of_goods_sold;
			incomeStatement.net_income = incomeStatement.gross_profit - incomeStatement.total_expenses;

			// If all expenses are zero, set expenses to an empty object
			const totalExpensesValue = Object.values(incomeStatement.expenses).reduce<number>((sum, value) => sum + (value as number), 0);
			if (totalExpensesValue === 0) {
				incomeStatement.expenses = {};
			}
		}

		// Filter out the last 3 years from formattedData
		const last3Years = Object.keys(groupedByYear)
			.map(Number)
			.sort((a, b) => b - a)
			.slice(0, 3)
			.reduce((acc, year) => {
				acc[year] = groupedByYear[year];
				return acc;
			}, {});

		return Object.values(last3Years);
	}

	public static async getBalanceSheet({ businessID, caseID }) {
		try {
			let getBalancesheet;
			if (caseID) {
				// Fetch the case record from the database
				const caseRecord = await db.select("*").from("public.data_cases").where({ id: caseID }).first();
				if (!caseRecord) {
					throw new Error(`Case ${caseID} not found`);
				}

				// Convert the case's created_at timestamp to a UTC ISO string for comparison
				const caseDate = dayjs.utc(caseRecord.created_at).toISOString();

				getBalancesheet = await db
					.select("accounting_balancesheet.*")
					.from("integration_data.accounting_balancesheet")
					.where("accounting_balancesheet.business_id", businessID)
					.andWhereRaw(`DATE_TRUNC('minute', accounting_balancesheet.created_at) <= DATE_TRUNC('minute', ?::timestamp)`, [caseDate]);
			} else {
				getBalancesheet = await db.select("accounting_balancesheet.*").from("integration_data.accounting_balancesheet").where({ "accounting_balancesheet.business_id": businessID });
			}

			const formattedBalanceSheet = AccountingRest.formatBalanceSheet(getBalancesheet);

			return formattedBalanceSheet;
		} catch (error) {
			throw error;
		}
	}

	public static async getIncomeStatement({ businessID, caseID }) {
		try {
			let getProfitLossStatement;
			if (caseID) {
				// Fetch the case record from the database
				const caseRecord = await db.select("*").from("public.data_cases").where({ id: caseID }).first();
				if (!caseRecord) {
					throw new Error(`Case ${caseID} not found`);
				}

				getProfitLossStatement = await db.select("accounting_incomestatement.*").from("integration_data.accounting_incomestatement").where("accounting_incomestatement.business_id", businessID);
			} else {
				getProfitLossStatement = await db.select("accounting_incomestatement.*").from("integration_data.accounting_incomestatement").where({ "accounting_incomestatement.business_id": businessID });
			}

			const formattedProfitLoss = AccountingRest.formatIncomeStatement(getProfitLossStatement);

			return formattedProfitLoss;
		} catch (error) {
			throw error;
		}
	}

	public static async getAllAccountingIntegrations({ businessID }: { businessID: UUID }): Promise<IntegrationResponse[]> {
		try {
			const category: IntegrationCategory = "ACCOUNTING";
			const getIntegrations = await db
				.select("data_connections.*", "core_integrations_platforms.label", "core_integrations_platforms.code")
				.from("integrations.data_connections")
				.join("integrations.core_integrations_platforms", "core_integrations_platforms.id", "=", "data_connections.platform_id")
				.where({ "data_connections.business_id": businessID, "core_integrations_platforms.category_id": INTEGRATION_CATEGORIES[category] });

			if (!getIntegrations) {
				// this means integration does not exists
				throw new AccountingApiError("No integrations found", {}, StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
			}
			const records = getIntegrations.map(integration => {
				const { id: connection_id, connection_status: status, business_id, platform_id, label: platform_label, code: platform_code } = integration;

				return { business_id, connection_id, status, platform_id, category, platform_label, platform_code } as IntegrationResponse;
			});
			return records;
		} catch (error) {
			throw error;
		}
	}

	static async revokeTaxStatus(params: RevokeTaxStatusParams, query: RevokeTaxStatusQuery, headers: RevokeTaxStatusHeaders, userInfo: RevokeTaxStatusUserInfo) {
		try {
			// check for applicant business
			const records = await getBusinessApplicants(params.businessID, headers.authorization);
			const applicants = records.map(applicant => applicant.id);

			if (!applicants.includes(userInfo.user_id)) {
				throw new AccountingApiError("You are not allowed to access details of this business", {}, StatusCodes.UNAUTHORIZED, ERROR_CODES.UNAUTHENTICATED);
			}

			const getConnectionStatusResult: IDBConnection[] = await AccountingRest.getBusinessPlatformConnection(params.businessID, "tax_status");

			if (!getConnectionStatusResult.length) {
				throw new AccountingApiError("Connection not found for given business.", {}, StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
			}

			if (getConnectionStatusResult[0].connection_status === CONNECTION_STATUS.REVOKED) {
				throw new AccountingApiError("Connection is already revoked.", {}, StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
			}

			if (getConnectionStatusResult[0].connection_status === CONNECTION_STATUS.CREATED) {
				throw new AccountingApiError("Connection is in created state only.", {}, StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
			}

			let sendEvent = false;
			let customerID: string = "";
			const payload = { business_id: params.businessID, integration_category: "Taxation", integration_platform: "Tax Status" };
			if (query && query.invitation_id) {
				// fetch customer-id related to invitation-id
				const data = await getInvitationDetails(query.invitation_id);

				if (!data || !data.customer_id) {
					throw new AccountingApiError("Invitation details not found", {}, StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
				}

				customerID = data.customer_id;
				sendEvent = true;
			}

			// if task-status is not in [CREATED, SUCCESS, FAILED, ERRORED] then only allow to revoke
			const getTaskIdsQuery = `SELECT * FROM integrations.data_business_integrations_tasks 
				WHERE connection_id = $1 AND 
				task_status NOT IN ('CREATED', 'SUCCESS', 'FAILED', 'ERRORED')`;

			const getTaskIdsResult: SqlQueryResult = await sqlQuery({ sql: getTaskIdsQuery, values: [getConnectionStatusResult[0].id] });

			if (getConnectionStatusResult[0].connection_status === CONNECTION_STATUS.SUCCESS && getTaskIdsResult.rows.length) {
				throw new AccountingApiError("Cannot revoke integration now.", {}, StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
			}

			const { data } = await getBusinessDetailsForTaxConsent(params.businessID);

			if (!Object.keys(data).length) {
				logger.error({ data, business_id: params.businessID }, "TaxStatus getBusinessDetailsForTaxConsent");
				throw new AccountingApiError("No business details found", data, StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
			}

			const taxStatusRevokePayload = { tin: data.tin, isCompany: data.title === "Sole Proprietor" ? 0 : 1 };

			// tax-status does not directly provide any information about revoke in their doucmentation
			// but in reponse got success as message if all good
			const taxStatusResponse = await taxApi.send(taxStatusRevokePayload, TAX_STATUS_ENDPOINTS.REVOKE);

			if (!Object.hasOwn(taxStatusResponse, "Message") || taxStatusResponse.Message !== "Success") {
				if (sendEvent) {
					await sendWebhookEvent(customerID, WEBHOOK_EVENTS.INTEGRATION_FAILED, payload);
				}
				logger.error({ taxStatusResponse }, "TaxStatus Revoke failed");
				throw new AccountingApiError("Something went wrong while revoking.", { taxStatusResponse }, StatusCodes.INTERNAL_SERVER_ERROR, ERROR_CODES.UNKNOWN_ERROR);
			}

			await AccountingRest.updateBusinessPlatformConnectionStatus(params.businessID, "tax_status");

			if (sendEvent) {
				await sendWebhookEvent(customerID, WEBHOOK_EVENTS.INTEGRATION_DISCONNECTED, payload);
			}

			await executeOtherTasksOnApplicationEdit(INTEGRATION_ID.TAX_STATUS, params.businessID, headers.authorization, {
				action: "revoked",
				integration_category: "Taxation",
				integration_platform: "Tax Status"
			});
		} catch (error) {
			throw error;
		}
	}

	/**
	 * Revokes accounting for a given business.
	 *
	 * @param params - The parameters for revoking accounting.
	 * @param headers - The headers for the request.
	 * @param userInfo - The user information.
	 * @throws {AccountingApiError} If the user is not allowed to access the business details,
	 * if the connection is not found for the given business,
	 * if the connection is already revoked,
	 * if the connection is in the created state only,
	 * or if something goes wrong while revoking.
	 */
	static async revokeAccounting(params: RevokeAccountingParams, headers: RevokeAccountingHeaders, userInfo: RevokeAccountingUserInfo, body: RevokeAccountingBody) {
		try {
			const { businessID } = params;

			// check for applicant business
			const records = await getBusinessApplicants(businessID, headers.authorization);
			const applicants = records.map(applicant => applicant.id);

			if (!applicants.includes(userInfo.user_id)) {
				throw new AccountingApiError("You are not allowed to access details of this business", {}, StatusCodes.UNAUTHORIZED, ERROR_CODES.UNAUTHENTICATED);
			}

			let sendEvent = false;
			let customerID: string = "";
			if (body.invitation_id) {
				// fetch customer-id related to invitation-id
				const data = await getInvitationDetails(body.invitation_id);

				if (!data || !data.customer_id) {
					throw new AccountingApiError("Invitation details not found", {}, StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
				}

				customerID = data.customer_id;
				sendEvent = true;
			}

			if (body.platforms.length > 0) {
				for (const bodyInput of body.platforms) {
					const { platform } = bodyInput;
					logger.info(`Revoking connection for business: ${businessID} and platform: ${platform}`);
					// check for connection status
					const getConnectionStatusResult: IDBConnectionEgg[] = await AccountingRest.getBusinessPlatformConnection(businessID, platform);
					if (!getConnectionStatusResult.length) {
						throw new AccountingApiError(`Connection not found for given business and platform: ${platform}`, {}, StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
					}

					if (getConnectionStatusResult[0].connection_status === CONNECTION_STATUS.REVOKED) {
						throw new AccountingApiError("Connection is already revoked.", {}, StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
					}

					if (getConnectionStatusResult[0].connection_status === CONNECTION_STATUS.CREATED) {
						throw new AccountingApiError("Connection is in created state only.", {}, StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
					}

					const rutterConnectionId = getConnectionStatusResult[0].configuration.connection.id;
					const rutter = new Rutter();

					const payload = { business_id: businessID, integration_category: "Accounting", integration_platform: platform };

					try {
						// deactivate/revoke rutter connection
						const accountingRevokeResponse = await rutter.deactivateRutterConnection(rutterConnectionId);
						if (!accountingRevokeResponse) {
							logger.error({ accounting_revoke_response: accountingRevokeResponse }, "Accounting Revoke failed");
							throw new AccountingApiError("Something went wrong while revoking.", { accountingRevokeResponse }, StatusCodes.INTERNAL_SERVER_ERROR, ERROR_CODES.UNKNOWN_ERROR);
						}
						// updating database connection status
						await AccountingRest.updateBusinessPlatformConnectionStatus(businessID, platform);
						const getIntegrationID = `SELECT id, label FROM integrations.core_integrations_platforms WHERE code = $1`;

						const integrationIDResult = await sqlQuery({ sql: getIntegrationID, values: [platform] });
						await executeOtherTasksOnApplicationEdit(integrationIDResult.rows[0]["id"], businessID, headers.authorization, {
							action: "revoked",
							integration_category: "Accounting",
							integration_platform: integrationIDResult.rows[0]["label"]
						});
					} catch (error) {
						if (sendEvent) {
							await sendWebhookEvent(customerID, WEBHOOK_EVENTS.INTEGRATION_FAILED, payload);
						}
						logger.error(`Error during revoke: ${error}`);
						throw error;
					}

					if (sendEvent) {
						await sendWebhookEvent(customerID, WEBHOOK_EVENTS.INTEGRATION_DISCONNECTED, payload);
					}
				}
			}
		} catch (error) {
			throw error;
		}
	}

	/**
	 * @description Update the accounting record received as a manual entry from FE
	 * @param params
	 * @param body
	 * @returns
	 */
	static async addBalanceSheet(params: { businessID: UUID }, body: AddAccountingBody, userInfo: UserInfo) {
		try {
			const { businessID } = params;
			const { case_id: caseID, customer_id: customerID } = body;

			// If ocr file upload, prepare the data and store it in the database
			if (body?.validation_ocr_document_ids) {
				if (body.validation_ocr_document_ids.length) {
					const confirmOcrDocumentsQuery = `UPDATE integration_data.uploaded_ocr_documents SET is_confirmed = $1 WHERE business_id = $2 AND category_id = $3 AND id IN (${body?.validation_ocr_document_ids
						.map(id => `'${id}'`)
						.join(",")}) AND job_type = $4`;

					await sqlQuery({ sql: confirmOcrDocumentsQuery, values: [true, businessID, INTEGRATION_CATEGORIES.ACCOUNTING, "validation"] });
				}

				let deleteOcrDocumentsBaseQuery = `DELETE FROM integration_data.uploaded_ocr_documents WHERE business_id = $1 AND category_id = $2 AND job_type = $3`;
				let values = [businessID, INTEGRATION_CATEGORIES.ACCOUNTING, "validation"];
				if (body.validation_ocr_document_ids.length) {
					deleteOcrDocumentsBaseQuery += ` AND id NOT IN (${body?.validation_ocr_document_ids.map(id => `'${id}'`).join(",")})`;
				}
				if (caseID) {
					deleteOcrDocumentsBaseQuery += ` AND case_id = $4`;
					values.push(caseID);
				}
				await sqlQuery({ sql: deleteOcrDocumentsBaseQuery, values });

				// Update connection and task status for manual accounting
				// TODO: Update/Remove this after OCR implementation

				let manualAccounting: ManualAccounting | null = null;
				try {
					const manualAccountingConnection = await getOrCreateConnection(businessID, INTEGRATION_ID.MANUAL_ACCOUNTING);
					manualAccounting = platformFactory({ dbConnection: manualAccountingConnection });
				} catch (ex) {
					manualAccounting = await ManualAccounting.initializeManualAccountingConnection(businessID);
				} finally {
					try {
						if (manualAccounting) {
							// mark connection as success
							await manualAccounting.updateConnectionStatus(CONNECTION_STATUS.SUCCESS, "DOCUMENTS UPLOADED");
							for (const taskCode of taskCodesForAccounting) {
								const manualAccountingTask = await manualAccounting.getLatestTask(businessID, INTEGRATION_ID.MANUAL_ACCOUNTING, taskCode as IntegrationTaskKey, false, undefined, caseID ?? null);
								if (!manualAccountingTask) {
									throw new Error(`No existing task found for ${taskCode} for the business ${businessID}`);
								}
								await manualAccounting.processTask({ taskId: manualAccountingTask.id });
							}
						}
					} catch (err) {
						logger.error(`Error uploading balance sheets for business ${businessID}. Error: ${(err as Error).message}`);
					}
				}
				logger.info(`DOCUMENTS UPLOADED: Balance sheets uploaded for business ${businessID}.`);
				return;
			}
		} catch (error) {
			throw error;
		}
	}

	static async deleteBalanceSheet(params: { businessID: UUID; documentID: UUID }, userInfo: UserInfo) {
		try {
			const { businessID, documentID } = params;
			const getOcrDocumentsBaseQuery = `SELECT * FROM integration_data.uploaded_ocr_documents WHERE business_id = $1 AND category_id = $2 AND job_type = $3 AND id = $4`;
			const getOcrDocumentsBaseQueryResult = await sqlQuery({ sql: getOcrDocumentsBaseQuery, values: [businessID, INTEGRATION_CATEGORIES.ACCOUNTING, "validation", documentID] });
			if (getOcrDocumentsBaseQueryResult?.rows?.length) {
				const deleteOcrDocumentsBaseQuery = `DELETE FROM integration_data.uploaded_ocr_documents WHERE business_id = $1 AND category_id = $2 AND job_type = $3 AND id = $4`;
				await sqlQuery({ sql: deleteOcrDocumentsBaseQuery, values: [businessID, INTEGRATION_CATEGORIES.ACCOUNTING, "validation", documentID] });
			} else {
				throw new AccountingApiError("Record doesn't exits", {}, StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
			}
			return;
		} catch (error) {
			throw error;
		}
	}

	/**
	 * @description Get Accounting statements uploaded for the business
	 * @param params
	 * @param body
	 * @returns
	 */
	static async getAccountingStatements(params: { businessID: UUID }, body: { case_id: UUID }, userInfo: UserInfo) {
		try {
			const { businessID } = params;
			const { case_id: caseID } = body;

			let getOCRAccountingStatementsQuery = `SELECT id, file_name, file_path, extracted_data FROM integration_data.uploaded_ocr_documents WHERE business_id = $1 AND job_type = $2 AND category_id = $3 AND is_confirmed = $4`;
			let values = [businessID, "validation", INTEGRATION_CATEGORIES.ACCOUNTING, true];
			if (caseID) {
				getOCRAccountingStatementsQuery += ` AND case_id = $5`;
				values.push(caseID);
			}
			const getOCRAccountingStatementsResult: SqlQueryResult = await sqlQuery({ sql: getOCRAccountingStatementsQuery, values });

			return getOCRAccountingStatementsResult.rows;
		} catch (error) {
			throw error;
		}
	}

	static async getUploadedAccountingStatements(params: { businessID: UUID }, body: { case_id: UUID }) {
		try {
			const { businessID } = params;
			const { case_id: caseID } = body;

			let getOCRAccountingStatementsQuery = `SELECT id, file_name FROM integration_data.uploaded_ocr_documents WHERE business_id = $1 AND job_type = $2 AND category_id = $3 AND is_confirmed = $4`;
			let values = [businessID, "validation", INTEGRATION_CATEGORIES.ACCOUNTING, true];
			if (caseID) {
				getOCRAccountingStatementsQuery += ` AND case_id = $5`;
				values.push(caseID);
			}
			const getOCRAccountingStatementsResult: SqlQueryResult = await sqlQuery({ sql: getOCRAccountingStatementsQuery, values });

			if (!getOCRAccountingStatementsResult?.rows.length) {
				return [];
			}
			const uploadedStatements: IUploadedStatement[] = [];
			const directory = DIRECTORIES.BUSINESS_ACCOUNTING_STATEMENT_UPLOADS.replace(":businessID", businessID);
			const statementPromises = getOCRAccountingStatementsResult?.rows?.map(async statement => {
				try {
					const path = `${directory}/${statement.file_name}`;
					const fileUrl = (await getCachedSignedUrl(`${statement.file_name}`, directory))?.signedRequest;
					return {
						id: statement.id,
						file_name: statement.file_name,
						file_path: directory,
						file_url: fileUrl
					};
				} catch (error) {
					logger.error({ error }, `Failed to fetch or sign file: ${statement.file_name}`);
					return null;
				}
			});
			const resolvedStatements = await Promise.all(statementPromises);
			uploadedStatements.push(...resolvedStatements.filter(s => s !== null));
			return uploadedStatements;
		} catch (error) {
			throw error;
		}
	}
}

const validate = ({ report, object, params }: IValidation): IValidation => {
	const out = { report, object, params, limit: params?.limit || AccountingRest.PAGE_SIZE, page: params?.page || 1 };
	if ((object && report) || (!object && !report)) {
		throw new AccountingApiError(`Exactly one report or object must be passed in`);
	} else if (object) {
		if (!AccountingRest.VALID_OBJECT_TABLES.includes(object)) {
			throw new AccountingApiError(`Invalid object ${object}`);
		}
	} else if (report) {
		if (!AccountingRest.VALID_REPORT_TABLES.includes(report)) {
			throw new AccountingApiError(`Invalid report ${report}`);
		}
	}

	if (!isValidPage(out.page.toString())) {
		throw new AccountingApiError(`Invalid page ${out.page}`);
	}

	if (!isValidLimit(out.limit.toString())) {
		throw new AccountingApiError(`Invalid limit ${out.limit}`);
	}

	if (params) {
		//default direction if set to an invalid one
		if (params.orderDirection && !["asc", "desc"].includes(params.orderDirection)) {
			delete out.params.orderDirection;
		}
		if (params.throwError) {
			logger.error("Throwing an intentional error!");
			throw new AccountingApiError("This threw an intentional error", {}, StatusCodes.BAD_GATEWAY, ERROR_CODES.UNAUTHENTICATED);
		}
	}
	return out;
};
