import { AssetReport, AssetReportGetResponse, AccountType, AccountSubtype, CountryCode, IDNumberType, Products } from "plaid";
import { Plaid } from "../plaid";
import { generatePlaidTransactions, generateWorthAccounts, generateWorthTransactions } from "./test.utils";
import BankAccount from "#api/v1/modules/banking/models/bankAccount";
import BankAccountTransaction from "#api/v1/modules/banking/models/bankAccountTransaction";
import type { IBusinessIntegrationTaskEnriched } from "#types/db";
import { INTEGRATION_ID, TASK_STATUS } from "#constants";
import { BankingTaskAction } from "#api/v1/modules/banking/types";
import { Tracker } from "knex-mock-client";
import { createTracker } from "knex-mock-client";
const { db } = require("#helpers/knex"); // Initialize db here
jest.mock("#helpers/knex", () => {
	const knex = require("knex");
	const { MockClient } = require("knex-mock-client");
	return {
		db: knex({ client: MockClient, dialect: "pg" })
	};
});

jest.mock("#configs/env.config", () => ({
	envConfig: {
		KAFKA_BROKERS: "mocked_brokers",
		KAFKA_SSL_ENABLED: false,
		KAFKA_CLIENT_ID: "mocked_client_id",
		KAFKA_GROUP_ID: "mocked_group_id",
		PLAID_IDV_TEMPLATE_ID: "1",
		PLAID_LINK_WEBHOOK_URL: "https://example.com/webhook"
		//   ... other mocked configuration properties
	}
}));

describe("createLinkToken country code normalization", () => {
	const businessID = "0000-0000-0000-0000-1111";
	const baseUserInfo = {
		mobile: "+15550001234",
		tin: "123456789",
		address_line_1: "123 Main St",
		address_line_2: null,
		city: "Springfield",
		state: "IL",
		address_postal_code: "62701"
	};
	const products: Products[] = [Products.Transactions];

	let linkTokenCreateMock: jest.Mock;

	beforeEach(() => {
		linkTokenCreateMock = jest.fn().mockResolvedValue({ data: { link_token: "link-token-123" } });
	});

	afterEach(() => {
		jest.resetAllMocks();
	});

	const createPlaidWithMock = (mock: jest.Mock) => {
		const plaid = new Plaid();
		(plaid as any).plaidClient = { linkTokenCreate: mock };
		return plaid;
	};

	it.each([
		{ address_country: "US", expectedCode: CountryCode.Us },
		{ address_country: "USA", expectedCode: CountryCode.Us },
		{ address_country: "us", expectedCode: CountryCode.Us },
		{ address_country: "united states", expectedCode: CountryCode.Us },
		{ address_country: "GB", expectedCode: CountryCode.Gb },
		{ address_country: "UK", expectedCode: CountryCode.Gb },
		{ address_country: "united kingdom", expectedCode: CountryCode.Gb }
	])("maps address_country '$address_country' to CountryCode.$expectedCode", async ({ address_country, expectedCode }) => {
		const plaid = createPlaidWithMock(linkTokenCreateMock);
		await plaid.createLinkToken(businessID, { ...baseUserInfo, address_country }, products);

		const callArg = linkTokenCreateMock.mock.calls[0][0];
		expect(callArg.country_codes).toEqual([expectedCode]);
		expect(callArg.user.address.country).toEqual(expectedCode);
	});

	it("defaults to CountryCode.Us when address_country is empty", async () => {
		const plaid = createPlaidWithMock(linkTokenCreateMock);
		await plaid.createLinkToken(businessID, { ...baseUserInfo, address_country: "" }, products);

		const callArg = linkTokenCreateMock.mock.calls[0][0];
		expect(callArg.country_codes).toEqual([CountryCode.Us]);
	});

	it("defaults to CountryCode.Us when address_country is null", async () => {
		const plaid = createPlaidWithMock(linkTokenCreateMock);
		await plaid.createLinkToken(businessID, { ...baseUserInfo, address_country: null }, products);

		const callArg = linkTokenCreateMock.mock.calls[0][0];
		expect(callArg.country_codes).toEqual([CountryCode.Us]);
	});

	it("includes id_number for US users when tin is present", async () => {
		const plaid = createPlaidWithMock(linkTokenCreateMock);
		await plaid.createLinkToken(businessID, { ...baseUserInfo, address_country: "US" }, products);

		const callArg = linkTokenCreateMock.mock.calls[0][0];
		expect(callArg.user.id_number).toEqual({ value: baseUserInfo.tin, type: IDNumberType.UsSsn });
	});

	it("omits id_number for non-US users even when tin is present", async () => {
		const plaid = createPlaidWithMock(linkTokenCreateMock);
		await plaid.createLinkToken(businessID, { ...baseUserInfo, address_country: "GB" }, products);

		const callArg = linkTokenCreateMock.mock.calls[0][0];
		expect(callArg.user.id_number).toBeUndefined();
	});

	it("omits id_number for US users when tin is absent", async () => {
		const plaid = createPlaidWithMock(linkTokenCreateMock);
		await plaid.createLinkToken(businessID, { ...baseUserInfo, address_country: "US", tin: null }, products);

		const callArg = linkTokenCreateMock.mock.calls[0][0];
		expect(callArg.user.id_number).toBeUndefined();
	});
});

describe("refresh plaid asset report", () => {
	let tracker: Tracker;

	beforeEach(() => {
		tracker = createTracker(db);
	});
	afterEach(() => {
		jest.resetAllMocks();
		tracker.reset();
	});
	const businessID = "0000-0000-0000-0000-9999";
	const firstPlaidTransactions = generatePlaidTransactions(10, "plaid-account-id-0");
	const secondPlaidTransactions = generatePlaidTransactions(10, "plaid-account-id-1");

	const firstWorthTransactions = generateWorthTransactions(10, "plaid-account-id-0");
	const secondWorthTransactions = generateWorthTransactions(10, "plaid-account-id-1");

	const worthAccounts = generateWorthAccounts(2).map((acct, idx) => ({
		...acct,
		connection_id: "0000-0000-0000-0000-0002"
	}));

	// A base asset report to use for testing
	const assetReport: AssetReport = {
		asset_report_id: "plaid-asset-report-id",
		client_report_id: "plaid-client-report-id",
		date_generated: "2022-01-01",
		days_requested: 2,
		user: {},
		items: [
			{
				item_id: "plaid-item-id",
				institution_id: "plaid-institution-id",
				institution_name: "Plaid Bank",
				date_last_updated: "2022-01-01",
				accounts: [
					{
						account_id: "plaid-account-id-0",
						mask: "0000",
						name: "Plaid Bank",
						official_name: "First Account",
						days_available: 2,
						type: AccountType.Depository,
						subtype: AccountSubtype.Checking,
						balances: {
							margin_loan_amount: 0,
							available: 100,
							current: 70,
							limit: 100,
							iso_currency_code: "USD",
							unofficial_currency_code: null
						},
						owners: [],
						historical_balances: [],
						transactions: firstPlaidTransactions
					},
					{
						account_id: "plaid-account-id-1",
						mask: "0001",
						name: "Plaid Bank",
						official_name: "Second Account",
						days_available: 2,
						type: AccountType.Depository,
						subtype: AccountSubtype.Checking,
						balances: {
							margin_loan_amount: 0,
							available: 100,
							current: 70,
							limit: 100,
							iso_currency_code: "USD",
							unofficial_currency_code: null
						},
						owners: [],
						historical_balances: [],
						transactions: secondPlaidTransactions
					}
				]
			}
		]
	};
	const assetReportGetResponse: AssetReportGetResponse = {
		report: assetReport,
		request_id: "plaid-request-id",
		warnings: []
	};
	it("should refresh the asset report", async () => {
		// Mock finding all the transactions except txId ends with 5
		tracker.on
			.select(
				'select "t".* from "integration_data"."bank_account_transactions" as "t" inner join "integrations"."data_business_integrations_tasks" as "task" on "task"."id" = "t"."business_integration_task_id" where "task"."connection_id" = $1 and "t"."transaction_id" = $2 limit $3'
			)
			.response(rawQuery => {
				const [connectionId, transactionId] = rawQuery.bindings;
				if (transactionId.endsWith("5")) return [];
				const match = [...firstWorthTransactions, ...secondWorthTransactions].find(
					tx => tx.transaction_id === transactionId && tx.bank_account_id && worthAccounts.some(acct => acct.bank_account === tx.bank_account_id && acct.connection_id === connectionId)
				);
				return match ? [match] : [];
			});

		// Mock finding all the bank accounts provided
		tracker.on
			.select(
				'"acct".* from "integration_data"."bank_accounts" as "acct" inner join "integrations"."data_business_integrations_tasks" as "task" on "task"."id" = "acct"."business_integration_task_id" inner join "integrations"."data_connections" as "con" on "con"."id" = "task"."connection_id" where "acct"."bank_account" = $1 and "con"."id" = $2'
			)
			.response(rawQuery => {
				const [bankAccountId, connectionId] = rawQuery.bindings;
				return worthAccounts.filter(acct => acct.bank_account === bankAccountId && acct.connection_id === connectionId);
			});

		// Mock sucessful updates
		tracker.on.update('update "integration_data"."bank_accounts" set "id" = $1').response(rawQuery => {
			const [acctId, bankName, taskId, plaidAccountId] = rawQuery.bindings;
			const updated = worthAccounts.find(acct => acct.id === acctId);
			if (updated) {
				return [{ ...updated, bank_account: plaidAccountId }];
			}
		});

		// Mock successful updates
		tracker.on.update('update "integration_data"."bank_account_transactions"').response(rawQuery => {
			const [worthId] = rawQuery.bindings;
			return [[...firstWorthTransactions, ...secondWorthTransactions].find(tx => tx.id === worthId)];
		});

		tracker.on.insert('insert into "integration_data"."bank_account_transactions"').response(rawQuery => {
			const [worthId] = rawQuery.bindings;
			return [[...firstWorthTransactions, ...secondWorthTransactions].find(tx => tx.id === worthId)];
		});

		tracker.on.insert('insert into "integration_data"."banking_balances_daily"').response(rawQuery => {
			return [{}];
		});

		tracker.on.insert('insert into "integration_data"."rel_task_bank_account"').response(rawQuery => {
			return [{}];
		});

		tracker.on.select('select * from "integration_data"."rel_task_bank_account" where "business_integration_task_id" = $1 limit $2').response(() => [{}]);

		tracker.on.update('update "integration_data"."rel_task_bank_account" set "bank_account_id" = $1 where "business_integration_task_id" = $2').response(() => [{}]);

		// Alert on untracked queries
		tracker.on.select("b").response(raw => console.error("untracked query: ", raw));
		tracker.on.update("b").response(raw => console.error("untracked query: ", raw));

		const fakeTask: IBusinessIntegrationTaskEnriched = {
			id: "0000-0000-0000-0000-0001",
			platform_id: INTEGRATION_ID.PLAID,
			platform_code: "plaid",
			task_code: "fetch_assets_data",
			task_label: "Fetch Assets Data",
			integration_task_id: 1,
			platform_category_code: "BANKING",
			business_id: businessID,
			connection_id: "0000-0000-0000-0000-0002",
			task_status: TASK_STATUS.INITIALIZED,
			reference_id: "0000-0000-0000-0000-0003",
			created_at: "2022-01-01T00:00:00.000Z",
			updated_at: "2022-01-01T00:00:00.000Z",
			metadata: {
				asset_report_id: "plaid-asset-report-id",
				client_report_id: "plaid-client-report-id",
				days_requested: 2,
				taskAction: BankingTaskAction.REFRESH_ASSET_REPORT
			}
		};

		const bankAccountSpy = jest.spyOn(BankAccount, "merge");
		const bankAccountTransactionMergeSpy = jest.spyOn(BankAccountTransaction, "mergeRecords");
		const bankAccountTransactionGetSpy = jest.spyOn(BankAccountTransaction, "getByTransactionIdAndAccountId").mockImplementation((transactionId, accountId) => {
			const found = [...firstWorthTransactions, ...secondWorthTransactions].find(tx => tx.transaction_id === transactionId && tx.bank_account_id === accountId);
			if (found) {
				return Promise.resolve(new BankAccountTransaction(found));
			}
			const defaultRecord = {
				bank_account_id: accountId,
				business_integration_task_id: "",
				transaction_id: transactionId,
				date: "",
				amount: 0,
				currency: "",
				description: "",
				category: "",
				type: "",
				status: "",
				created_at: "",
				updated_at: "",
				id: "",
				payment_metadata: {},
				payment_type: "",
				is_pending: false
			};
			return Promise.resolve(new BankAccountTransaction(defaultRecord));
		});
		const bankAccountTransactionCreateSpy = jest.spyOn(BankAccountTransaction, "create");
		const updateSpy = jest.spyOn(BankAccountTransaction.prototype, "update");

		const plaid = new Plaid();
		await plaid.upsertAssetResponse(fakeTask, assetReportGetResponse);
		expect(bankAccountSpy).toHaveBeenCalledTimes(2);
		expect(bankAccountTransactionMergeSpy).toHaveBeenCalledTimes(2);
		// Transactions ending in `5` won't be found, so 2 of those will be created and 18 will be updated
		expect(bankAccountTransactionCreateSpy).toHaveBeenCalledTimes(2);
		expect(updateSpy).toHaveBeenCalledTimes(18);
	});
});
