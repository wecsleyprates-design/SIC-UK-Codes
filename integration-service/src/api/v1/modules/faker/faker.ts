import { faker } from "@faker-js/faker";
import { AccountingType, PlacesType, TaxFilingRecord } from "./types";
import { sqlQuery, sqlTransaction, getConnectionForBusinessAndPlatform } from "#helpers/index";
import { v4 as uuidv4 } from "uuid";
import { FakerApiError } from "./error";
import { StatusCodes } from "http-status-codes";
import { CONNECTION_STATUS, ERROR_CODES, INTEGRATION_ID } from "#constants";
import { generateAccountingData, generatePlacesData, generatePlaidData, generateGoogleBusinessData, generateFakeTaxFilingRecord, generateFakeVerdataRecord, buildInsertQuery } from "#utils/index";
import { TaskManager } from "../tasks/taskManager";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";

dayjs.extend(utc);

const getRandomNumber = (min, max) => {
	min = Math.ceil(min);
	max = Math.floor(max);
	return Math.floor(Math.random() * (max - min + 1)) + min;
};

const getTaskId = async (business_id, platform_id) => {
	const getbusinessIntegrationTaskId = `
		SELECT integrations.data_business_integrations_tasks.id
		FROM integrations.data_business_integrations_tasks
		JOIN integrations.data_connections
		ON integrations.data_business_integrations_tasks.connection_id = integrations.data_connections.id
		WHERE integrations.data_connections.business_id = $1 AND platform_id = $2;
`;

	const integrationData: any = await sqlQuery({ sql: getbusinessIntegrationTaskId, values: [business_id, platform_id] });

	return integrationData.rows[0].id;
};
class Faker extends TaskManager {
	public async insertAccoutingData(business_id): Promise<void> {
		const platform_id = INTEGRATION_ID.RUTTER_QUICKBOOKS;

		const connection = await getConnectionForBusinessAndPlatform(business_id, platform_id);

		const accountingAccountsDataQuery = `INSERT INTO integration_data.accounting_accounts (
            	id,
            	business_integration_task_id,
            	business_id,
            	platform_id,
            	external_id,
            	balance,
            	category,
            	status,
            	account_type,
            	currency,
            	created_at,
            	updated_at
            	) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
                );
                `;

		const accountingBalancesheetDataQuery = `INSERT INTO integration_data.accounting_balancesheet (
            	id,
            	business_integration_task_id,
            	business_id,
            	platform_id,
            	external_id,
            	start_date,
            	end_date,
            	currency,
            	total_assets,
            	total_equity,
            	total_liabilities,
            	assets,
            	equity,
            	liabilities,
            	created_at,
            	updated_at
            	) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
                );
                `;

		const accountingBusinessInfoDataQuery = `INSERT INTO integration_data.accounting_business_info (
            	id,
            	business_integration_task_id,
            	business_id,
            	platform_id,
            	external_id,
            	display_name,
            	currencies,
            	legal_name,
            	tin,
            	addresses,
            	created_at,
            	updated_at
            	) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
                );
                `;

		const accountingCashflowQuery = `INSERT INTO integration_data.accounting_cashflow (
            	id,
            	business_integration_task_id,
            	business_id,
            	platform_id,
            	external_id,
            	start_date,
            	end_date,
            	currency,
            	starting_balance,
            	ending_balance,
            	net_flow,
            	gross_cash_in,
            	gross_cash_out,
            	total_operating_activities,
            	total_investing_activities,
            	total_financing_activities,
            	operating_activities,
            	investing_activities,
            	financing_activities,
            	created_at,
            	updated_at
            	) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21
                );
                `;

		const accountingIncomeStatementQuery = `INSERT INTO integration_data.accounting_incomestatement (
            	id,
            	business_integration_task_id,
            	external_id,
            	business_id,
            	platform_id,
            	start_date,
            	end_date,
            	currency,
            	accounting_standard,
            	net_income,
            	total_revenue,
            	total_expenses,
            	revenue,
            	expenses,
            	cost_of_sales,
            	created_at,
            	updated_at
        		) VALUES (
            	$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17
        		);
                `;

		const accountingBalancesheetTasksQuery = `INSERT INTO integration_data.accounting_balancesheet_tasks (
            	id,
            	task_id,
            	created_at
        		) VALUES (
            	$1, $2, $3
        		);
                `;

		const accountingBusinessInfoTasksQuery = `INSERT INTO integration_data.accounting_business_info_tasks (
            	id,
            	task_id,
            	created_at
        		) VALUES (
            	$1, $2, $3
        		);
                `;

		const accountingCashflowTasksQuery = `INSERT INTO integration_data.accounting_cashflow_tasks (
            	id,
            	task_id,
            	created_at
        		) VALUES (
            	$1, $2, $3
        		);
                `;

		const accountingIncomestatementTasksQuery = `INSERT INTO integration_data.accounting_incomestatement_tasks (
            	id,
            	task_id,
            	created_at
        		) VALUES (
            	$1, $2, $3
        		);
                `;

		const business_integration_task_id = await getTaskId(business_id, platform_id);
		const queries: string[] = [];
		const values: any[] = [];
		for (let i = 0; i < getRandomNumber(15, 25); i++) {
			const data: AccountingType = generateAccountingData(business_integration_task_id, business_id, platform_id);

			const accountingAccountsData = [
				data.id,
				business_integration_task_id,
				business_id,
				data.platform_id,
				data.external_id,
				data.balance,
				data.category,
				data.status,
				data.account_type,
				data.currency,
				data.created_at,
				data.updated_at
			];

			const accountingBalancesheetData = [
				data.id,
				business_integration_task_id,
				business_id,
				data.platform_id,
				data.external_id,
				data.start_date,
				data.end_date,
				data.currency,
				data.total_assets,
				data.total_equity,
				data.total_liabilities,
				data.assets,
				data.equity,
				data.liabilities,
				data.created_at,
				data.updated_at
			];

			const accountingBalancesheetDataTasksData = [data.id, business_integration_task_id, data.created_at];

			const accountingBusinessInfoData = [
				data.id,
				business_integration_task_id,
				business_id,
				data.platform_id,
				data.external_id,
				data.display_name,
				null,
				null,
				data.currencies,
				data.addresses,
				data.created_at,
				data.updated_at
			];

			const accountingCashflowData = [
				data.id,
				business_integration_task_id,
				business_id,
				data.platform_id,
				data.external_id,
				data.start_date,
				data.end_date,
				data.currency,
				data.starting_balance,
				data.ending_balance,
				data.net_flow,
				data.gross_cash_in,
				data.gross_cash_out,
				data.total_operating_activities,
				data.total_investing_activities,
				data.total_financing_activities,
				data.operating_activities,
				data.investing_activities,
				data.financing_activities,
				data.created_at,
				data.updated_at
			];

			const accountingIncomeStatementData = [
				data.id,
				business_integration_task_id,
				data.external_id,
				business_id,
				data.platform_id,
				data.start_date,
				data.end_date,
				data.currency,
				data.accounting_standard,
				data.net_income,
				data.total_revenue,
				data.total_expenses,
				data.revenue,
				data.expenses,
				data.cost_of_sales,
				data.created_at,
				data.updated_at
			];

			if (i < 2) {
				queries.push(accountingAccountsDataQuery);
				values.push(accountingAccountsData);
			}
			if (i < 1) {
				queries.push(accountingBalancesheetDataQuery, accountingBalancesheetTasksQuery);
				values.push(accountingBalancesheetData, accountingBalancesheetDataTasksData);
			}

			queries.push(
				accountingBusinessInfoDataQuery,
				accountingBusinessInfoTasksQuery,
				accountingCashflowQuery,
				accountingCashflowTasksQuery,
				accountingIncomeStatementQuery,
				accountingIncomestatementTasksQuery
			);
			values.push(
				accountingBusinessInfoData,
				accountingBalancesheetDataTasksData,
				accountingCashflowData,
				accountingBalancesheetDataTasksData,
				accountingIncomeStatementData,
				accountingBalancesheetDataTasksData
			);
		}

		try {
			await sqlTransaction(queries, values);

			await TaskManager.updateConnectionStatus(connection.id, CONNECTION_STATUS.SUCCESS);
			await this.updateTaskStatus(business_integration_task_id, CONNECTION_STATUS.SUCCESS);
		} catch (err) {
			throw err;
		}
	}

	public async insertPlacesData(business_id): Promise<void> {
		const platform_id = INTEGRATION_ID.GOOGLE_PLACES_REVIEWS;
		const connection = await getConnectionForBusinessAndPlatform(business_id, platform_id);

		const businessRatingDataQuery = `
              INSERT INTO integration_data.business_ratings (
                id,
                business_integration_task_id,
                average_rating,
                total_reviews,
                created_at,
                updated_at
              ) VALUES (
                $1, $2, $3, $4, $5, $6
              );
            `;

		const reviewsDataQuery = `
            INSERT INTO integration_data.reviews (
            	id,
            	business_integration_task_id,
            	star_rating,
            	text,
            	review_datetime,
            	created_at,
            	updated_at
            ) VALUES (
            $1, $2, $3, $4, $5, $6, $7
            );
          	`;

		const business_integration_task_id = await getTaskId(business_id, platform_id);
		const queries: string[] = [];
		const values: any[] = [];
		for (let i = 0; i < getRandomNumber(1, 10); i++) {
			const data: PlacesType = generatePlacesData();

			if (i < 1) {
				const businessRatingData = [data.id, business_integration_task_id, data.average_rating, data.total_reviews, data.created_at, data.updated_at];
				queries.push(businessRatingDataQuery);
				values.push(businessRatingData);
			}
			const reviewsData = [data.id, business_integration_task_id, data.star_rating, data.text, data.review_datetime, data.created_at, data.updated_at];
			queries.push(reviewsDataQuery);
			values.push(reviewsData);
		}

		try {
			await sqlTransaction(queries, values);

			await TaskManager.updateConnectionStatus(connection.id, CONNECTION_STATUS.SUCCESS);
			await this.updateTaskStatus(business_integration_task_id, CONNECTION_STATUS.SUCCESS);
		} catch (err) {
			throw err;
		}
	}

	public async insertPlaidData(business_id): Promise<void> {
		const platform_id = INTEGRATION_ID.PLAID;

		const connection = await getConnectionForBusinessAndPlatform(business_id, platform_id);

		const business_integration_task_id = await getTaskId(business_id, platform_id);
		// Array to hold queries and values for sqlTransaction
		const queries: any = [];
		const values: any = [];

		// Insert fake data for bank accounts and balances 2 times
		for (let i = 0; i < 2; i++) {
			const { plaidData } = generatePlaidData(business_integration_task_id);

			const plaidInsertQuery = `
					INSERT INTO integration_data.bank_accounts (
						id, business_integration_task_id, bank_account, bank_name, official_name, 
						institution_name, verification_status, balance_current, 
						balance_available, balance_limit, currency, type, 
						subtype, mask, created_at
					)
					VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
				`;

			queries.push(plaidInsertQuery);
			values.push([
				plaidData.id,
				plaidData.business_integration_task_id,
				plaidData.bank_account,
				plaidData.bank_name,
				plaidData.official_name,
				plaidData.institution_name,
				plaidData.verification_status,
				plaidData.balance_current,
				plaidData.balance_available,
				plaidData.balance_limit,
				plaidData.currency,
				plaidData.type,
				plaidData.subtype,
				plaidData.mask,
				plaidData.created_at
			]);

			const balanceInsertQuery = `
				INSERT INTO integration_data.banking_balances (id, business_integration_task_id, bank_account_id, month, balance, currency, created_at)
				VALUES ($1, $2, $3, $4, $5, $6, $7)
				`;

			const balanceId = uuidv4();
			const balanceData = {
				balance: parseFloat(faker.finance.amount()),
				currency: "USD",
				createdAt: faker.date.past()
			};

			const month = balanceData.createdAt.getMonth() + 1;

			queries.push(balanceInsertQuery);
			values.push([balanceId, plaidData.business_integration_task_id, plaidData.id, month, balanceData.balance, balanceData.currency, balanceData.createdAt.toISOString()]);

			for (let j = 0; j < getRandomNumber(15, 25); j++) {
				const transactionInsertQuery = `
						INSERT INTO integration_data.bank_account_transactions (
							id, bank_account_id, business_integration_task_id, transaction_id, date, 
							amount, description, payment_metadata, currency, 
							category, payment_type, is_pending, created_at
						)
						VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
					`;

				const transaction = {
					id: faker.string.uuid(),
					bank_account_id: plaidData.id,
					business_integration_task_id: plaidData.business_integration_task_id,
					transaction_id: faker.string.alpha(30),
					date: faker.date.past().toISOString(),
					amount: parseFloat((Math.random() * 200 - 100).toFixed(2)),
					description: faker.finance.transactionDescription(),
					payment_metadata: JSON.stringify({
						by_order_of: null,
						payee: null,
						payer: null,
						payment_method: null,
						payment_processor: null,
						ppd_id: null,
						reason: null,
						reference_number: null
					}),
					currency: "USD",
					category: "Transfer,Payroll",
					payment_type: "special",
					is_pending: null,
					created_at: faker.date.recent().toISOString()
				};

				queries.push(transactionInsertQuery);
				values.push([
					transaction.id,
					plaidData.id,
					transaction.business_integration_task_id,
					transaction.transaction_id,
					transaction.date,
					transaction.amount,
					transaction.description,
					transaction.payment_metadata,
					transaction.currency,
					transaction.category,
					transaction.payment_type,
					transaction.is_pending,
					transaction.created_at
				]);
			}
		}

		try {
			await sqlTransaction(queries, values);

			await TaskManager.updateConnectionStatus(connection.id, CONNECTION_STATUS.SUCCESS);
			await this.updateTaskStatus(business_integration_task_id, CONNECTION_STATUS.SUCCESS);
		} catch (err) {
			throw err;
		}
	}

	public async insertTaxFilingData(record: TaxFilingRecord): Promise<void> {
		const taxFilingInsertQuery = `
					INSERT INTO integration_data.tax_filings (
						id, business_type, business_integration_task_id, naics, naics_title, period,
						form, form_type, filing_status, adjusted_gross_income, total_income,
						total_sales, total_compensation, total_wages, irs_balance, lien_balance,
						interest, interest_date, penalty, penalty_date, filed_date, balance,
						tax_period_ending_date, amount_filed, cost_of_goods_sold
					) VALUES (
						$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 
						$16, $17, $18, $19, $20, $21, $22, $23, $24, $25
					);
				`;

		const values = [
			record.id,
			record.business_type,
			record.business_integration_task_id,
			record.naics,
			record.naics_title,
			record.period,
			record.form,
			record.form_type,
			record.filing_status,
			record.adjusted_gross_income,
			record.total_income,
			record.total_sales,
			record.total_compensation,
			record.total_wages,
			record.irs_balance,
			record.lien_balance,
			record.interest,
			record.interest_date,
			record.penalty,
			record.penalty_date,
			record.filed_date,
			record.balance,
			record.tax_period_ending_date,
			record.amount_filed,
			record.cost_of_goods_sold
		];

		try {
			await sqlQuery({ sql: taxFilingInsertQuery, values });
		} catch (err) {
			throw err;
		}
	}

	public async createTaxFiling(business_id): Promise<void> {
		const platform_id = INTEGRATION_ID.TAX_STATUS;

		if (!platform_id) {
			throw new FakerApiError(`No platform found for business ID: ${business_id}.`, StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
		}

		const connection = await getConnectionForBusinessAndPlatform(business_id, platform_id);

		const business_integration_task_id = await getTaskId(business_id, platform_id);
		const fakeTaxFilingRecord = generateFakeTaxFilingRecord(business_integration_task_id);
		fakeTaxFilingRecord.forEach(record => {
			record.business_integration_task_id = business_integration_task_id;
		});

		// Insert all generated tax filing records into the database
		const table = "integration_data.tax_filings";
		const columns = [
			"id",
			"business_type",
			"business_integration_task_id",
			"naics",
			"naics_title",
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
			"cost_of_goods_sold"
		];

		const rows: any[] = [];
		for (const record of fakeTaxFilingRecord) {
			rows.push([
				record.id,
				record.business_type,
				record.business_integration_task_id,
				record.naics,
				record.naics_title,
				record.period,
				record.form,
				record.form_type,
				record.filing_status,
				record.adjusted_gross_income,
				record.total_income,
				record.total_sales,
				record.total_compensation,
				record.total_wages,
				record.irs_balance,
				record.lien_balance,
				record.interest,
				record.interest_date,
				record.penalty,
				record.penalty_date,
				record.filed_date,
				record.balance,
				record.tax_period_ending_date,
				record.amount_filed,
				record.cost_of_goods_sold
			]);
		}

		if (rows.length) {
			const insertTaxFilingQuery = buildInsertQuery(table, columns, rows);
			await sqlQuery({ sql: insertTaxFilingQuery, values: rows.flat() });
		}

		// Update connection and task statuses
		await TaskManager.updateConnectionStatus(connection.id, CONNECTION_STATUS.SUCCESS);
		await this.updateTaskStatus(business_integration_task_id, CONNECTION_STATUS.SUCCESS);
	}

	public async insertFakeGoogleBusinessData(business_id): Promise<void> {
		const platform_id = INTEGRATION_ID.GOOGLE_BUSINESS_REVIEWS;

		const connection = await getConnectionForBusinessAndPlatform(business_id, platform_id);

		const task_id = await getTaskId(business_id, platform_id);

		const googleBusinessInsertQuery = `
            INSERT INTO integration_data.business_ratings (
                id, business_integration_task_id, average_rating, total_reviews
            ) 
            VALUES ($1, $2, $3, $4)
        `;

		const queries: any = [];
		const values: any = [];

		for (let i = 0; i < getRandomNumber(10, 20); i++) {
			const { googleBusinessData } = generateGoogleBusinessData(task_id);

			queries.push(googleBusinessInsertQuery);
			values.push([googleBusinessData.id, googleBusinessData.business_integration_task_id, googleBusinessData.average_rating, googleBusinessData.total_reviews]);
		}

		try {
			await sqlTransaction(queries, values);

			await TaskManager.updateConnectionStatus(connection.id, CONNECTION_STATUS.SUCCESS);
			await this.updateTaskStatus(task_id, CONNECTION_STATUS.SUCCESS);
		} catch (err) {
			throw err;
		}
	}

	public async insertVerdataData(record): Promise<void> {
		const insertSQL = `
        INSERT INTO integration_data.public_records (
        	id,
        	business_integration_task_id,
        	number_of_business_liens,
        	most_recent_business_lien_filing_date,
        	most_recent_business_lien_status,
        	number_of_bankruptcies,
        	most_recent_bankruptcy_filing_date,
        	number_of_judgement_fillings,
        	most_recent_judgement_filling_date,
        	corporate_filing_business_name,
        	corporate_filing_filling_date,
        	corporate_filing_incorporation_state,
        	corporate_filing_corporation_type,
        	corporate_filing_resgistration_type,
        	corporate_filing_secretary_of_state_status,
        	corporate_filing_secretary_of_state_status_date,
        	average_rating,
        	angi_review_count,
        	angi_review_percentage,
        	bbb_review_count,
        	bbb_review_percentage,
        	google_review_count,
        	google_review_percentage,
        	yelp_review_count,
        	yelp_review_percentage,
        	healthgrades_review_count,
        	healthgrades_review_percentage,
        	vitals_review_count,
        	vitals_review_percentage,
        	webmd_review_count,
        	webmd_review_percentage, 
        	created_at,
        	updated_at, 
        	monthly_rating,
        	monthly_rating_date,
        	official_website
    	) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 
        $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, 
        $29, $30, $31, $32, $33, $34, $35, $36
		);
    `;
		const values = [
			record.id,
			record.business_integration_task_id,
			record.number_of_business_liens,
			record.most_recent_business_lien_filing_date,
			record.most_recent_business_lien_status,
			record.number_of_bankruptcies,
			record.most_recent_bankruptcy_filing_date,
			record.number_of_judgement_fillings,
			record.most_recent_judgement_filling_date,
			record.corporate_filing_business_name,
			record.corporate_filing_filling_date,
			record.corporate_filing_incorporation_state,
			record.corporate_filing_corporation_type,
			record.corporate_filing_resgistration_type,
			record.corporate_filing_secretary_of_state_status,
			record.corporate_filing_secretary_of_state_status_date,
			record.average_rating,
			record.angi_review_count,
			record.angi_review_percentage,
			record.bbb_review_count,
			record.bbb_review_percentage,
			record.google_review_count,
			record.google_review_percentage,
			record.yelp_review_count,
			record.yelp_review_percentage,
			record.healthgrades_review_count,
			record.healthgrades_review_percentage,
			record.vitals_review_count,
			record.vitals_review_percentage,
			record.webmd_review_count,
			record.webmd_review_percentage,
			record.created_at,
			record.updated_at,
			record.monthly_rating,
			record.monthly_rating_date,
			record.official_website
		];

		try {
			await sqlQuery({ sql: insertSQL, values });
		} catch (err) {
			throw err;
		}
	}

	public async createVerdataData(business_id): Promise<void> {
		const platform_id = INTEGRATION_ID.VERDATA;

		if (!platform_id) {
			throw new FakerApiError(`No platform found for business ID: ${business_id}.`, StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
		}

		// Retrieve the connection_id using both business_id and platform_id
		const connection = await getConnectionForBusinessAndPlatform(business_id, platform_id);

		// Retrieve the task_id for the connection_id
		const business_integration_task_id = await getTaskId(business_id, platform_id);

		// Prepare the verdata record with fake data
		const verdataRecord = generateFakeVerdataRecord(business_integration_task_id);

		// Insert the verdata record
		await this.insertVerdataData(verdataRecord);

		// Update the connection status and task status to SUCCESS

		await TaskManager.updateConnectionStatus(connection.id, CONNECTION_STATUS.SUCCESS);
		await this.updateTaskStatus(business_integration_task_id, CONNECTION_STATUS.SUCCESS);
	}
}

export const fakerService = new Faker();
