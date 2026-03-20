import { TaskHandlerMap } from "#api/v1/modules/tasks/taskManager";
import { envConfig } from "#configs/index";
import { ERROR_CODES } from "#constants";
import { CONNECTION_STATUS, INTEGRATION_ID, IntegrationPlatformId } from "#constants/integrations.constant";
import { db } from "#helpers/knex";
import { logger } from "#helpers/logger";
import { platformFactory } from "#helpers/platformHelper";
import { TDateISO } from "#types/datetime";
import {
	Account,
	AccountType,
	IAccountingAccounts,
	IAccountingBalanceSheet,
	IAccountingCashFlows,
	IAccountingIncomeStatement,
	IAccountingTaskEgg,
	IDBConnection,
	IDBConnectionEgg,
	type IAccountingBusinessInfo
} from "#types/db";
import { JsonObject } from "aws-jwt-verify/safe-json-parse";
import axios, { AxiosResponse } from "axios";
import { UUID } from "crypto";
import { StatusCodes } from "http-status-codes";
import { AccountingBase } from "../../src/api/v1/modules/accounting/accountingBase";
import { AccountingApiError } from "../../src/api/v1/modules/accounting/error";
import {
	APIVersion,
	BalanceSheet,
	CashFlow,
	CompanyInfo,
	ConnectionStatusResponse,
	GenericResponse,
	IBalanceSheet,
	ICashFlowStatement,
	IIncomeStatement,
	ITokenExchangeRequest,
	ITokenExchangeResponse,
	IncomeStatement,
	ObjectType,
	PaginatedResponse,
	PlatformEnum,
	RutterConnectionConfiguration,
	RutterDBConnection,
	WebhookBody,
	rutterObjectTypes
} from "./types";
import { sqlQuery } from "#helpers/index";
import currency = require("currency.js");

const DEFAULT_API_VERSION: APIVersion = "2023-03-14";

export interface AccountsOptions {
	account_type?: AccountType;
}

export class Rutter extends AccountingBase {
	declare dbConnection: RutterDBConnection;
	private rutterConnection: RutterConnectionConfiguration | undefined;
	public PUBLIC_KEY = envConfig.RUTTER_PUBLIC_KEY;
	public static ACCOUNTING_INTEGRATION_IDS = [
		INTEGRATION_ID.RUTTER_QUICKBOOKS,
		INTEGRATION_ID.RUTTER_FRESHBOOKS,
		INTEGRATION_ID.RUTTER_XERO,
		INTEGRATION_ID.RUTTER_NETSUITE,
		INTEGRATION_ID.RUTTER_WAVE,
		INTEGRATION_ID.RUTTER_ZOHO,
		INTEGRATION_ID.RUTTER_QUICKBOOKSDESKTOP
	];

	constructor(dbConnection?: IDBConnection) {
		super(dbConnection);
		if (dbConnection && dbConnection.configuration?.connection) {
			this.rutterConnection = dbConnection.configuration.connection;
		}
	}

	static async getConnectionsForAccessToken(access_token: string): Promise<IDBConnection[]> {
		const connections = await db<IDBConnection>("integrations.data_connections").select("*").whereRaw("configuration->'connection'->>'access_token' = ?", [access_token]);
		if (connections) {
			return connections;
		}
		throw new AccountingApiError(`access_token=${access_token} is not mapped to any business`, { access_token }, StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
	}

	static async fromAccessTokenAndBusiness({ access_token, business_id }: { access_token: string; business_id: UUID }): Promise<Rutter> {
		let connection = await db<IDBConnection>("integrations.data_connections")
			.select("*")
			.where({ business_id })
			.whereRaw("configuration->'connection'->>'access_token' = ?", [access_token])
			.limit(1)
			.first();
		if (connection) {
			return platformFactory({ dbConnection: connection });
		}
		if (business_id) {
			//If we got here, we have no record in our DB of this access token so we need to fetch it
			const service = new Rutter();
			connection = await service.syncConnectionByAccessToken(business_id, access_token);
			if (connection) {
				return platformFactory({ dbConnection: connection });
			}
		}
		throw new AccountingApiError(`Cannot initialize from token ${access_token}`);
	}

	static async fromRutterConnectionId(connection_id: string) {
		try {
			const connection = await Rutter.getConnectionByRutterId(connection_id);
			return platformFactory({ dbConnection: connection });
		} catch (error) {
			throw new AccountingApiError(`Cannot find connection by rutter id ${connection_id}`);
		}
	}

	static async getConnectionByRutterId(connection_id: string): Promise<IDBConnection> {
		try {
			const res = await db<IDBConnection>("integrations.data_connections").select("*").whereRaw("configuration->'connection'->>'id' = ?", [connection_id]).limit(1);
			return res[0];
		} catch (ex) {
			logger.error({ error: ex }, "db exception reached");
		}
		throw new AccountingApiError(`Cannot find connection by rutter id ${connection_id}`);
	}

	taskHandlerMap: TaskHandlerMap = {
		fetch_accounting_records: async () => {
			logger.debug("fetch accounting records");
			const promises = await Promise.all([
				this.getAccounts().then(accounts => this.savePaginatedResponse(accounts, "initial:accounts")),
				this.getBankDeposits().then(deposits => this.savePaginatedResponse(deposits, "initial:deposits")),
				this.getBankTransfers().then(transfers => this.savePaginatedResponse(transfers, "initial:transfers")),
				this.getBalanceSheets().then(balanceSheet => this.savePaginatedResponse(balanceSheet, "initial:balanceSheets")),
				this.getIncomeStatements().then(incomeStatements => this.savePaginatedResponse(incomeStatements, "initial:incomeStatements")),
				this.getExpenses().then(expenses => this.savePaginatedResponse(expenses, "initial:expenses"))
			]);
			return promises.every(v => v);
		},
		fetch_accounting_business_info: async (taskId: UUID) => await this.syncCompanyInfo(taskId).then(out => !!out),
		fetch_balance_sheet: async (taskId: UUID) => await this.syncBalanceSheets(taskId).then(out => !!out),
		fetch_profit_and_loss_statement: async (taskId: UUID) => await this.syncIncomeStatements(taskId).then(out => !!out),
		fetch_cash_flow: async (taskId: UUID) => await this.syncCashFlowStatements(taskId).then(out => !!out),
		fetch_accounting_accounts: async (taskId: UUID) => await this.syncAccountStatements(taskId).then(out => !!out)
	};

	public hasConnection(): boolean {
		return this.rutterConnection != undefined && this.dbConnection != undefined;
	}
	private getPlatformId(platformName: PlatformEnum): IntegrationPlatformId {
		const platformId = INTEGRATION_ID[`RUTTER_${platformName}`];
		if (platformId) {
			return platformId;
		}
		logger.error(`Invalid platform specified: ${platformName}`);
		throw new Error("invalid platform");
	}

	public async initialUpdate(hook: WebhookBody) {
		logger.info(`Inital update received: ${hook.access_token}`);
		if (!this.hasConnection()) {
			logger.error("connection not available");
			return false;
		}
		await this.updateConnectionStatus(CONNECTION_STATUS.INITIALIZED);

		//get task ids
		const taskIds = await this.ensureTasksExist();
		logger.debug(`Fetched task ids: ${taskIds.join(", ")}`);
		/* TODO: This is temp until we get task processing figured out async */
		if (taskIds) {
			await Promise.all(taskIds.map(taskId => this.processTask({ taskId: taskId })));
		}
		await this.updateConnectionStatus(CONNECTION_STATUS.SUCCESS);

		return true;
	}

	/** TODO: Implement webhook callback handlers as needed per class */
	public async callbackHandler(...args: any[]) {}

	//return as "null" if falsy to avoid db errors
	protected externalIdResolver(data) {
		return data.id || null;
	}

	public async syncBalanceSheets(taskId: UUID): Promise<boolean> {
		if (!this.hasConnection()) {
			throw new Error("Rutter connection not initialized");
		}
		const connection = this.getDBConnection();
		const { balance_sheets } = await this.getBalanceSheets();

		let inserts = 0;
		if (connection && balance_sheets) {
			await this.archiveRequest(balance_sheets, "balancesheet");

			for (const balanceSheet of balance_sheets as IBalanceSheet[]) {
				const mappedBalanceSheet: Partial<IAccountingBalanceSheet> = {
					business_integration_task_id: taskId,
					external_id: this.externalIdResolver(balanceSheet),
					business_id: connection.business_id,
					platform_id: connection.platform_id,
					start_date: balanceSheet.start_date,
					end_date: balanceSheet.end_date,
					currency: balanceSheet.currency_code,
					total_assets: balanceSheet.total_assets,
					total_equity: balanceSheet.total_equity,
					total_liabilities: balanceSheet.total_liabilities,
					assets: balanceSheet.assets as unknown as JsonObject,
					equity: balanceSheet.equity as unknown as JsonObject,
					liabilities: balanceSheet.liabilities as unknown as JsonObject,
					meta: balanceSheet.platform_data,
					updated_at: balanceSheet.updated_at || null,
					created_at: new Date().toISOString() as TDateISO
				};
				const insert = await db<IAccountingBalanceSheet>("integration_data.accounting_balancesheet")
					.insert(mappedBalanceSheet)
					.onConflict(["business_id", "platform_id", "external_id"])
					.merge({
						updated_at: db.raw("now()"),
						start_date: db.raw("excluded.start_date"),
						end_date: db.raw("excluded.end_date"),
						currency: db.raw("excluded.currency"),
						total_assets: db.raw("excluded.total_assets"),
						total_equity: db.raw("excluded.total_equity"),
						total_liabilities: db.raw("excluded.total_liabilities"),
						assets: db.raw("excluded.assets"),
						equity: db.raw("excluded.equity"),
						liabilities: db.raw("excluded.liabilities"),
						meta: db.raw("excluded.meta")
					})
					.returning("*");

				if (insert) {
					await db<IAccountingTaskEgg>("integration_data.accounting_balancesheet_tasks")
						.insert({
							id: insert[0].id,
							task_id: taskId
						})
						.onConflict(["id", "task_id"])
						.ignore();

					inserts++;
				}
			}
			return inserts == balance_sheets.length;
		}
		return false;
	}

	public async syncCompanyInfo(taskId: UUID): Promise<boolean> {
		if (!this.hasConnection()) {
			throw new Error("Rutter connection not initialized");
		}
		const connection = this.getDBConnection();

		const { company_info }: { company_info: CompanyInfo["company_info"] } = await this.getCompanyInfo();
		let inserts = 0;
		if (connection && company_info) {
			await this.archiveRequest(company_info, "business_info");

			const mappedCompanyInfo: Partial<IAccountingBusinessInfo> = {
				business_integration_task_id: taskId,
				external_id: company_info.id,
				business_id: connection.business_id,
				platform_id: connection.platform_id,
				currencies: [company_info.currency_code],
				display_name: company_info.name,
				legal_name: company_info.legal_name,
				addresses: { mailing: company_info.addresses },
				meta: company_info,
				updated_at: company_info.updated_at || null,
				created_at: new Date().toISOString() as TDateISO
			};
			const insert = await db<IAccountingBusinessInfo>("integration_data.accounting_business_info")
				.insert(mappedCompanyInfo)
				.returning("*")
				.onConflict(["business_id", "platform_id", "external_id"])
				.merge({
					updated_at: db.raw("now()"),
					currencies: db.raw("excluded.currencies"),
					display_name: db.raw("excluded.display_name"),
					legal_name: db.raw("excluded.legal_name"),
					addresses: db.raw("excluded.addresses"),
					meta: db.raw("excluded.meta")
				});
			if (insert) {
				await db<IAccountingTaskEgg>("integration_data.accounting_business_info_tasks")
					.insert({
						id: insert[0].id,
						task_id: taskId
					})
					.onConflict(["id", "task_id"])
					.ignore();

				inserts++;
			}
		}
		return inserts == 1;
	}

	public async syncIncomeStatements(taskId: UUID): Promise<boolean> {
		if (!this.hasConnection()) {
			throw new Error("Rutter connection not initialized");
		}
		const { income_statements } = await this.getIncomeStatements();
		const connection = this.getDBConnection();
		let inserts = 0;
		if (connection && income_statements) {
			await this.archiveRequest(income_statements, "incomestatement");

			for (const incomeStatement of income_statements as IIncomeStatement[]) {
				let accounting_standard = 3; //"unknown"
				switch (incomeStatement.accounting_standard) {
					case "accrual":
						accounting_standard = 1;
						break;
					case "cash":
						accounting_standard = 2;
						break;
				}

				const getReqResQuery = `SELECT * from integration_data.request_response where business_id = $1 and platform_id = $2`;

				const result = await sqlQuery({ sql: getReqResQuery, values: [connection.business_id, INTEGRATION_ID.MANUAL] });

				const resRevenue = result.rows[0]?.response?.is_revenue;
				let finalRevenue = 0;
				if (resRevenue !== null && incomeStatement.total_income !== null) {
					finalRevenue = (resRevenue + incomeStatement.total_income) / 2;
				} else if (resRevenue !== null) {
					finalRevenue = resRevenue;
				} else if (incomeStatement.total_income !== null) {
					finalRevenue = incomeStatement.total_income;
				} else {
					finalRevenue = 0; // or another default value as appropriate
				}
				const mappedIncomeStatement: Partial<IAccountingIncomeStatement> = {
					external_id: this.externalIdResolver(incomeStatement),
					accounting_standard,
					business_integration_task_id: taskId,
					business_id: connection.business_id,
					platform_id: connection.platform_id,
					start_date: incomeStatement.start_date,
					end_date: incomeStatement.end_date,
					currency: incomeStatement.currency_code,
					net_income: incomeStatement.net_income,
					total_revenue: incomeStatement.total_income,
					total_expenses: incomeStatement.total_expenses,
					total_cost_of_goods_sold: incomeStatement.total_cost_of_sales,
					revenue: finalRevenue || ({} as JsonObject),
					expenses: incomeStatement.expenses as unknown as JsonObject,
					cost_of_sales: incomeStatement.cost_of_sales as unknown as JsonObject,
					meta: incomeStatement.platform_data || ({} as JsonObject),
					updated_at: incomeStatement.updated_at || null,
					created_at: new Date().toISOString() as TDateISO
				};

				const insert = await db<IAccountingIncomeStatement>("integration_data.accounting_incomestatement")
					.insert(mappedIncomeStatement)
					.returning("*")
					.onConflict(["business_id", "platform_id", "external_id"])
					.merge();
				if (insert) {
					await db<IAccountingTaskEgg>("integration_data.accounting_incomestatement_tasks")
						.insert({
							id: insert[0].id,
							task_id: taskId
						})
						.onConflict(["id", "task_id"])
						.ignore();
					inserts++;
				}
			}
			return inserts == income_statements.length;
		}
		return false;
	}

	public async syncAccountStatements(taskId: UUID): Promise<boolean> {
		const [{ accounts: accountsPayable }, { accounts: accountsReceivable }] = await Promise.all([
			this.getAccounts({ account_type: "accounts_payable" }),
			this.getAccounts({ account_type: "accounts_receivable" })
		]);

		const connection = this.getDBConnection();
		let accounts = []
			.concat(accountsPayable)
			.concat(accountsReceivable)
			.filter(v => !!v);

		if (accounts.length && connection) {
			await this.archiveRequest(accountsPayable, "accounts_payable");
			await this.archiveRequest(accountsReceivable, "accounts_receivable");
			const mappedAccountingAccounts = accounts.map(data => {
				const account = data as Account;
				const mappedAccountingAccount: Partial<IAccountingAccounts> = {
					business_integration_task_id: taskId,
					external_id: account.id,
					business_id: connection.business_id,
					platform_id: connection.platform_id,
					currency: account.currency_code,
					balance: account.balance,
					category: account.category,
					status: account.status,
					account_type: account.account_type,
					meta: account,
					updated_at: account.updated_at || null,
					created_at: new Date().toISOString() as TDateISO
				};
				return mappedAccountingAccount;
			});

			const insert = await db<IAccountingAccounts>("integration_data.accounting_accounts")
				.insert(mappedAccountingAccounts)
				.returning("*")
				.onConflict(["business_id", "platform_id", "external_id"])
				.merge({
					updated_at: db.raw("now()"),
					currency: db.raw("excluded.currency"),
					meta: db.raw("excluded.meta"),
					balance: db.raw("excluded.balance"),
					category: db.raw("excluded.category"),
					status: db.raw("excluded.status"),
					account_type: db.raw("excluded.account_type")
				});
			return insert.length === accounts.length;
		}
		return false;
	}

	public async syncCashFlowStatements(taskId: UUID): Promise<boolean> {
		if (!this.hasConnection()) {
			throw new Error("Rutter connection not initialized");
		}
		const { cash_flows } = await this.getCashFlowStatements();
		const connection = this.getDBConnection();

		let inserts = 0;
		if (connection && cash_flows) {
			await this.archiveRequest(cash_flows, "cashflow");
			for (const cashFlow of cash_flows as ICashFlowStatement[]) {
				const mappedCashFlow: Partial<IAccountingCashFlows> = {
					business_integration_task_id: taskId,
					external_id: this.externalIdResolver(cashFlow),
					business_id: connection.business_id,
					platform_id: connection.platform_id,
					start_date: cashFlow.start_date,
					end_date: cashFlow.end_date,
					currency: cashFlow.currency_code,
					starting_balance: cashFlow.starting_balance,
					ending_balance: cashFlow.ending_balance,
					net_flow: currency(cashFlow.ending_balance).subtract(cashFlow.starting_balance).toJSON(),
					gross_cash_in: cashFlow.gross_cash_in_flow,
					gross_cash_out: cashFlow.gross_cash_out_flow,
					total_operating_activities: cashFlow.total_operating,
					total_investing_activities: cashFlow.total_investing,
					total_financing_activities: cashFlow.total_financing,
					operating_activities: cashFlow.operating_activities as unknown as JsonObject,
					investing_activities: cashFlow.investing_activities as unknown as JsonObject,
					financing_activities: cashFlow.investing_activities as unknown as JsonObject,
					meta: cashFlow.platform_data,
					updated_at: cashFlow.updated_at || null,
					created_at: new Date().toISOString() as TDateISO
				};

				const insert = await db<IAccountingCashFlows>("integration_data.accounting_cashflow")
					.insert(mappedCashFlow)
					.returning("*")
					.onConflict(["business_id", "platform_id", "external_id"])
					.merge({
						updated_at: db.raw("now()"),
						start_date: db.raw("excluded.start_date"),
						end_date: db.raw("excluded.end_date"),
						currency: db.raw("excluded.currency"),
						starting_balance: db.raw("excluded.starting_balance"),
						ending_balance: db.raw("excluded.ending_balance"),
						net_flow: db.raw("excluded.net_flow"),
						gross_cash_in: db.raw("excluded.gross_cash_in"),
						gross_cash_out: db.raw("excluded.gross_cash_out"),
						total_operating_activities: db.raw("excluded.total_operating_activities"),
						total_investing_activities: db.raw("excluded.total_investing_activities"),
						total_financing_activities: db.raw("excluded.total_financing_activities"),
						operating_activities: db.raw("excluded.operating_activities"),
						investing_activities: db.raw("excluded.investing_activities"),
						financing_activities: db.raw("excluded.financing_activities"),
						meta: db.raw("excluded.meta")
					});
				if (insert) {
					await db<IAccountingTaskEgg>("integration_data.accounting_cashflow_tasks")
						.insert({
							id: insert[0].id,
							task_id: taskId
						})
						.onConflict(["id", "task_id"])
						.ignore();
					inserts++;
				}
			}
			return inserts == cash_flows.length;
		}
		return false;
	}

	public static getPublicKey(): JsonObject {
		const { RUTTER_PUBLIC_KEY } = envConfig;
		return { publicKey: RUTTER_PUBLIC_KEY };
	}

	/* Given the Rutter Link connectionToken, exchange it for a real access token & generate a DBConnectionEgg */
	public async exchangeTokenForConnectionEgg(business_id: UUID, connectionToken: string): Promise<IDBConnectionEgg> {
		const { RUTTER_CLIENT_ID, RUTTER_SECRET } = envConfig;

		const payload: ITokenExchangeRequest = {
			client_id: RUTTER_CLIENT_ID,
			secret: RUTTER_SECRET,
			public_token: connectionToken
		};
		const apiResponse = await this.post<ITokenExchangeResponse>("versioned/item/public_token/exchange", payload);
		if (apiResponse && apiResponse.data) {
			const platform_id = this.getPlatformId(apiResponse.data.platform);
			if (!platform_id) {
				logger.error(`Invalid platform ${apiResponse.data.platform} encountered`);
				throw new AccountingApiError("Invalid Platform", { ...payload, ...apiResponse.data }, StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
			}
			this.rutterConnection = {
				id: apiResponse.data.connection_id,
				access_token: apiResponse.data.access_token,
				platform: apiResponse.data.platform
			};
			return {
				business_id,
				platform_id,
				connection_status: CONNECTION_STATUS.SUCCESS,
				configuration: {
					connection: {
						id: apiResponse.data.connection_id,
						access_token: apiResponse.data.access_token,
						platform: apiResponse.data.platform
					}
				}
			};
		}
		throw new AccountingApiError("Could not exchange token", payload, StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
	}

	public async initializeRutterConnection(connectionEgg: IDBConnectionEgg): Promise<RutterDBConnection> {
		return await this.initializeConnection(connectionEgg);
	}

	public async deactivateRutterConnection(connectionId: string): Promise<boolean> {
		logger.info({ connectionId }, "Deactivating connection");
		try {
			const res: AxiosResponse<GenericResponse> = await this.delete<GenericResponse>(`versioned/connections/${connectionId}`);
			logger.info(res.data, "Response from deactivating connection:");
			const success = res.data?.success || false;
			if (!success) {
				return false;
			}
			return true;
		} catch (error) {
			logger.error({ error }, "Error deactivating connection");
			return false;
		}
	}

	public async getCompanyInfo(): Promise<CompanyInfo> {
		return this.get<CompanyInfo>("versioned/accounting/company_info").then(response => response.data);
	}
	public async getAccounts(options?: AccountsOptions): Promise<any> {
		return this.getPaginated("versioned/accounting/accounts", { expand: "platform_data", ...options });
	}
	public async getAccount(id: any): Promise<any> {
		return this.getPaginated("versioned/accounting/account/" + id, { expand: "platform_data" });
	}
	public async getBankDeposits(): Promise<any> {
		return this.getPaginated("versioned/accounting/bank_deposits", { expand: "platform_data" });
	}
	public async getBankDeposit(id: any): Promise<any> {
		return this.getPaginated("versioned/accounting/bank_deposits/" + id, { expand: "platform_data" });
	}
	public async getBankTransfers(): Promise<any> {
		return this.getPaginated("versioned/accounting/bank_transfers", { expand: "platform_data" });
	}
	public async getBankTransfer(id: any): Promise<any> {
		return this.getPaginated("versioned/accounting/bank_transfers/" + id, { expand: "platform_data" });
	}
	public async getCashFlowStatements(parameters = { expand: "platform_data" }): Promise<PaginatedResponse<CashFlow>> {
		return this.getPaginated<CashFlow>("versioned/accounting/cash_flow_statements", parameters);
	}
	public async getBalanceSheets(parameters = { expand: "platform_data" }): Promise<PaginatedResponse<BalanceSheet>> {
		return this.getPaginated<BalanceSheet>("versioned/accounting/balance_sheets", parameters);
	}
	public async getIncomeStatements(parameters = { expand: "platform_data" }): Promise<PaginatedResponse<IncomeStatement>> {
		return this.getPaginated<IncomeStatement>("versioned/accounting/income_statements", parameters);
	}
	public async getMetrics() {
		return this.get<GenericResponse>("versioned/accounting/metrics");
	}
	public async getExpenses() {
		return this.getPaginated<PaginatedResponse<any>>("versioned/accounting/expenses");
	}

	protected async getPaginated<T extends {}>(path: string, parameters: JsonObject = {}, apiVersion: APIVersion = DEFAULT_API_VERSION, cursor: null | string = null): Promise<PaginatedResponse<T>> {
		let { data: apiResponse }: { data: PaginatedResponse<T> } = await this.get<T>(path, parameters, apiVersion);
		const keyOfInterest = Object.keys(apiResponse).find(k => rutterObjectTypes.includes(k as ObjectType));
		let response: PaginatedResponse<T> = apiResponse;
		if (!keyOfInterest) {
			logger.warn("Could not determine key of interest in object, keys:");
			logger.warn(Object.keys(apiResponse));
		} else {
			let responseAccumulator = apiResponse;
			while (responseAccumulator && apiResponse.next_cursor != null && apiResponse.next_cursor != undefined) {
				if (responseAccumulator[keyOfInterest] && Array.isArray(responseAccumulator[keyOfInterest]) && responseAccumulator[keyOfInterest] != null) {
					responseAccumulator[keyOfInterest] = [...(responseAccumulator[keyOfInterest] as T[]), ...(apiResponse[keyOfInterest] as T[])];
				}
				parameters.cursor = apiResponse.next_cursor;
				({ data: apiResponse } = await this.get<T>(path, parameters, apiVersion));
			}
			response = responseAccumulator;
		}
		this.archiveRequest(response, path);
		return response;
	}

	protected async post<T>(path: string, body: JsonObject, parameters = {}, apiVersion: APIVersion = DEFAULT_API_VERSION): Promise<AxiosResponse<T>> {
		const { RUTTER_URL } = envConfig;

		return await axios
			.post<T>(`https://${RUTTER_URL}/${this.removeLeadingSlash(path)}`, body, {
				params: parameters,
				headers: { Authorization: this.generateAuthHeader(), "X-Rutter-Version": apiVersion }
			})
			.then(response => response)
			.catch(result => {
				logger.error({ error: result }, `Error with http post request to ${path}`);
				return result;
			});
	}

	protected async get<T>(path: string, parameters: JsonObject = {}, apiVersion: APIVersion = DEFAULT_API_VERSION): Promise<AxiosResponse<T>> {
		const { RUTTER_URL } = envConfig;
		const accessToken = this.getAccessToken();
		if (!accessToken) {
			throw new AccountingApiError("No access token available", { path, parameters, apiVersion }, StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
		}
		return await axios
			.get<T>(`https://${RUTTER_URL}/${this.removeLeadingSlash(path)}`, {
				params: {
					access_token: accessToken,
					...parameters
				},
				headers: {
					Authorization: this.generateAuthHeader(),
					"X-Rutter-Version": apiVersion
				}
			})
			.then(response => response)
			.catch(result => {
				logger.error({ error: result }, `Error with http get request to ${path}`);
				return result;
			});
	}
	protected async delete<T>(path: string, parameters = {}, apiVersion: APIVersion = DEFAULT_API_VERSION): Promise<AxiosResponse<T>> {
		const { RUTTER_URL } = envConfig;

		return await axios
			.delete<T>(`https://${RUTTER_URL}/${this.removeLeadingSlash(path)}`, {
				params: parameters,
				headers: { Authorization: this.generateAuthHeader(), "X-Rutter-Version": apiVersion }
			})
			.then(response => response)
			.catch(result => {
				logger.error({ error: result }, `Error with http delete request to ${path}`);
				return result;
			});
	}

	protected async saveApiResponse<T>(response: AxiosResponse<T>, request_type: string) {
		if (response && response.data && this.hasConnection()) {
			const input = {
				request_type,
				response: response.data,
				business_id: this.getDBConnection()?.business_id,
				platform_id: this.getDBConnection()?.platform_id,
				connection_id: this.getDbConnectionId(),
				request_received: new Date().toISOString()
			};
			return await db("integration_data.request_response").insert(input).returning("*");
		}
		logger.warn(`request to save empty response: ${request_type} ${this.getDbConnectionId()}`);
	}

	protected async savePaginatedResponse<T>(response: PaginatedResponse<T>, request_type: string) {
		if (response && this.hasConnection()) {
			const input = {
				request_type,
				response: response,
				business_id: this.getDBConnection()?.business_id,
				platform_id: this.getDBConnection()?.platform_id,
				connection_id: this.getDbConnectionId(),
				request_received: new Date().toISOString()
			};
			return await db("integration_data.request_response").insert(input).returning("*");
		}
		logger.warn(`request to save empty response: ${request_type} ${this.getDbConnectionId()}`);
	}

	private getRutterConnectionId(): string | null {
		return this.rutterConnection?.id ?? null;
	}

	private getAccessToken(): RutterConnectionConfiguration["access_token"] | undefined {
		return this.rutterConnection?.access_token;
	}

	private async syncConnectionByAccessToken(business_id: UUID, access_token: string): Promise<IDBConnection> {
		logger.debug(`syncConnectionByAccessToken: ${access_token}`);
		const { data: connectionStatus } = await this.get<ConnectionStatusResponse>("versioned/connections/status");
		const platformId = this.getPlatformId(connectionStatus.connection.platform);
		if (!platformId) {
			logger.error(`Invalid platform ${connectionStatus.connection.platform} encountered`);
			throw new AccountingApiError("invalid platform");
		}

		const tokenInfo: IDBConnectionEgg = {
			configuration: {
				connection: {
					access_token: access_token,
					id: connectionStatus.connection.id,
					platform: connectionStatus.connection.platform,
					...connectionStatus
				}
			},
			platform_id: platformId,
			connection_status: CONNECTION_STATUS.CREATED,
			created_at: new Date().toISOString() as TDateISO,
			business_id
		};
		const upsertResult = await db("integrations.data_connections").insert(tokenInfo).returning("*");

		if (upsertResult && tokenInfo.configuration?.connection) {
			return await db("integrations.data_connections")
				.select("*")
				.whereRaw("configuration->'connection'->>'id' = ? AND configuration->'connection'->>'access_token' = ?", [connectionStatus.connection.id, access_token])
				.limit(1)[0];
		}
		throw new AccountingApiError("couldn't sync connection by access token");
	}

	private generateAuthHeader(): string {
		const { RUTTER_SECRET, RUTTER_CLIENT_ID } = envConfig;

		const key = btoa(`${RUTTER_CLIENT_ID}:${RUTTER_SECRET}`);
		return `Basic ${key}`;
	}
	private removeLeadingSlash(path: string) {
		return path.replace(/^\/+/, "");
	}
}
