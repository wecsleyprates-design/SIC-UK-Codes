import { envConfig } from "#configs/index";
import { logger } from "#helpers/index";
import { db } from "#helpers/knex";
import { randomUUID, type UUID } from "crypto";
import currency from "currency.js";
import {
	AssetReportAddOns,
	AssetReportGetResponse,
	Configuration,
	PlaidApi,
	PlaidEnvironments,
	Products,
	CountryCode,
	IDNumberType,
	AccountAssets
} from "plaid";
import type { IPlaid } from "./types";
import { convertWorthToPlaid } from "./convert";
import type { IBalanceSheet, ICashFlowStatement, IIncomeStatement } from "#lib/rutter/types";
import type { TDateISO } from "#types/datetime";
import { DateTime } from "luxon";
import { roundNum } from "#utils/math";
import { getConnectionById, getOrCreateConnection } from "#helpers/platformHelper";
import { BankingApiError } from "#api/v1/modules/banking/error";
import type { IBusinessIntegrationTaskEnriched, IDBConnection } from "#types/db";
import {
	CORE_INTEGRATION_STATUS,
	DIRECTORIES,
	ERROR_CODES,
	INTEGRATION_CODES,
	INTEGRATION_ID,
	TASK_STATUS
} from "#constants";
import { StatusCodes } from "http-status-codes";
import { IBanking } from "#api/v1/modules/banking/types";
import {
	BankAccount,
	BankAccountBalance,
	BankAccountBalanceDaily,
	BankAccountTransaction,
	RelTaskBankAccount
} from "#api/v1/modules/banking/models/index";
import { uploadRawIntegrationDataToS3 } from "#common/index";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { TaskManager } from "#api/v1/modules/tasks/taskManager";
import { customerIntegrationSettings } from "#api/v1/modules/customer-integration-settings/customer-integration-settings";
dayjs.extend(utc);

const plaidDefaultConfig = new Configuration({
	basePath: PlaidEnvironments[envConfig.PLAID_ENV || "production"], // Allowed values: "sandbox", "development", "production"
	baseOptions: { headers: { "PLAID-CLIENT-ID": envConfig.PLAID_CLIENT_ID, "PLAID-SECRET": envConfig.PLAID_SECRET } }
});

const plaidSandboxConfig = new Configuration({
	basePath: PlaidEnvironments[envConfig.PLAID_SANDBOX_ENV || "sandbox"], // Allowed values: "sandbox", "development", "production"
	baseOptions: {
		headers: { "PLAID-CLIENT-ID": envConfig.PLAID_SANDBOX_CLIENT_ID, "PLAID-SECRET": envConfig.PLAID_SANDBOX_SECRET }
	}
});

class Plaid {
	private plaidClient: PlaidApi;
	constructor(env?: "sandbox" | "production" | "development") {
		let config = plaidDefaultConfig;
		// If 'env' is explicitly provided as 'sandbox', use the sandbox configuration
		if (env === "sandbox") {
			config = plaidSandboxConfig;
		}
		this.plaidClient = new PlaidApi(config);
	}

	async createUserToken(businessID: UUID) {
		try {
			const response = await this.plaidClient.userCreate({ client_user_id: businessID });
			return response.data;
		} catch (error: any) {
			logger.error({ error: error }, "Error creating Plaid user token");
			throw error;
		}
	}

	async createLinkToken(businessID, userInfo, products: Products[], userToken?: string) {
		// Normalize Worth country value (e.g. "USA", "UK", "united states") to Plaid ISO 3166 alpha-2
		let plaidCountryCode: CountryCode = CountryCode.Us;
		if (userInfo.address_country) {
			const mapped = convertWorthToPlaid("country", userInfo.address_country, true);
			if (mapped && Object.values(CountryCode).includes(mapped as CountryCode)) {
				plaidCountryCode = mapped as CountryCode;
			}
		}
		const isUs = plaidCountryCode === CountryCode.Us;
		try {
			const response = await this.plaidClient.linkTokenCreate({
				user: {
					client_user_id: businessID,
					phone_number: userInfo.mobile,
					// Only include US SSN for US users; TIN/SSN is not valid for non-US countries
					...(isUs && userInfo.tin && { id_number: { value: userInfo.tin, type: IDNumberType.UsSsn } }),
					address: {
						street: userInfo.address_line_1,
						street2: userInfo.address_line_2,
						city: userInfo.city,
						region: userInfo.state,
						postal_code: userInfo.address_postal_code,
						country: plaidCountryCode
					}
				},
				enable_multi_item_link: true,
				user_token: userToken,
				client_name: "Worth App", // TODO: should not be hardcoded
				products: products,
				country_codes: [plaidCountryCode],
				language: "en",
				webhook: envConfig.PLAID_LINK_WEBHOOK_URL
				// redirect_uri: envConfig.PLAID_REDIRECT_URI // TODO: need to configure this in plaid dashboard
			});

			return response.data;
		} catch (error: any) {
			logger.error({ error: error }, "Error creating Plaid link token");
			throw new Error(`Something went wrong while creating Plaid link token: ${error.message}`);
		}
	}

	/**
	 * Revokes the Plaid link by removing the item associated with the given access token.
	 * @param {string} accessToken - The access token for the Plaid link.
	 * @returns {Promise<Object>} - A promise that resolves to the response data after revoking the Plaid link.
	 * @throws {Error} - If something goes wrong while revoking the Plaid connection.
	 */
	async revokePlaidLink(accessToken) {
		try {
			const config = { access_token: accessToken };
			const response = await this.plaidClient.itemRemove(config);
			// The Item was removed, access_token is now invalid
			return response.data;
		} catch (error) {
			logger.error({ error: error }, "Error revoking Plaid link");
			throw new Error("Something went wrong while revoking Plaid connection");
		}
	}

	async plaidAuthGet(accessToken) {
		try {
			const response = await this.plaidClient.authGet(accessToken);
			return response.data;
		} catch (error) {
			logger.error(error);
			throw new Error("Something went wrong while fetching Plaid auth data");
		}
	}

	async exchangeToken(publicToken) {
		try {
			const response = await this.plaidClient.itemPublicTokenExchange({ public_token: publicToken });

			return response.data;
		} catch (error) {
			logger.error({ error: error }, "Error exchanging Plaid public token for access token");
			throw new Error("Something went wrong while exchanging Plaid public token for access token");
		}
	}

	async createAssetReport(payload: IPlaid.CreateAssetReport, daysRequested: number = 731) {
		try {
			// Plaid only allows 2 years of data
			if (daysRequested > 731 || daysRequested < 1 || Math.floor(daysRequested) !== daysRequested) {
				daysRequested = 731;
			}
			const options: Parameters<PlaidApi["assetReportCreate"]>[0]["options"] = {
				client_report_id: payload.business_integration_task_id,
				user: { client_user_id: payload.business_id },
				webhook: envConfig.PLAID_ASSETS_WEBHOOK_URL
			};
			if (payload.use_fast_assets) {
				options.add_ons = [AssetReportAddOns.FastAssets];
			}
			const response = await this.plaidClient.assetReportCreate({
				access_tokens: payload.access_tokens,
				days_requested: daysRequested,
				options
			});

			return response.data;
		} catch (error) {
			throw error;
		}
	}

	/** Client call to get an asset report. Use fast_report: true when the report was created with fast_assets add-on to retrieve the fast (identity + balance only) version. */
	async getAssetReport(data: { asset_report_token: string; fast_report?: boolean }) {
		try {
			const request = {
				asset_report_token: data.asset_report_token,
				include_insights: !data.fast_report,
				fast_report: data.fast_report ?? false
			};

			const response = await this.plaidClient.assetReportGet(request);

			return response.data;
		} catch (error) {
			throw error;
		}
	}

	async itemGetInformation(accessToken: string) {
		try {
			const response = await this.plaidClient.itemGet({ access_token: accessToken });

			return response.data;
		} catch (error) {
			throw error;
		}
	}

	async assetReportRevokeToken(accessToken: string) {
		try {
			const response = await this.plaidClient.assetReportRemove({ asset_report_token: accessToken });

			return response.data;
		} catch (error) {
			throw error;
		}
	}

	/**
	 * Pull asset report from Plaid and process it.
	 */
	public async pullAssetReportFromPlaid(
		data: IPlaid.TaskMeta,
		businessIntegrationTaskID: UUID,
		options?: { fastReport?: boolean }
	): Promise<boolean> {
		const fastReport = options?.fastReport ?? false;

		const response = await this.getAssetReport({
			asset_report_token: data.asset_report_token,
			fast_report: fastReport
		});

		const enrichedTask = await TaskManager.getEnrichedTask(businessIntegrationTaskID);
		const connection = await Plaid.getPlaidConnection(enrichedTask.business_id);
		const taskManager = new TaskManager(connection);

		await taskManager.updateTaskStatus(enrichedTask.id, TASK_STATUS.IN_PROGRESS);

		try {
			await this.upsertAssetResponse(enrichedTask, response);

			try {
				await this.archiveResponses(enrichedTask, response, { skipDerivedUploads: fastReport });
			} catch (error) {
				logger.error(error, "Error archiving responses");
			}

			await taskManager.updateTaskStatus(enrichedTask.id, TASK_STATUS.SUCCESS);
			return true;
		} catch (ex: any) {
			logger.error(ex.message);
			const log = ex instanceof Error ? ex.message : ex;
			await taskManager.updateTaskStatus(enrichedTask.id, TASK_STATUS.FAILED, log);
		}
		return false;
	}

	/**
	 * Upsert records in an asset report
	 * @param assetReportResponse
	 * @param enrichedTask
	 */
	public async upsertAssetResponse(
		enrichedTask: IBusinessIntegrationTaskEnriched,
		assetReportResponse: AssetReportGetResponse
	) {
		const { report } = assetReportResponse;
		let processorOrchestrationEnabled: boolean = false;
		if (enrichedTask.customer_id) {
			const integrationStatus = await customerIntegrationSettings.getIntegrationStatusForCustomer(
				enrichedTask.customer_id
			);
			processorOrchestrationEnabled =
				integrationStatus.find((item: any) => item.integration_code === INTEGRATION_CODES.PROCESSOR_ORCHESTRATION)
					?.status === CORE_INTEGRATION_STATUS.ENABLED;
		}

		// Flatten (item, account) pairs for parallel processing; each account is independent.
		const accountWork = report.items.flatMap(item =>
			item.accounts.map(account => ({ account, institutionName: item.institution_name }))
		);

		// Process all accounts in parallel. This is safe because:
		// 1. Each account has a unique bank_account identifier within the asset report
		// 2. BankAccount.merge uses bank_account + connectionId as the key, so concurrent merges
		//    of different accounts operate on different database rows
		// 3. Transaction/Balance/BalanceDaily merges operate on foreign keys to the bank account,
		//    so different accounts don't share these records
		// 4. The merge operations use key-based lookups; with unique keys per account, there's
		//    no contention for the same database rows
		const bankAccountsForTask = await Promise.all(
			accountWork.map(async ({ account, institutionName }) => {
				const bankAccountEgg = this.bankAccountEggFromAsset(
					account,
					enrichedTask.id,
					institutionName,
					processorOrchestrationEnabled
				);
				const bankAccount = await BankAccount.merge(bankAccountEgg, enrichedTask.connection_id);
				const record = bankAccount.getRecord();

				// Transactions, balances, and balance-daily are independent per account; run in parallel.
				await Promise.all([
					BankAccountTransaction.mergeRecords(
						this.bankAccountTransactionsFromAsset(account, record),
						enrichedTask.connection_id
					),
					BankAccountBalance.mergeRecords(this.bankAccountBalancesFromAsset(account, record)),
					BankAccountBalanceDaily.mergeRecords(this.bankAccountBalancesDailyFromAsset(account, record))
				]);

				return record.id as string;
			})
		);

		logger.info({ enriched_task_id: enrichedTask.id }, "enrichedTask.id");
		logger.info({ bank_accounts_for_task: bankAccountsForTask }, "bankAccountsForTask");
		await RelTaskBankAccount.upsertRecords(enrichedTask.id, bankAccountsForTask);
	}

	/**
	 * Save raw information and possible approximations to S3.
	 * When skipDerivedUploads is true (e.g. fast report), only the raw asset report is uploaded.
	 */
	private async archiveResponses(
		task: IBusinessIntegrationTaskEnriched,
		response: AssetReportGetResponse,
		opts?: { skipDerivedUploads?: boolean }
	) {
		try {
			const { business_id: businessID } = task;
			if (opts?.skipDerivedUploads) {
				await uploadRawIntegrationDataToS3(response, businessID, "asset_reports", DIRECTORIES.BANKING, "PLAID");
				return;
			}
			await Promise.all([
				this.constructIncomeStatement(businessID).then(incomeStatements =>
					uploadRawIntegrationDataToS3(incomeStatements, businessID, "incomestatement", DIRECTORIES.ACCOUNTING, "PLAID")
				),
				this.constructCashFlows(businessID).then(cashFlows =>
					uploadRawIntegrationDataToS3(cashFlows, businessID, "cashflow", DIRECTORIES.ACCOUNTING, "PLAID")
				),
				this.constructBalanceSheet(businessID).then(balanceSheets =>
					uploadRawIntegrationDataToS3(balanceSheets, businessID, "balancesheet", DIRECTORIES.ACCOUNTING, "PLAID")
				),
				uploadRawIntegrationDataToS3(response, businessID, "asset_reports", DIRECTORIES.BANKING, "PLAID")
			]);
		} catch (err) {
			if (err instanceof Error) {
				logger.error({ error: err }, "Could not upload report approximations to S3");
			}
			throw err;
		}
	}

	async refreshAssetReport(data: IPlaid.RefreshAssetReport, daysRequested: number = 731) {
		// Plaid only allows 2 years of data
		if (daysRequested > 731 || daysRequested < 1 || Math.floor(daysRequested) !== daysRequested) {
			daysRequested = 731;
		}
		const response = await this.plaidClient.assetReportRefresh({
			asset_report_token: data.asset_report_token,
			days_requested: daysRequested,
			options: {
				client_report_id: data.business_integration_task_id,
				webhook: envConfig.PLAID_ASSETS_WEBHOOK_URL,
				user: { client_user_id: data.business_id }
			}
		});

		return response.data;
	}

	async getWebhookVerificationKey(keyID) {
		const response = await this.plaidClient.webhookVerificationKeyGet({ key_id: keyID });
		return response.data;
	}

	async constructIncomeStatement(businessID) {
		try {
			const incomeStatements = await db("integration_data.bank_account_transactions")
				.select([
					"business_id",
					"platform_id",
					"connection_id",
					db.raw("to_char(bank_account_transactions.date, 'YYYY-MM') as month"),
					db.raw("SUM(CASE WHEN amount < 0 THEN amount ELSE 0 END) AS revenue"),
					db.raw("SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) AS expenses"),
					db.raw("min(date) as start_date"),
					db.raw("max(date) as end_date")
				])
				.join(
					"integrations.data_business_integrations_tasks",
					"data_business_integrations_tasks.id",
					"integration_data.bank_account_transactions.business_integration_task_id"
				)
				.join("integrations.data_connections", "data_connections.id", "data_business_integrations_tasks.connection_id")
				.join("integration_data.bank_accounts", "bank_accounts.id", "bank_account_transactions.bank_account_id")

				.where("integrations.data_connections.business_id", businessID)
				.andWhereRaw(
					"NOT 'transfer' = ANY(string_to_array(lower(coalesce(bank_account_transactions.category,'')),','))"
				)
				.groupBy(
					"business_id",
					"connection_id",
					"platform_id",
					db.raw("to_char(bank_account_transactions.date, 'YYYY-MM')")
				)
				.orderByRaw(db.raw("to_char(bank_account_transactions.date, 'YYYY-MM')"));
			const constructedIncomeStatement = {
				connection: { id: randomUUID(), orgId: incomeStatements[0]?.business_id, platform: "PLAID" },
				income_statements: [] as Partial<IIncomeStatement>[]
			};
			const now = new Date().toISOString() as TDateISO;
			constructedIncomeStatement.income_statements = incomeStatements.map(statement => {
				return {
					id: randomUUID(),
					currency_code: "USD",
					start_date: statement.start_date,
					end_date: statement.end_date,
					gross_profit: currency(statement.revenue).subtract(statement.expenses).value,
					net_income: currency(statement.revenue).subtract(statement.expenses).value,
					total_cost_of_sales: 0,
					total_expenses: statement.expenses,
					total_income: statement.revenue,
					net_operating_income: currency(statement.revenue).subtract(statement.expenses).value,
					created_at: now,
					updated_at: now
				};
			});
			return constructedIncomeStatement;
		} catch (error) {
			logger.error(error);
			throw new Error("Something went wrong while generating a profit and loss statement from Plaid data");
		}
	}

	async constructBalanceSheet(businessID) {
		try {
			const balanceSheets = await db("integration_data.banking_balances")
				.select([
					"business_id",
					"platform_id",
					"connection_id",
					"month",
					"year",
					db.raw("SUM(CASE WHEN type in('depository','investment') THEN balance ELSE 0 END) AS total_assets"),
					db.raw("SUM(CASE WHEN type in('loan','credit') THEN balance ELSE 0 END) AS total_liabilities"),
					db.raw("DATE_TRUNC('month', TO_DATE(year || '-' || month || '-01', 'YYYY-MM-DD')) AS start_date"),
					db.raw(
						"(DATE_TRUNC('month', TO_DATE(year || '-' || month || '-01', 'YYYY-MM-DD')) + INTERVAL '1 MONTH' - INTERVAL '1 day') AS end_date"
					)
				])
				.join(
					"integrations.data_business_integrations_tasks",
					"data_business_integrations_tasks.id",
					"banking_balances.business_integration_task_id"
				)
				.join("integrations.data_connections", "data_connections.id", "data_business_integrations_tasks.connection_id")
				.join("integration_data.bank_accounts", "bank_accounts.id", "banking_balances.bank_account_id")

				.where("integrations.data_connections.business_id", businessID)
				.groupBy("business_id", "connection_id", "platform_id", "year", "month")
				.orderByRaw("year desc, month desc");
			const constructedBalanceSheet = {
				connection: { id: randomUUID(), orgId: balanceSheets[0]?.business_id, platform: "PLAID" },
				balance_sheets: [] as IBalanceSheet[]
			};
			const now = new Date().toISOString() as TDateISO;
			constructedBalanceSheet.balance_sheets = balanceSheets.map(statement => {
				return {
					id: randomUUID(),
					currency_code: "USD",
					start_date: statement.start_date,
					end_date: statement.end_date,
					total_liabilities: statement.total_liabilities,
					total_assets: statement.total_assets,
					total_equity: 0,
					assets: [],
					liabilities: [],
					equity: [],
					platform_data: {},
					created_at: now,
					updated_at: now
				};
			});
			return constructedBalanceSheet;
		} catch (error) {
			logger.error(error);
			throw new Error("Something went wrong while generating a balance sheet from Plaid data");
		}
	}

	async constructCashFlows(businessID) {
		try {
			const cashFlows = await db("integration_data.bank_account_transactions")
				.select([
					"business_id",
					"platform_id",
					"connection_id",
					db.raw("DATE_TRUNC('month', bank_account_transactions.date) AS start_date"),
					db.raw(
						"(DATE_TRUNC('month', bank_account_transactions.date) + INTERVAL '1 MONTH' - INTERVAL '1 day') AS end_date"
					)
				])
				.sum({ net_cash_flow: "amount" })
				.sum({
					total_operating: db.raw("CASE WHEN bank_accounts.type in('depository','credit')  THEN amount ELSE 0 END")
				})
				.sum({ total_investing: db.raw("CASE WHEN category = 'investment' THEN amount ELSE 0 END") })
				.sum({ total_financing: db.raw("CASE WHEN category = 'loan' THEN amount ELSE 0 END") })
				.join(
					"integrations.data_business_integrations_tasks",
					"data_business_integrations_tasks.id",
					"integration_data.bank_account_transactions.business_integration_task_id"
				)
				.join("integrations.data_connections", "data_connections.id", "data_business_integrations_tasks.connection_id")
				.join("integration_data.bank_accounts", "bank_accounts.id", "bank_account_transactions.bank_account_id")
				.where("integrations.data_connections.business_id", businessID)
				.andWhereRaw(
					"NOT 'transfer' = ANY(string_to_array(lower(coalesce(bank_account_transactions.category,'')),','))"
				)
				.groupBy(
					"business_id",
					"connection_id",
					"platform_id",
					db.raw("to_char(bank_account_transactions.date, 'YYYY-MM')"),
					db.raw("DATE_TRUNC('month', bank_account_transactions.date)")
				);
			const constructedCashFlows = {
				connection: { id: randomUUID(), orgId: cashFlows[0]?.business_id, platform: "PLAID" },
				cash_flows: [] as Partial<ICashFlowStatement>[]
			};
			const now = new Date().toISOString() as TDateISO;
			constructedCashFlows.cash_flows = cashFlows.map(statement => {
				return {
					id: randomUUID(),
					currency_code: "USD",
					start_date: statement.start_date,
					end_date: statement.end_date,
					ending_balance: statement.net_cash_flow,
					starting_balance: 0,
					total_financing: statement.total_financing,
					total_operating: statement.total_operating,
					total_investing: statement.total_investing,
					created_at: now,
					updated_at: now
				};
			});
			return constructedCashFlows;
		} catch (error) {
			logger.error(error);
			throw new Error("Something went wrong while generating a profit and loss statement from Plaid data");
		}
	}

	public bankAccountEggFromAsset = (
		account: AccountAssets,
		taskId,
		institutionName,
		processorOrchestrationEnabled: boolean
	): IBanking.BankAccountEgg => {
		return {
			business_integration_task_id: taskId,
			bank_account: account.account_id,
			bank_name: account.name,
			official_name: account.official_name ?? account.name,
			institution_name: institutionName ?? account.name,
			balance_current: account.balances.current || 0,
			balance_available: account.balances.available || 0,
			balance_limit: account.balances.limit || 0,
			currency: account.balances.iso_currency_code || "USD",
			subtype: account.subtype || undefined,
			type: account.type,
			account_holder_name: processorOrchestrationEnabled
				? (account.owners?.find(owner => owner.names?.length > 0)?.names?.[0] ?? null)
				: null,
			account_holder_type: processorOrchestrationEnabled
				? account.ownership_type === "association"
					? "business"
					: "personal"
				: null,
			mask: account.mask ?? account.account_id.substring(account.account_id.length - 4, account.account_id.length), // last 4 digits of account number
			verification_status: account.verification_status
		};
	};

	public bankAccountBalancesFromAsset = (
		account: AccountAssets,
		bankAccount: IBanking.BankAccountRecord
	): IBanking.BankAccountBalanceEgg[] => {
		let balances = account.historical_balances.reduce((acc, balance) => {
			const { month, year, day } = DateTime.fromFormat(balance.date, "yyyy-MM-dd");
			const key = `${year}${month.toString().padStart(2, "0")}`;
			if (acc[key] && acc[key].day > day) {
				acc[key].sum_balance = currency(balance.current).value;
				acc[key].count += 1;
				return acc;
			}
			acc[key] = { sum_balance: balance.current, count: 1, month, year, day, currency: balance.iso_currency_code };

			return acc;
		}, {});

		return Object.keys(balances).map(key => {
			return {
				bank_account_id: bankAccount.id,
				business_integration_task_id: bankAccount.business_integration_task_id,
				month: balances[key].month,
				year: balances[key].year,
				balance: roundNum(balances[key].sum_balance / balances[key].count, 2),
				currency: account.balances.iso_currency_code,
				created_at: new Date().toISOString()
			} as IBanking.BankAccountBalanceEgg;
		});
	};

	public bankAccountBalancesDailyFromAsset = (
		account: AccountAssets,
		bankAccount: IBanking.BankAccountRecord
	): IBanking.BankAccountBalanceDailyEgg[] => {
		const balances: IBanking.BankAccountBalanceDailyEgg[] = account.historical_balances.map(balance => {
			return {
				bank_account_id: bankAccount.id,
				date: dayjs.utc(balance.date).toDate(),
				current: balance.current,
				available: null,
				currency: balance.iso_currency_code ?? balance.unofficial_currency_code ?? "USD"
			};
		});
		const hasToday = balances.find(balance => dayjs.utc(balance.date).isSame(dayjs.utc(), "day"));
		if (!hasToday) {
			balances.push({
				bank_account_id: bankAccount.id,
				date: dayjs.utc().toDate(),
				current: account.balances.current ?? 0,
				available: account.balances.available,
				currency: account.balances.iso_currency_code ?? account.balances.unofficial_currency_code ?? "USD"
			});
		} else {
			hasToday.current = account.balances.current ?? 0;
		}
		return balances;
	};

	/**
	 * Extract merchant name from transaction description
	 * Removes common transaction prefixes and extracts the merchant name
	 * Examples:
	 * - "ACH Electronic CreditGUSTO PAY 123456" -> "GUSTO PAY"
	 * - "McDonalds #3322" -> "McDonalds"
	 * - "Uber 063015 SF**POOL**" -> "Uber SF POOL"
	 * - "United Airlines **** REFUND ****" -> "United Airlines"
	 *   (Note: "REFUND" is removed by a suffix pattern; asterisks are not specifically handled)
	 */
	private extractMerchantNameFromDescription(description: string): string | null {
		if (!description) return null;

		// Common transaction prefixes to remove
		const prefixes = [
			/^ACH\s+ELECTRONIC\s+CREDIT\s*/i,
			/^ACH\s+ELECTRONIC\s+DEBIT\s*/i,
			/^ACH\s+DEBIT\s*/i,
			/^ACH\s+CREDIT\s*/i,
			/^DEBIT\s+CARD\s+PURCHASE\s*/i,
			/^DEBIT\s+CARD\s*/i,
			/^POS\s+DEBIT\s*/i,
			/^POS\s+PURCHASE\s*/i,
			/^ONLINE\s+TRANSFER\s*/i,
			/^ONLINE\s+PURCHASE\s*/i,
			/^WIRE\s+TRANSFER\s*/i,
			/^CHECK\s+PAYMENT\s*/i,
			/^ATM\s+WITHDRAWAL\s*/i,
			/^ATM\s+DEBIT\s*/i
		];

		let cleaned = description.trim();

		// Remove common prefixes
		for (const prefix of prefixes) {
			cleaned = cleaned.replace(prefix, "");
		}

		// Remove trailing numbers and codes (e.g., "123456", "REF #123", "#3322")
		cleaned = cleaned.replace(/#\s*\d+/g, "").trim(); // Remove "#3322" patterns
		cleaned = cleaned.replace(/\s+\d{6,}$/g, " ").trim(); // Remove trailing long number sequences (like "063015")
		cleaned = cleaned.replace(/\s*REF\s*#?\s*\d+.*$/i, "").trim();
		cleaned = cleaned.replace(/\s*ID\s*#?\s*\d+.*$/i, "").trim();

		// Remove excessive asterisks and clean up (e.g., "**** REFUND ****" -> "REFUND")
		cleaned = cleaned.replace(/\*{2,}/g, " ").trim(); // Replace multiple asterisks with space
		cleaned = cleaned.replace(/\s{2,}/g, " ").trim(); // Replace multiple spaces with single space

		// Remove common transaction type suffixes (e.g., "REFUND", "PAYMENT", "CREDIT", "DEBIT")
		const transactionTypeSuffixes = [
			/\s+REFUND\s*$/i,
			/\s+PAYMENT\s*$/i,
			/\s+CREDIT\s*$/i,
			/\s+DEBIT\s*$/i,
			/\s+TRANSFER\s*$/i,
			/\s+WITHDRAWAL\s*$/i,
			/\s+DEPOSIT\s*$/i
		];

		for (const suffix of transactionTypeSuffixes) {
			cleaned = cleaned.replace(suffix, "").trim();
		}

		// If we have something left after cleaning, use it
		if (cleaned && cleaned.length > 0) {
			return cleaned;
		}

		// If cleaning removed everything, return the original description
		return description;
	}

	public bankAccountTransactionsFromAsset = (
		account: AccountAssets,
		bankAccount: IBanking.BankAccountRecord
	): IBanking.BankAccountTransactionEgg[] => {
		return account.transactions.reduce((acc, transaction) => {
			if (transaction.pending) {
				return acc;
			}
			// Extract merchant name from Plaid transaction.
			// Note: merchantName field is unavailable in fast reports (include_insights: false)
			// because fast reports contain only identity + balances for quick onboarding.
			// For full reports, Plaid provides merchant name in the 'merchant_name' field when include_insights is true.
			// Fallback: if merchant_name is not available or empty, extract from description.
			let merchantName: string | null = null;
			if ((transaction as any).merchant_name && (transaction as any).merchant_name.trim() !== "") {
				merchantName = (transaction as any).merchant_name;
			} else if (transaction.original_description) {
				// Extract merchant name from description if merchant_name is not available or is empty
				merchantName = this.extractMerchantNameFromDescription(transaction.original_description);
			}

			acc.push({
				bank_account_id: bankAccount.id,
				business_integration_task_id: bankAccount.business_integration_task_id,
				transaction_id: transaction.transaction_id,
				amount: transaction.amount,
				currency: transaction.iso_currency_code as string,
				date: transaction.date,
				description: transaction.original_description as string,
				merchant_name: merchantName,
				is_pending: transaction.pending,
				payment_type: transaction.transaction_type as string,
				category: transaction?.category?.toString() as string,
				payment_metadata: JSON.stringify(transaction.payment_meta || {})
			});
			return acc;
		}, [] as IBanking.BankAccountTransactionEgg[]);
	};

	public static async getPlaidConnection(businessID: UUID | string): Promise<IDBConnection> {
		try {
			return getOrCreateConnection(businessID as UUID, INTEGRATION_ID.PLAID);
		} catch (error) {
			// rethrow as banking api error
			throw new BankingApiError(
				"Cannot find connection for this business",
				StatusCodes.NOT_FOUND,
				ERROR_CODES.NOT_FOUND
			);
		}
	}

	public static async getPlaid(options: {
		business_id?: string | UUID;
		connection_id?: string | UUID;
	}): Promise<Plaid> {
		let plaidConnection: any;
		if (options?.business_id) {
			plaidConnection = await Plaid.getPlaidConnection(options.business_id);
		} else if (options?.connection_id) {
			plaidConnection = await getConnectionById(options.connection_id);
		}

		const plaid =
			plaidConnection?.configuration?.environment === "sandbox" ||
			plaidConnection?.configuration?.user_token_response?.environment === "sandbox" ||
			plaidConnection?.configuration?.link_token_response?.environment === "sandbox"
				? new Plaid("sandbox")
				: new Plaid();

		return plaid;
	}
}

export { Plaid };
