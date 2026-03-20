// @ts-nocheck
const { db } = require("#helpers/knex");
import {
	oauthClient,
	sqlQuery,
	sqlTransaction,
	logger,
	handlePlatformConnectionNotFound,
	joiExtended,
	getBusinessDetails,
	getCase,
	getOwners,
	internalGetBusinessNamesAndAddresses
} from "#helpers/index";
import { Tracker } from "knex-mock-client";
import { createTracker } from "knex-mock-client";
import { reportEventsHandler } from "../report";
import { PlaidIdv } from "#lib/plaid/plaidIdv";
import { unknown } from "zod";
import { getRawIntegrationDataFromS3 } from "#common/index";
import { I360Report } from "../types";
import { applicants } from "#api/v1/modules/applicants/applicants";
import BankAccountVerification from "#api/v1/modules/banking/models/bankAccountVerification";
import { banking } from "#api/v1/modules/banking/banking";
import { getDataScrapeService } from "#api/v1/modules/data-scrape/dataScrapeService";
import { getGoogleProfileMatchResult } from "#api/v1/modules/data-scrape/dataScrape";
import { FactEngine } from "#lib/facts/factEngine";
import { FactRules } from "#lib/facts/rules";
import { adverseMedia } from "#api/v1/modules/adverse-media/adverse-media";

jest.mock("#common/index", () => ({
	getRawIntegrationDataFromS3: jest.fn()
}));

jest.mock("#helpers/index", () => ({
	getBusinessDetails: jest.fn(),
	internalGetBusinessNamesAndAddresses: jest.fn(),
	sqlQuery: jest.fn(),
	sqlTransaction: jest.fn(),
	handlePlatformConnectionNotFound: jest.fn(),
	getCase: jest.fn(),
	getOwners: jest.fn(),
	getOrCreateConnection: jest.fn().mockResolvedValue({
		id: "mock-connection-id",
		business_id: "mock-business-id",
		platform_id: 1,
		connection_status: "CREATED",
		configuration: {},
		created_at: "2023-01-01T00:00:00Z",
		updated_at: "2023-01-01T00:00:00Z"
	}),
	joiExtended: {
		valid: jest.fn(() => ({
			// root-level Joi.valid("value") usage
			valid: jest.fn().mockReturnThis(),
			required: jest.fn().mockReturnThis(),
			optional: jest.fn().mockReturnThis(),
			allow: jest.fn().mockReturnThis(),
			when: jest.fn().mockReturnThis(),
			messages: jest.fn().mockReturnThis(),
			custom: jest.fn().mockReturnThis()
		})),
		object: jest.fn(() => ({
			keys: jest.fn().mockReturnThis(),
			required: jest.fn().mockReturnThis(),
			optional: jest.fn().mockReturnThis(),
			allow: jest.fn().mockReturnThis(),
			messages: jest.fn().mockReturnThis(),
			pattern: jest.fn().mockReturnThis(),
			when: jest.fn().mockReturnThis(),
			validate: jest.fn(() => ({ error: null, value: {} })),
			unknown: jest.fn().mockReturnThis(),
			custom: jest.fn().mockImplementation(function () {
				return this;
			})
		})),
		string: jest.fn(() => ({
			uuid: jest.fn().mockReturnThis(),
			optional: jest.fn().mockReturnThis(),
			required: jest.fn().mockReturnThis(),
			allow: jest.fn().mockReturnThis(),
			valid: jest.fn().mockReturnThis(),
			trim: jest.fn().mockReturnThis(),
			min: jest.fn(),
			custom: jest.fn().mockReturnThis()
		})),
		date: jest.fn(() => ({
			uuid: jest.fn().mockReturnThis(),
			optional: jest.fn().mockReturnThis(),
			required: jest.fn().mockReturnThis(),
			allow: jest.fn().mockReturnThis(),
			valid: jest.fn().mockReturnThis(),
			min: jest.fn(),
			custom: jest.fn().mockReturnThis()
		})),
		any: jest.fn(() => ({
			uuid: jest.fn().mockReturnThis(),
			optional: jest.fn().mockReturnThis(),
			required: jest.fn().mockReturnThis(),
			allow: jest.fn().mockReturnThis(),
			min: jest.fn(),
			custom: jest.fn().mockReturnThis()
		})),
		array: jest.fn(() => ({
			items: jest.fn().mockReturnThis(),
			optional: jest.fn().mockReturnThis(),
			required: jest.fn().mockReturnThis(),
			max: jest.fn().mockReturnThis(),
			custom: jest.fn().mockReturnThis()
		})),
		number: jest.fn(() => ({
			uuid: jest.fn().mockReturnThis(),
			optional: jest.fn().mockReturnThis(),
			required: jest.fn().mockReturnThis(),
			allow: jest.fn().mockReturnThis(),
			min: jest.fn().mockReturnThis(),
			max: jest.fn().mockReturnThis(),
			prefs: jest.fn().mockReturnThis(),
			messages: jest.fn().mockReturnThis(),
			custom: jest.fn().mockReturnThis()
		})),
		boolean: jest.fn(() => ({
			required: jest.fn().mockReturnThis(),
			optional: jest.fn().mockReturnThis(),
			valid: jest.fn().mockReturnThis(),
			allow: jest.fn().mockReturnThis(),
			when: jest.fn().mockReturnThis(),
			default: jest.fn().mockReturnThis(),
			custom: jest.fn().mockReturnThis()
		})),
		alternatives: jest.fn(() => ({
			try: jest.fn().mockReturnThis(),
			required: jest.fn().mockReturnThis(),
			optional: jest.fn().mockReturnThis()
		}))
	},
	logger: {
		error: jest.fn(),
		info: jest.fn(),
		warn: jest.fn()
	},
	oauthClient: {
		generateBusinessConsentUrl: jest.fn(),
		getOAuthTokens: jest.fn(),
		getClient: jest.fn()
	}
}));

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
		OPEN_AI_KEY: "MOCK_OPEN_AI_KEY",
		AWS_COGNITO_REGION: "us-east-1",
		AWS_ACCESS_KEY_ID: "mock_access_key",
		AWS_ACCESS_KEY_SECRET: "mock_secret_key",
		AWS_KMS_KEY_ID: "mock_kms_key"
		//   ... other mocked configuration properties
	}
}));

jest.mock("#api/v1/modules/banking/models/bankAccountVerification");

jest.mock("#api/v1/modules/banking/banking", () => ({
	banking: {
		getBankingInformation: jest.fn()
	}
}));

jest.mock("#lib/facts/factEngine", () => {
	return {
		FactEngine: jest.fn()
	};
});

jest.mock("#lib/facts/rules", () => {
	const combineFacts = jest.fn();
	const factWithHighestConfidence = jest.fn();
	const combineWatchlistMetadata = jest.fn();
	return {
		FactRules: {
			combineFacts,
			factWithHighestConfidence,
			combineWatchlistMetadata
		},
		combineFacts,
		factWithHighestConfidence,
		combineWatchlistMetadata
	};
});

jest.mock("#api/v1/modules/data-scrape/dataScrapeService", () => ({
	getDataScrapeService: jest.fn()
}));

jest.mock("#api/v1/modules/data-scrape/dataScrape", () => {
	const mockGetGoogleProfileMatchResult = jest.fn();
	return {
		getGoogleProfileMatchResult: mockGetGoogleProfileMatchResult,
		searchGoogleProfileMatchResult: jest.fn().mockResolvedValue("mock-task-id")
	};
});

// Mock the entire worthWebsiteScanning module to prevent kubernetes imports
jest.mock("#lib/worthWebsiteScanning/worthWebsiteScanning", () => ({
	WorthWebsiteScanning: jest.fn().mockImplementation(() => ({
		fetchBusinessWebsiteDetails: jest.fn(),
		processWebsiteData: jest.fn()
	})),
	getWorthWebsiteScanResponse: jest.fn().mockResolvedValue({
		website_review: null,
		website_pages: null
	})
}));

jest.mock("#api/v1/modules/applicants/applicants", () => ({
	applicants: {
		getTransactionsStats: jest.fn()
	}
}));

jest.mock("#lib/aws/secretsManager", () => ({
	SecretsManager: jest.fn().mockImplementation(() => ({
		getSecret: jest.fn(),
		putSecret: jest.fn()
	}))
}));

jest.mock("#api/v1/modules/secrets/secrets", () => ({
	secretsManagerService: {
		getSecret: jest.fn(),
		putSecret: jest.fn()
	}
}));

jest.mock("#lib/match/matchUtil", () => ({
	MatchUtil: {
		processMatch: jest.fn(),
		validateMatch: jest.fn(),
		getMatchBusinessResult: jest.fn()
	}
}));

jest.mock("#api/v1/modules/adverse-media/adverse-media", () => ({
	adverseMedia: {
		getAdverseMediaDataByCaseId: jest.fn(),
		getAdverseMediaByBusinessId: jest.fn()
	}
}));

jest.mock("#lib/plaid/plaidIdv", () => ({
	PlaidIdv: {
		getApplicantVerificationResponse: jest.fn()
	}
}));

describe("test report.ts", () => {
	const mockGetGoogleProfileMatchResult = getGoogleProfileMatchResult as jest.MockedFunction<
		typeof getGoogleProfileMatchResult
	>;

	afterEach(() => {
		jest.resetAllMocks();
	});

	describe("_getTop10TransactionsByAmount", () => {
		beforeEach(() => {
			getCase.mockResolvedValueOnce({ id: "2b1b5c39-d74a-4600-9215-1c4d01121d61", created_at: new Date() });
			sqlQuery.mockClear();
		});
		const top10TransactionsByAmount = [
			{
				date: "2024-08-12 00:00:00.000000",
				description: "Online Transfer to SAV ...6827 transaction#: 21702983045 08/12",
				amount: 780000
			},
			{
				date: "2024-08-07 00:00:00.000000",
				description: "Online Transfer to SAV ...6827 transaction#: 21652990742 08/07",
				amount: 654985.2
			},
			{
				date: "2024-08-06 00:00:00.000000",
				description: "Online Transfer to SAV ...6827 transaction#: 21642380244 08/06",
				amount: 575000
			},
			{
				date: "2024-08-13 00:00:00.000000",
				description: "Online Transfer to SAV ...6827 transaction#: 21711855670 08/13",
				amount: 543000
			},
			{
				date: "2024-09-03 00:00:00.000000",
				description: "Online Transfer to CHK ...6866 transaction#: 21913891990 09/03",
				amount: 200000
			},
			{
				date: "2024-08-30 00:00:00.000000",
				description:
					"ORIG CO NAME:ASF, DBA Insperi ORIG ID:2760487432 DESC DATE:240829 CO ENTRY DESCR:PAYROLL SEC:CCD TRACE#:111000023124409 EED:240830 IND ID:0005797200 IND NAME:WORTH AI INC ty TRN: 2423124409TC",
				amount: 163907.93
			},
			{
				date: "2024-07-31 00:00:00.000000",
				description:
					"ORIG CO NAME:ASF, DBA Insperi ORIG ID:2760487432 DESC DATE:240730 CO ENTRY DESCR:PAYROLL SEC:CCD TRACE#:111000020539344 EED:240731 IND ID:0005797200 IND NAME:WORTH AI INC ty TRN: 2120539344TC",
				amount: 158543.95
			},
			{
				date: "2024-08-12 00:00:00.000000",
				description: "Online Transfer to CHK ...6866 transaction#: 21702998277 08/12",
				amount: 150000
			},
			{
				date: "2024-09-04 00:00:00.000000",
				description: "Online Transfer to CHK ...6866 transaction#: 21946364467 09/04",
				amount: 150000
			},
			{
				date: "2024-08-21 00:00:00.000000",
				description: "Online Transfer to CHK ...6866 transaction#: 21796212765 08/21",
				amount: 150000
			}
		];

		const body: I360Report = {
			business_id: "37cefe17-381b-4f3d-9140-6ea8b9abd817",
			case_id: "2b1b5c39-d74a-4600-9215-1c4d01121d61",
			score_trigger_id: "95bb8e17-a9f0-4213-a3dc-0266350fc642",
			customer_id: "0262d0f1-20b5-44e9-ad17-75b41c69000e"
		};

		it("should throw error ", async () => {
			sqlQuery.mockRejectedValueOnce(new Error("error"));
			await expect(reportEventsHandler._getTop10TransactionsByAmount(body)).rejects.toThrow("error");
		});
		it("should return _getTop10TransactionsByAmount", async () => {
			sqlQuery.mockResolvedValueOnce({ rowCount: 0, rows: top10TransactionsByAmount });
			const responseTop10TransactionsByAmount = await reportEventsHandler._getTop10TransactionsByAmount(body);
			expect(top10TransactionsByAmount).toStrictEqual(responseTop10TransactionsByAmount);
		});
		it("should return empty data ", async () => {
			sqlQuery.mockResolvedValueOnce({ rowCount: 0, rows: top10TransactionsByAmount });
			body.business_id = null;
			const responseTop10TransactionsByAmount = await reportEventsHandler._getTop10TransactionsByAmount(body);
			expect([]).toStrictEqual(responseTop10TransactionsByAmount);
		});
	});

	describe("_getTop10RefundByAmount", () => {
		beforeEach(() => {
			getCase.mockResolvedValueOnce({ id: "2b1b5c39-d74a-4600-9215-1c4d01121d61", created_at: new Date() });
			sqlQuery.mockClear();
		});
		const top10RefundByAmount = [
			{
				date: "2024-08-12 00:00:00.000000",
				description: "Online Transfer to SAV ...6827 transaction#: 21702983045 08/12",
				amount: -780000
			},
			{
				date: "2024-08-07 00:00:00.000000",
				description: "Online Transfer to SAV ...6827 transaction#: 21652990742 08/07",
				amount: -654985.2
			}
		];

		const body: I360Report = {
			business_id: "37cefe17-381b-4f3d-9140-6ea8b9abd817",
			case_id: "2b1b5c39-d74a-4600-9215-1c4d01121d61",
			score_trigger_id: "95bb8e17-a9f0-4213-a3dc-0266350fc642",
			customer_id: "0262d0f1-20b5-44e9-ad17-75b41c69000e"
		};

		it("should return _getTop10RefundByAmount", async () => {
			await sqlQuery.mockClear();
			sqlQuery.mockResolvedValueOnce({ rowCount: 0, rows: top10RefundByAmount });
			const responseTop10RefundByAmount = await reportEventsHandler._getTop10RefundByAmount(body);
			expect(top10RefundByAmount).toStrictEqual(responseTop10RefundByAmount);
		});
		it("should throw error ", async () => {
			sqlQuery.mockRejectedValueOnce(new Error("error"));
			await expect(reportEventsHandler._getTop10RefundByAmount(body)).rejects.toThrow("error");
		});
		it("should return empty data ", async () => {
			sqlQuery.mockResolvedValueOnce({ rowCount: 0, rows: top10RefundByAmount });
			body.business_id = null;
			const responseTop10RefundByAmount = await reportEventsHandler._getTop10RefundByAmount(body);
			expect([]).toStrictEqual(responseTop10RefundByAmount);
		});
	});
	describe("_getSpendingByCategory", () => {
		beforeEach(() => {
			getCase.mockResolvedValueOnce({ id: "2b1b5c39-d74a-4600-9215-1c4d01121d61", created_at: new Date() });
			sqlQuery.mockClear();
		});
		const spendingByCategory = [
			{
				category: "Service",
				max: 8000
			},
			{
				category: "Service,Financial,Loans and Mortgages",
				max: 4592.44
			}
		];

		const body: I360Report = {
			business_id: "37cefe17-381b-4f3d-9140-6ea8b9abd817",
			case_id: "2b1b5c39-d74a-4600-9215-1c4d01121d61",
			score_trigger_id: "95bb8e17-a9f0-4213-a3dc-0266350fc642",
			customer_id: "0262d0f1-20b5-44e9-ad17-75b41c69000e"
		};

		it("should return _getSpendingByCategory", async () => {
			await sqlQuery.mockClear();
			sqlQuery.mockResolvedValueOnce({ rowCount: 0, rows: spendingByCategory });
			const responseSpendingByCategory = await reportEventsHandler._getSpendingByCategory(body);
			expect(spendingByCategory).toStrictEqual(responseSpendingByCategory);
		});
		it("should throw error ", async () => {
			sqlQuery.mockRejectedValueOnce(new Error("error"));
			await expect(reportEventsHandler._getSpendingByCategory(body)).rejects.toThrow("error");
		});
		it("should return empty data ", async () => {
			sqlQuery.mockResolvedValueOnce({ rowCount: 0, rows: spendingByCategory });
			body.business_id = null;
			const responseSpendingByCategory = await reportEventsHandler._getTop10RefundByAmount(body);
			expect([]).toStrictEqual(responseSpendingByCategory);
		});
	});

	describe("_getIncomeVsExpensesData", () => {
		beforeEach(() => {
			getCase.mockResolvedValueOnce({ id: "2b1b5c39-d74a-4600-9215-1c4d01121d61", created_at: new Date() });
			sqlQuery.mockClear();
		});
		const incomeVsExpensesChartData = [
			{
				month_year: "Jan'24",
				income: -504.22,
				expense: 11149.46
			},
			{
				month_year: "Feb'24",
				income: -504.22,
				expense: 11149.46
			},
			{
				month_year: "Mar'24",
				income: -504.22,
				expense: 11149.46
			},
			{
				month_year: "Apr'24",
				income: -504.22,
				expense: 11149.46
			},
			{
				month_year: "May'24",
				income: -504.22,
				expense: 11149.46
			},
			{
				month_year: "Jun'24",
				income: -504.22,
				expense: 11149.46
			},
			{
				month_year: "Jul'24",
				income: -504.22,
				expense: 11149.46
			},
			{
				month_year: "Aug'24",
				income: -504.22,
				expense: 14227.96
			},
			{
				month_year: "Sep'24",
				income: 0,
				expense: 7856.33
			},
			{
				month_year: "Oct'24",
				income: null,
				expense: null
			},
			{
				month_year: "Nov'24",
				income: null,
				expense: null
			},
			{
				month_year: "Dec'24",
				income: null,
				expense: null
			}
		];

		const body: I360Report = {
			business_id: "37cefe17-381b-4f3d-9140-6ea8b9abd817",
			case_id: "2b1b5c39-d74a-4600-9215-1c4d01121d61",
			score_trigger_id: "95bb8e17-a9f0-4213-a3dc-0266350fc642",
			customer_id: "0262d0f1-20b5-44e9-ad17-75b41c69000e"
		};

		it("should return _getIncomeVsExpensesData", async () => {
			await sqlQuery.mockClear();
			sqlQuery.mockResolvedValueOnce({ rowCount: 1, rows: incomeVsExpensesChartData });
			const responseSpendingByCategory = await reportEventsHandler._getIncomeVsExpensesData(body);
			const expectedData = incomeVsExpensesChartData.reduce(
				(acc, r) => {
					acc.month_year = r.month_year;
					acc.incomes.push(r.income);
					acc.expenses.push(r.expense);
					return acc;
				},
				{ incomes: [], expenses: [] }
			);
			expect(expectedData).toStrictEqual(responseSpendingByCategory);
		});
		it("should throw error ", async () => {
			sqlQuery.mockRejectedValueOnce(new Error("error"));
			await expect(reportEventsHandler._getIncomeVsExpensesData(body)).rejects.toThrow("error");
		});
		it("should return empty data ", async () => {
			sqlQuery.mockResolvedValueOnce({ rowCount: 1, rows: incomeVsExpensesChartData });
			body.business_id = null;
			const responseSpendingByCategory = await reportEventsHandler._getIncomeVsExpensesData(body);
			expect(null).toStrictEqual(responseSpendingByCategory);
		});
	});

	describe("_getDepositsChartData", () => {
		beforeEach(() => {
			getCase.mockResolvedValueOnce({ id: "2b1b5c39-d74a-4600-9215-1c4d01121d61", created_at: new Date() });
			sqlQuery.mockClear();
		});
		const depositsChartData = [
			{
				category: "Transfer,Payroll",
				deposits: 101.28
			},
			{
				category: "Travel,Airlines and Aviation Services",
				deposits: 12000
			}
		];

		const body: I360Report = {
			business_id: "37cefe17-381b-4f3d-9140-6ea8b9abd817",
			case_id: "2b1b5c39-d74a-4600-9215-1c4d01121d61",
			score_trigger_id: "95bb8e17-a9f0-4213-a3dc-0266350fc642",
			customer_id: "0262d0f1-20b5-44e9-ad17-75b41c69000e"
		};

		it("should return _getDepositsChartData", async () => {
			const data = {
				deposits: {
					categories: [
						{
							category: "Transfer,Payroll",
							count: "1",
							amount: 4.22
						},
						{
							category: "Travel,Airlines and Aviation Services",
							count: "1",
							amount: 500
						}
					],
					total_deposits: 504.22,
					period: ["2024-10-01T00:00:00.000Z", "2024-10-31T23:59:59.000Z"]
				},
				spendings: {
					categories: [
						{
							category: "Travel,Taxi",
							count: "1",
							amount: 6.33
						}
					],
					total_spendings: "6.33",
					period: ["2024-11-01T00:00:00.000Z", "2024-11-30T23:59:59.000Z"]
				},
				average_transactions: {
					transaction_type: {
						deposits: [
							{
								month: "January",
								count: 2,
								amount: 252.11
							},
							{
								month: "February",
								count: 2,
								amount: 252.11
							},
							{
								month: "March",
								count: 2,
								amount: 252.11
							},
							{
								month: "April",
								count: 2,
								amount: 252.11
							},
							{
								month: "May",
								count: 2,
								amount: 252.11
							},
							{
								month: "June",
								count: 2,
								amount: 252.11
							},
							{
								month: "July",
								count: 2,
								amount: 252.11
							},
							{
								month: "August",
								count: 2,
								amount: 252.11
							},
							{
								month: "September",
								count: 2,
								amount: 252.11
							},
							{
								month: "October",
								count: 2,
								amount: 252.11
							}
						],
						spendings: [
							{
								month: "January",
								count: 6,
								amount: 23.743333333333336
							},
							{
								month: "February",
								count: 6,
								amount: 23.743333333333336
							},
							{
								month: "March",
								count: 6,
								amount: 23.743333333333336
							},
							{
								month: "April",
								count: 6,
								amount: 23.743333333333336
							},
							{
								month: "May",
								count: 6,
								amount: 23.743333333333336
							},
							{
								month: "June",
								count: 6,
								amount: 23.743333333333336
							},
							{
								month: "July",
								count: 6,
								amount: 23.743333333333336
							},
							{
								month: "August",
								count: 6,
								amount: 23.743333333333336
							},
							{
								month: "September",
								count: 6,
								amount: 23.743333333333336
							},
							{
								month: "October",
								count: 6,
								amount: 23.743333333333336
							},
							{
								month: "November",
								count: 1,
								amount: 6.33
							}
						]
					},
					period: ["2024-01-01T00:00:00.000Z", "2024-12-31T23:59:59.999Z"]
				},
				sum_transactions: {
					transaction_type: {
						deposits: [
							{
								month: "January",
								count: 2,
								amount: "504.22"
							},
							{
								month: "February",
								count: 2,
								amount: "504.22"
							},
							{
								month: "March",
								count: 2,
								amount: "504.22"
							},
							{
								month: "April",
								count: 2,
								amount: "504.22"
							},
							{
								month: "May",
								count: 2,
								amount: "504.22"
							},
							{
								month: "June",
								count: 2,
								amount: "504.22"
							},
							{
								month: "July",
								count: 2,
								amount: "504.22"
							},
							{
								month: "August",
								count: 2,
								amount: "504.22"
							},
							{
								month: "September",
								count: 2,
								amount: "504.22"
							},
							{
								month: "October",
								count: 2,
								amount: "504.22"
							}
						],
						spendings: [
							{
								month: "January",
								count: 6,
								amount: "142.46"
							},
							{
								month: "February",
								count: 6,
								amount: "142.46"
							},
							{
								month: "March",
								count: 6,
								amount: "142.46"
							},
							{
								month: "April",
								count: 6,
								amount: "142.46"
							},
							{
								month: "May",
								count: 6,
								amount: "142.46"
							},
							{
								month: "June",
								count: 6,
								amount: "142.46"
							},
							{
								month: "July",
								count: 6,
								amount: "142.46"
							},
							{
								month: "August",
								count: 6,
								amount: "142.46"
							},
							{
								month: "September",
								count: 6,
								amount: "142.46"
							},
							{
								month: "October",
								count: 6,
								amount: "142.46"
							},
							{
								month: "November",
								count: 1,
								amount: 6.33
							}
						]
					},
					period: ["2024-01-01T00:00:00.000Z", "2024-12-31T23:59:59.999Z"]
				},
				last_month_delta: "136.13",
				total_balance: "497.89"
			};
			jest.spyOn(applicants, "getTransactionsStats").mockResolvedValue(data);
			const reponseDepositsChartData = await reportEventsHandler._getDepositsChartData(body);
			const expectedData = [
				{
					category: "Transfer,Payroll",
					deposits: 4.22,
					index: 0,
					period: ["2024-10-01T00:00:00.000Z", "2024-10-31T23:59:59.000Z"]
				},
				{
					category: "Travel,Airlines and Aviation Services",
					deposits: 500,
					index: 1,
					period: ["2024-10-01T00:00:00.000Z", "2024-10-31T23:59:59.000Z"]
				}
			];
			expect(expectedData).toStrictEqual(reponseDepositsChartData);
		});
		it("should throw error ", async () => {
			jest.spyOn(applicants, "getTransactionsStats").mockRejectedValueOnce(new Error("error"));
			await expect(reportEventsHandler._getDepositsChartData(body)).rejects.toThrow("error");
		});
		it("should return empty data ", async () => {
			sqlQuery.mockResolvedValueOnce({ rowCount: 1, rows: depositsChartData });
			body.business_id = null;
			const reponseBankAccountBalanceChartData = await reportEventsHandler._getDepositsChartData(body);
			expect([]).toStrictEqual(reponseBankAccountBalanceChartData);
		});
	});

	describe("_getBankingInformation", () => {
		const businessID = "37cefe17-381b-4f3d-9140-6ea8b9abd817";

		const bankAccountWithoutVerification = {
			id: "3a7777a8-a0de-4cfd-b3a9-c11d610d68ab",
			business_integration_task_id: "d66c7709-9dea-474e-95ec-6ed18dd6ea11",
			bank_account: "3AVqm7DbvQiRkydJmgNNtNQ8B6a31duZyjJAd",
			bank_name: "Plaid Checking",
			official_name: "Plaid Gold Standard 0% Interest Checking",
			institution_name: "Chase",
			verification_status: null,
			balance_current: "110.00",
			balance_available: "100.00",
			balance_limit: "0",
			currency: "USD",
			type: "depository",
			subtype: "checking",
			mask: "0000",
			created_at: "2025-08-14T16:37:10.608Z",
			routing_number: null,
			wire_routing_number: null,
			deposit_account: false,
			is_selected: false,
			is_additional_account: false,
			average_balance: -190.68,
			match: false,
			depositAccountInfo: null,
			verification_result: null
		};

		const bankAccountWithVerification = {
			id: "9c1a010c-03e1-4d41-9868-147c3acff807",
			business_integration_task_id: "0ad607be-dadb-4f5c-8b29-c6cb07e51257",
			bank_account: "1111222233330000",
			bank_name: "Plaid Checking",
			official_name: "Plaid Gold Standard 0% Interest Checking",
			institution_name: "ACH",
			verification_status: "VERIFIED",
			balance_current: "110",
			balance_available: "100",
			balance_limit: "0",
			currency: "USD",
			type: "depository",
			subtype: "checking",
			mask: "0000",
			created_at: "2025-08-14T16:36:57.040Z",
			routing_number: "U2FsdGVkX19v6fbbUiYCDbquWouxVKWwy58KmAj7gZQ=",
			wire_routing_number: "U2FsdGVkX1/dz2BshMQWrQji17DjEYCgiM2ETVpyAX8=",
			deposit_account: true,
			is_selected: true,
			is_additional_account: false,
			average_balance: null,
			match: false,
			verification_result: {
				id: "c3548687-cb76-4304-a625-8c1a62e09b87",
				verification_status: "SUCCESS",
				created_at: "2025-08-14T16:39:34.224Z",
				updated_at: "2025-08-14T16:39:34.224Z",
				account_verification_response: {
					name: "No Information Found",
					code: "RT00",
					description:
						"No Information Found - The routing number appears to be accurate; however, no positive or negative information has been reported on the account. Please contact customer to ensure that the correct account information was entered.",
					verification_response: "Declined"
				},
				account_authentication_response: {
					name: null,
					code: null,
					description: null,
					verification_response: null
				}
			},
			routing: "011401533",
			wire_routing: "021000021"
		};

		const creditCardAccount = {
			id: "account-2",
			bank_account: "9876543210",
			mask: "****0123",
			bank_name: "Mock Bank",
			balance_current: "$5,000.00",
			balance_limit: "$10,000.00",
			type: "credit",
			official_name: "Mock Credit Account"
		};

		const mockedBankingWithVerificationResponse = {
			status: "success",
			message: "Banking information fetched successfully.",
			data: [bankAccountWithoutVerification, bankAccountWithVerification]
		};

		const mockedBankingWithoutVerificationResponse = {
			status: "success",
			message: "Banking information fetched successfully.",
			data: [bankAccountWithoutVerification]
		};

		const mockedBankingWithCreditCardResponse = {
			status: "success",
			message: "Banking information fetched successfully.",
			data: [bankAccountWithVerification, creditCardAccount]
		};

		beforeEach(() => {
			jest.clearAllMocks();
		});

		it("should return banking information when no matching verification result is found", async () => {
			(banking.getBankingInformation as jest.Mock).mockResolvedValue(mockedBankingWithoutVerificationResponse);
			const result = await reportEventsHandler._getBankingInformation({
				business_id: businessID,
				case_id: "test-case-id"
			});
			expect(banking.getBankingInformation).toHaveBeenCalledWith(
				{ businessID, caseID: "test-case-id" },
				{ caseID: "test-case-id" }
			);

			expect(result).toEqual([
				{
					...bankAccountWithoutVerification,
					verification_result: null
				}
			]);
		});

		it("should return an empty array when no banking information is found", async () => {
			(banking.getBankingInformation as jest.Mock).mockResolvedValue({
				data: [],
				message: "Banking information fetched successfully."
			});
			const result = await reportEventsHandler._getBankingInformation({ business_id: businessID });
			expect(result).toEqual([]);
		});

		it("should apply the isCredit filter when isCredit is true", async () => {
			(banking.getBankingInformation as jest.Mock).mockResolvedValue(mockedBankingWithCreditCardResponse);
			const result = await reportEventsHandler._getBankingInformation({ business_id: businessID }, true);

			expect(result).toEqual([
				{
					...creditCardAccount
				}
			]);
		});

		it("should not return credit card accounts when isCredit is not provided", async () => {
			(banking.getBankingInformation as jest.Mock).mockResolvedValue(mockedBankingWithCreditCardResponse);
			const result = await reportEventsHandler._getBankingInformation({ business_id: businessID });

			expect(banking.getBankingInformation).toHaveBeenCalledWith(
				{ businessID, caseID: undefined },
				{ caseID: undefined }
			);

			expect(result).toEqual([bankAccountWithVerification]);
		});
	});

	describe("_getContactInformationData", () => {
		let mockFactEngine: any;

		beforeEach(() => {
			jest.clearAllMocks();

			mockFactEngine = {
				addRuleOverride: jest.fn(),
				applyRules: jest.fn().mockResolvedValue({}),
				getResults: jest.fn().mockResolvedValue({
					addresses: null,
					addresses_deliverable: null,
					address_verification: null,
					business_addresses_submitted_strings: null,
					names_found: null,
					names_submitted: null,
					name_match_boolean: { value: false }
				})
			};

			(FactEngine as jest.Mock).mockImplementation(() => mockFactEngine);
		});

		const body: I360Report = {
			business_id: "37cefe17-381b-4f3d-9140-6ea8b9abd817",
			case_id: "2b1b5c39-d74a-4600-9215-1c4d01121d61",
			customer_id: "0262d0f1-20b5-44e9-ad17-75b41c69000e"
		};

		it("should properly mark primary address as google_profile_verified when google match found", async () => {
			mockFactEngine.getResults.mockResolvedValue({
				addresses: null,
				addresses_deliverable: { value: ["123 Main St, New York, NY, 10001"] },
				address_verification: { value: { addresses: ["123 Main St, New York, NY, 10001"], status: "success" } },
				business_addresses_submitted_strings: {
					value: [
						{ address: "123 MAIN STREET, NEW YORK, NY 10001", is_primary: true },
						{ address: "456 Oak Ave, Brooklyn, NY 11201", is_primary: false }
					]
				},
				names_found: { value: ["Test Business Corp"] },
				names_submitted: { value: [{ name: "Test Business", submitted: true }] },
				name_match_boolean: { value: true }
			});

			// Mock the Google profile match result to return a successful match
			mockGetGoogleProfileMatchResult.mockResolvedValue({
				business_match: "Match Found",
				google_profile: {
					business_name: "Test Business",
					address: "123 Test St",
					phone_number: "(555) 123-4567",
					website: "https://test.com",
					rating: 4.5,
					reviews: 100,
					thumbnail: "https://test.com/thumb.jpg",
					gps_coordinates: { latitude: 40.7128, longitude: -74.006 },
					google_search_link: "https://google.com/search?test"
				},
				address_match: "Match",
				address_similarity_score: 95
			});

			const result = await reportEventsHandler._getContactInformationData(body);

			expect(FactEngine).toHaveBeenCalledTimes(1);

			expect(result.known_addresses).toEqual([
				{
					type: "submitted",
					address: "123 MAIN STREET, NEW YORK, NY 10001",
					is_primary: true,
					google_profile_verified: true,
					deliverable: true,
					registration_verified: true
				},
				{
					type: "submitted",
					address: "456 Oak Ave, Brooklyn, NY 11201",
					is_primary: false,
					google_profile_verified: false,
					deliverable: false,
					registration_verified: false
				}
			]);
		});

		it("should set google_profile_verified to false on primary address when google match found but address match is no match", async () => {
			mockFactEngine.getResults.mockResolvedValue({
				addresses: null,
				addresses_deliverable: { value: ["123 Main St, New York, NY, 10001"] },
				address_verification: { value: { addresses: ["123 Main St, New York, NY, 10001"], status: "success" } },
				business_addresses_submitted_strings: {
					value: [{ address: "123 MAIN STREET, NEW YORK, NY 10001", is_primary: true }]
				},
				names_found: { value: ["Test Business Corp"] },
				names_submitted: { value: [{ name: "Test Business", submitted: true }] },
				name_match_boolean: { value: true }
			});

			// Mock the Google profile match result with business match but no address match
			mockGetGoogleProfileMatchResult.mockResolvedValue({
				business_match: "Match Found",
				google_profile: {
					business_name: "Test Business",
					address: "456 Different St",
					phone_number: "(555) 123-4567",
					website: "https://test.com",
					rating: 4.5,
					reviews: 100,
					thumbnail: "https://test.com/thumb.jpg",
					gps_coordinates: { latitude: 40.7128, longitude: -74.006 },
					google_search_link: "https://google.com/search?test"
				},
				address_match: "No Match",
				address_similarity_score: 20
			});

			const result = await reportEventsHandler._getContactInformationData(body);

			expect(FactEngine).toHaveBeenCalledTimes(1);

			expect(result.known_addresses).toEqual([
				{
					type: "submitted",
					address: "123 MAIN STREET, NEW YORK, NY 10001",
					is_primary: true,
					google_profile_verified: false,
					deliverable: true,
					registration_verified: true
				}
			]);
		});

		it("should handle mix of submitted and reported addresses", async () => {
			const mockFactEngine = {
				addRuleOverride: jest.fn(),
				applyRules: jest.fn(),
				getResults: jest.fn().mockResolvedValue({
					addresses: { value: ["789 Pine St, Chicago, IL, 60601", "321 Elm Dr, Miami, FL, 33101"] },
					addresses_deliverable: { value: ["789 Pine St, Chicago, IL, 60601"] },
					address_verification: { value: { addresses: ["123 Elm Dr, Miami, FL, 33101"], status: "success" } },
					business_addresses_submitted_strings: {
						value: [{ address: "123 Main St, New York, NY 10001", is_primary: true }]
					},
					names_found: { value: ["Business Inc", "Business Corp"] },
					names_submitted: {
						value: [
							{ name: "My Business", submitted: true },
							{ name: "Old Name", submitted: false }
						]
					},
					name_match_boolean: { value: false }
				})
			};

			(FactEngine as jest.Mock).mockReturnValue(mockFactEngine);

			// Mock the Google profile match result with no match
			mockGetGoogleProfileMatchResult.mockResolvedValue({
				business_match: "No Match",
				google_profile: null,
				address_match: "No Match",
				address_similarity_score: 0
			});

			const result = await reportEventsHandler._getContactInformationData(body);

			expect(result.known_addresses).toEqual([
				{
					type: "submitted",
					address: "123 Main St, New York, NY 10001",
					is_primary: true,
					registration_verified: false,
					google_profile_verified: false,
					deliverable: false
				},
				{
					type: "reported",
					address: "789 Pine St, Chicago, IL, 60601",
					is_primary: false,
					registration_verified: false,
					google_profile_verified: false,
					deliverable: true
				},
				{
					type: "reported",
					address: "321 Elm Dr, Miami, FL, 33101",
					is_primary: false,
					registration_verified: false,
					google_profile_verified: false,
					deliverable: false
				}
			]);

			expect(result.business_names).toEqual({
				name_match_boolean: false,
				submitted_names: ["My Business"],
				reported_names: ["Business Inc", "Business Corp"]
			});
		});

		it("should match registration_verified when address uses 'Suite' and verification uses 'Unit'", async () => {
			const mockFactEngineLocal = {
				addRuleOverride: jest.fn(),
				applyRules: jest.fn(),
				getResults: jest.fn().mockResolvedValue({
					addresses: {
						value: [
							"171 E Liberty St, Suite 201, NT, M6K 3P6",
							"171 E Liberty St, NT, M6K3E7",
							"171 E Liberty St, Unit 201, NT, M6K 3P6"
						]
					},
					addresses_deliverable: { value: [] },
					address_verification: {
						value: {
							addresses: ["171 E Liberty St, NT, M6K3E7", "171 E Liberty St, Unit 201, NT, M6K 3P6"],
							status: "success"
						}
					},
					business_addresses_submitted_strings: {
						value: [{ address: "171 E Liberty St, Suite 201, Toronto, ON M6K 3P6", is_primary: true }]
					},
					names_found: { value: ["Dream Payments Corp"] },
					names_submitted: { value: [{ name: "Dream Payments", submitted: true }] },
					name_match_boolean: { value: true }
				})
			};

			(FactEngine as jest.Mock).mockReturnValue(mockFactEngineLocal);

			mockGetGoogleProfileMatchResult.mockResolvedValue({
				business_match: "No Match",
				google_profile: null,
				address_match: "No Match",
				address_similarity_score: 0
			});

			const result = await reportEventsHandler._getContactInformationData(body);

			// Submitted address "Suite 201" should match verification "Unit 201"
			const submittedAddr = result.known_addresses.find((a: any) => a.type === "submitted");
			expect(submittedAddr?.registration_verified).toBe(true);

			// Reported "Suite 201" should also match verification "Unit 201"
			const reportedSuite = result.known_addresses.find(
				(a: any) => a.type === "reported" && a.address?.includes("Suite")
			);
			expect(reportedSuite?.registration_verified).toBe(true);

			// Reported "Unit 201" should match exactly
			const reportedUnit = result.known_addresses.find(
				(a: any) => a.type === "reported" && a.address?.includes("Unit")
			);
			expect(reportedUnit?.registration_verified).toBe(true);

			// Reported address without unit should also match
			const reportedNoUnit = result.known_addresses.find(
				(a: any) => a.type === "reported" && a.address?.includes("M6K3E7")
			);
			expect(reportedNoUnit?.registration_verified).toBe(true);
		});

		it("should match registration_verified via base address fallback when unit number is absent", async () => {
			const mockFactEngineLocal = {
				addRuleOverride: jest.fn(),
				applyRules: jest.fn(),
				getResults: jest.fn().mockResolvedValue({
					addresses: {
						value: [
							// Reported address WITHOUT unit number (e.g. from Google/SERP)
							"171 E Liberty St, NT, M6K 3P6"
						]
					},
					addresses_deliverable: { value: [] },
					address_verification: {
						value: {
							// Verified address WITH unit number (from Trulioo)
							addresses: ["171 E Liberty St, Unit 201, NT, M6K 3P6"],
							status: "success"
						}
					},
					business_addresses_submitted_strings: {
						value: [{ address: "171 E Liberty St, NT, M6K 3P6, Canada", is_primary: true }]
					},
					names_found: null,
					names_submitted: null,
					name_match_boolean: { value: false }
				})
			};

			(FactEngine as jest.Mock).mockReturnValue(mockFactEngineLocal);

			mockGetGoogleProfileMatchResult.mockResolvedValue(null);

			const result = await reportEventsHandler._getContactInformationData(body);

			// Reported address without unit should match via base address fallback
			const reportedAddr = result.known_addresses.find((a: any) => a.type === "reported");
			expect(reportedAddr?.registration_verified).toBe(true);

			// Submitted address without unit should also match via base address fallback
			const submittedAddr = result.known_addresses.find((a: any) => a.type === "submitted");
			expect(submittedAddr?.registration_verified).toBe(true);
		});

		it("should NOT match registration_verified when addresses are truly different", async () => {
			const mockFactEngineLocal = {
				addRuleOverride: jest.fn(),
				applyRules: jest.fn(),
				getResults: jest.fn().mockResolvedValue({
					addresses: {
						value: ["999 Unrelated Ave, Boston, MA, 02101"]
					},
					addresses_deliverable: { value: [] },
					address_verification: {
						value: {
							addresses: ["171 E Liberty St, Unit 201, NT, M6K 3P6"],
							status: "success"
						}
					},
					business_addresses_submitted_strings: { value: [] },
					names_found: null,
					names_submitted: null,
					name_match_boolean: { value: false }
				})
			};

			(FactEngine as jest.Mock).mockReturnValue(mockFactEngineLocal);

			mockGetGoogleProfileMatchResult.mockResolvedValue(null);

			const result = await reportEventsHandler._getContactInformationData(body);

			const reportedAddr = result.known_addresses.find((a: any) => a.type === "reported");
			expect(reportedAddr?.registration_verified).toBe(false);
		});

		it("should return both submitted and reported names", async () => {
			const mockFactEngine = {
				addRuleOverride: jest.fn(),
				applyRules: jest.fn(),
				getResults: jest.fn().mockResolvedValue({
					addresses: null,
					addresses_deliverable: null,
					address_verification: null,
					business_addresses_submitted_strings: null,
					names_found: { value: ["Found Business Name"] },
					names_submitted: {
						value: [
							{ name: "Submitted Name 1", submitted: true },
							{ name: "Not Submitted Name", submitted: false },
							{ name: "Submitted Name 2", submitted: true }
						]
					},
					name_match_boolean: { value: true }
				})
			};

			(FactEngine as jest.Mock).mockReturnValue(mockFactEngine);

			// Mock the Google profile match result returning null
			mockGetGoogleProfileMatchResult.mockResolvedValue(null);

			const result = await reportEventsHandler._getContactInformationData(body);

			expect(result.business_names.submitted_names).toEqual(["Submitted Name 1", "Submitted Name 2"]);
			expect(result.business_names.reported_names).toEqual(["Found Business Name"]);
		});
	});

	describe("_getRiskScoreData", () => {
		const body: I360Report = {
			business_id: "37cefe17-381b-4f3d-9140-6ea8b9abd817",
			case_id: "2b1b5c39-d74a-4600-9215-1c4d01121d61",
			customer_id: "0262d0f1-20b5-44e9-ad17-75b41c69000e"
		};

		const ownerWithIdv = { id: "owner-with-idv-uuid" };
		const ownerWithoutIdv = { id: "owner-without-idv-uuid" };

		const mockIdvResponse = [
			{
				applicant: {
					id: ownerWithIdv.id,
					status: "SUCCESS",
					updated_at: "2026-01-29T20:07:30Z",
					risk_check_result: {
						name: "match",
						synthetic_identity_risk_score: 0.1,
						stolen_identity_risk_score: 0.2,
						ssn: "match"
					}
				},
				identity_verification_attempted: true,
				documents: undefined
			}
		];

		it("should return risk scores for all owners when one owner has no identity_verification record", async () => {
			(getOwners as jest.Mock).mockResolvedValue([ownerWithoutIdv, ownerWithIdv]);

			(PlaidIdv.getApplicantVerificationResponse as jest.Mock)
				.mockResolvedValueOnce([])
				.mockResolvedValueOnce(mockIdvResponse);

			const result = await reportEventsHandler._getRiskScoreData(body);

			expect(result).toHaveLength(2);

			expect(result[0]).toEqual({
				owner_id: ownerWithoutIdv.id,
				identity_verification_attempted: false,
				status: "PENDING"
			});

			expect(result[1]).toMatchObject({
				owner_id: ownerWithIdv.id,
				name: "match",
				synthetic_identity_risk_score: 0.1,
				stolen_identity_risk_score: 0.2,
				status: "SUCCESS",
				identity_verification_attempted: true,
				ssn_verification_status: "match"
			});
		});

		it("should not throw when all owners have no identity_verification record", async () => {
			(getOwners as jest.Mock).mockResolvedValue([ownerWithoutIdv]);
			(PlaidIdv.getApplicantVerificationResponse as jest.Mock).mockResolvedValue([]);

			const result = await reportEventsHandler._getRiskScoreData(body);

			expect(result).toHaveLength(1);
			expect(result[0]).toEqual({
				owner_id: ownerWithoutIdv.id,
				identity_verification_attempted: false,
				status: "PENDING"
			});
		});
	});

	describe("_getWatchlistData", () => {
		let mockFactEngine: any;

		const body: I360Report = {
			business_id: "37cefe17-381b-4f3d-9140-6ea8b9abd817",
			case_id: "2b1b5c39-d74a-4600-9215-1c4d01121d61",
			customer_id: "0262d0f1-20b5-44e9-ad17-75b41c69000e"
		};

		beforeEach(() => {
			jest.clearAllMocks();

			mockFactEngine = {
				addRuleOverride: jest.fn(),
				applyRules: jest.fn().mockResolvedValue({}),
				getResults: jest.fn().mockResolvedValue({
					watchlist: null,
					names_submitted: null,
					people: null
				})
			};

			(FactEngine as jest.Mock).mockImplementation(() => mockFactEngine);
		});

		it("should apply combineWatchlistMetadata rule override for watchlist_raw", async () => {
			await reportEventsHandler._getWatchlistData(body);

			expect(mockFactEngine.addRuleOverride).toHaveBeenCalledWith(
				"watchlist_raw",
				FactRules.combineWatchlistMetadata
			);
		});

		it("should apply combineWatchlistMetadata BEFORE applyRules", async () => {
			const callOrder: string[] = [];
			mockFactEngine.addRuleOverride.mockImplementation(() => callOrder.push("addRuleOverride"));
			mockFactEngine.applyRules.mockImplementation(() => {
				callOrder.push("applyRules");
				return Promise.resolve({});
			});

			await reportEventsHandler._getWatchlistData(body);

			expect(callOrder).toEqual(["addRuleOverride", "applyRules"]);
		});

		it("should return watchlist data with consolidated hits from business and person screenings", async () => {
			mockFactEngine.getResults.mockResolvedValue({
				watchlist: {
					value: {
						metadata: [
							{
								id: "hit-1",
								type: "sanctions",
								metadata: {
									abbr: "OFAC",
									title: "SDN",
									agency: "OFAC",
									agency_abbr: "OFAC",
									entity_name: "Entity A"
								}
							},
							{
								id: "hit-2",
								type: "pep",
								metadata: {
									abbr: "WC",
									title: "PEP List",
									agency: "World Check",
									agency_abbr: "WC",
									entity_name: "Person B"
								}
							}
						],
						message: "Found 2 consolidated watchlist hit(s)"
					}
				},
				names_submitted: { value: [{ name: "Test Business", submitted: true }] },
				people: null
			});

			const result = await reportEventsHandler._getWatchlistData(body);

			expect(result.watchlist_hits).toHaveLength(2);
		});

		it("should return null watchlist_hits when no hits from any source", async () => {
			mockFactEngine.getResults.mockResolvedValue({
				watchlist: { value: { metadata: [], message: "No Watchlist hits were identified" } },
				names_submitted: null,
				people: null
			});

			const result = await reportEventsHandler._getWatchlistData(body);

			expect(result.watchlist_hits).toBeNull();
			expect(result.watchlist_hits_count).toBe(0);
		});

		it("should handle undefined watchlist gracefully", async () => {
			mockFactEngine.getResults.mockResolvedValue({
				watchlist: undefined,
				names_submitted: null,
				people: null
			});

			const result = await reportEventsHandler._getWatchlistData(body);

			expect(result.watchlist_hits).toBeNull();
			expect(result.watchlist_hits_count).toBe(0);
		});

		it("should throw error when factEngine fails", async () => {
			mockFactEngine.applyRules.mockRejectedValue(new Error("FactEngine error"));

			await expect(reportEventsHandler._getWatchlistData(body)).rejects.toThrow("FactEngine error");
		});
	});

	describe("_fetchAdverseMediaData", () => {
		const mockBusinessId = "37cefe17-381b-4f3d-9140-6ea8b9abd817";
		const mockCaseId = "2b1b5c39-d74a-4600-9215-1c4d01121d61";

		const mockAdverseMediaResponse = {
			id: "mock-adverse-media-id",
			articles: [
				{
					id: "article-id-1",
					title: "Test adverse media article 1",
					link: "https://example.com/article1",
					date: "2024-01-15",
					source: "News Source 1",
					entity_focus_score: 9,
					risk_level: "HIGH",
					risk_description: "High risk due to fraud allegations",
					media_type: "business",
					created_at: "2024-01-15T00:00:00Z"
				},
				{
					id: "article-id-2",
					title: "Test adverse media article 2",
					link: "https://example.com/article2",
					date: "2024-02-10",
					source: "News Source 2",
					entity_focus_score: 5,
					risk_level: "MEDIUM",
					risk_description: "Medium risk due to regulatory issues",
					media_type: "business",
					created_at: "2024-02-10T00:00:00Z"
				}
			],
			total_risk_count: 2,
			high_risk_count: 1,
			medium_risk_count: 1,
			low_risk_count: 0,
			average_risk_score: 7
		};

		afterEach(() => {
			jest.clearAllMocks();
		});

		it("should fetch adverse media data by case ID when caseId is provided", async () => {
			(adverseMedia.getAdverseMediaDataByCaseId as jest.Mock).mockResolvedValue(mockAdverseMediaResponse);

			const result = await reportEventsHandler._fetchAdverseMediaData(mockBusinessId, mockCaseId);

			expect(adverseMedia.getAdverseMediaDataByCaseId).toHaveBeenCalledWith({ caseId: mockCaseId }, { sortFields: [] });
			expect(adverseMedia.getAdverseMediaByBusinessId).not.toHaveBeenCalled();
			expect(result).toEqual(mockAdverseMediaResponse);
		});

		it("should fetch adverse media data by business ID when caseId is not provided", async () => {
			(adverseMedia.getAdverseMediaByBusinessId as jest.Mock).mockResolvedValue(mockAdverseMediaResponse);

			const result = await reportEventsHandler._fetchAdverseMediaData(mockBusinessId);

			expect(adverseMedia.getAdverseMediaByBusinessId).toHaveBeenCalledWith(
				{ businessId: mockBusinessId },
				{ sortFields: [] }
			);
			expect(adverseMedia.getAdverseMediaDataByCaseId).not.toHaveBeenCalled();
			expect(result).toEqual(mockAdverseMediaResponse);
		});

		it("should fetch adverse media data by business ID when caseId is undefined", async () => {
			(adverseMedia.getAdverseMediaByBusinessId as jest.Mock).mockResolvedValue(mockAdverseMediaResponse);

			const result = await reportEventsHandler._fetchAdverseMediaData(mockBusinessId, undefined);

			expect(adverseMedia.getAdverseMediaByBusinessId).toHaveBeenCalledWith(
				{ businessId: mockBusinessId },
				{ sortFields: [] }
			);
			expect(adverseMedia.getAdverseMediaDataByCaseId).not.toHaveBeenCalled();
			expect(result).toEqual(mockAdverseMediaResponse);
		});

		it("should return empty object when no adverse media data is found", async () => {
			(adverseMedia.getAdverseMediaByBusinessId as jest.Mock).mockResolvedValue({});

			const result = await reportEventsHandler._fetchAdverseMediaData(mockBusinessId);

			expect(result).toEqual({});
		});

		it("should log error and throw when getAdverseMediaDataByCaseId fails", async () => {
			const mockError = new Error("Failed to fetch adverse media by case ID");
			(adverseMedia.getAdverseMediaDataByCaseId as jest.Mock).mockRejectedValue(mockError);

			await expect(reportEventsHandler._fetchAdverseMediaData(mockBusinessId, mockCaseId)).rejects.toThrow(
				"Failed to fetch adverse media by case ID"
			);

			expect(logger.error).toHaveBeenCalledWith({ error: mockError }, "Error fetching adverse media data");
		});

		it("should log error and throw when getAdverseMediaByBusinessId fails", async () => {
			const mockError = new Error("Failed to fetch adverse media by business ID");
			(adverseMedia.getAdverseMediaByBusinessId as jest.Mock).mockRejectedValue(mockError);

			await expect(reportEventsHandler._fetchAdverseMediaData(mockBusinessId)).rejects.toThrow(
				"Failed to fetch adverse media by business ID"
			);

			expect(logger.error).toHaveBeenCalledWith({ error: mockError }, "Error fetching adverse media data");
		});

		it("should handle network timeout errors gracefully", async () => {
			const timeoutError = new Error("Request timeout");
			timeoutError.name = "TimeoutError";
			(adverseMedia.getAdverseMediaByBusinessId as jest.Mock).mockRejectedValue(timeoutError);

			await expect(reportEventsHandler._fetchAdverseMediaData(mockBusinessId)).rejects.toThrow("Request timeout");

			expect(logger.error).toHaveBeenCalled();
		});

		it("should handle database errors gracefully", async () => {
			const dbError = new Error("Database connection failed");
			dbError.name = "DatabaseError";
			(adverseMedia.getAdverseMediaDataByCaseId as jest.Mock).mockRejectedValue(dbError);

			await expect(reportEventsHandler._fetchAdverseMediaData(mockBusinessId, mockCaseId)).rejects.toThrow(
				"Database connection failed"
			);

			expect(logger.error).toHaveBeenCalledWith({ error: dbError }, "Error fetching adverse media data");
		});
	});

	describe("_getMatchProData", () => {
		const { MatchUtil } = require("#lib/match/matchUtil");
		const mockBody = { business_id: "mock-business-id" } as I360Report;

		beforeEach(() => {
			jest.clearAllMocks();
		});

		it("returns {} when business_id is missing", async () => {
			const result = await reportEventsHandler._getMatchProData({} as I360Report);
			expect(result).toEqual({});
		});

		it("returns {} when getMatchBusinessResult returns empty", async () => {
			MatchUtil.getMatchBusinessResult.mockResolvedValue({});
			const result = await reportEventsHandler._getMatchProData(mockBody);
			expect(result).toEqual({});
		});

		it("extracts default ICA from aggregated multi-ICA response (success)", async () => {
			const icaEntry = { ica: "ICA-001", isDefault: true };
			const icaResult = {
				terminationInquiryRequest: { acquirerId: "ICA-001" },
				terminationInquiryResponse: { results: [] }
			};
			MatchUtil.getMatchBusinessResult.mockResolvedValue({
				multi_ica: true,
				icas: [icaEntry],
				results: { "ICA-001": icaResult },
				execution_metadata: { "ICA-001": { cached: false, timestamp: "2024-01-01T00:00:00Z" } },
				summary: { total: 1, success: 1, failed: 0 },
				timestamp: "2024-01-01T00:00:00Z"
			});

			const result = await reportEventsHandler._getMatchProData(mockBody);
			expect(result).toMatchObject({
				icas: [icaEntry],
				results: { "ICA-001": icaResult },
				multi_ica: false,
				summary: { total: 1, success: 1, failed: 0 }
			});
		});

		it("reports failure when default ICA result has aggregated error string", async () => {
			const icaEntry = { ica: "ICA-002", isDefault: true };
			MatchUtil.getMatchBusinessResult.mockResolvedValue({
				multi_ica: true,
				icas: [icaEntry],
				results: { "ICA-002": { error: "Upstream timeout" } },
				timestamp: "2024-01-01T00:00:00Z"
			});

			const result = await reportEventsHandler._getMatchProData(mockBody) as any;
			expect(result.summary).toEqual({ total: 1, success: 0, failed: 1 });
			expect(result.multi_ica).toBe(false);
		});

		it("reports failure when default ICA result has normalized errors object", async () => {
			const icaEntry = { ica: "ICA-003", isDefault: true };
			MatchUtil.getMatchBusinessResult.mockResolvedValue({
				multi_ica: true,
				icas: [icaEntry],
				results: {
					"ICA-003": {
						errors: { error: [{ source: "MC", details: "Invalid merchant" }] }
					}
				},
				timestamp: "2024-01-01T00:00:00Z"
			});

			const result = await reportEventsHandler._getMatchProData(mockBody) as any;
			expect(result.summary).toEqual({ total: 1, success: 0, failed: 1 });
		});

		it("falls back to first results key when no default ICA in icas array", async () => {
			MatchUtil.getMatchBusinessResult.mockResolvedValue({
				multi_ica: true,
				icas: [{ ica: "ICA-004", isDefault: false }],
				results: { "ICA-004": { terminationInquiryRequest: {}, terminationInquiryResponse: {} } },
				timestamp: "2024-01-01T00:00:00Z"
			});

			const result = await reportEventsHandler._getMatchProData(mockBody) as any;
			expect(result.icas[0].ica).toBe("ICA-004");
			expect(result.icas[0].isDefault).toBe(true);
		});

		it("normalizes legacy single-ICA response", async () => {
			MatchUtil.getMatchBusinessResult.mockResolvedValue({
				multi_ica: false,
				terminationInquiryRequest: { acquirerId: "LEGACY-ICA" },
				terminationInquiryResponse: { results: [] },
				timestamp: "2024-01-01T00:00:00Z"
			});

			const result = await reportEventsHandler._getMatchProData(mockBody) as any;
			expect(result.multi_ica).toBe(false);
			expect(result.icas).toEqual([{ ica: "LEGACY-ICA", isDefault: true }]);
			expect(result.results["LEGACY-ICA"]).toBeDefined();
		});

		it("returns {} for legacy single-ICA response with errors", async () => {
			MatchUtil.getMatchBusinessResult.mockResolvedValue({
				multi_ica: false,
				Errors: { Error: [{ source: "MC", details: "error" }] }
			});

			const result = await reportEventsHandler._getMatchProData(mockBody);
			expect(result).toEqual({});
		});

		it("returns {} and logs error when getMatchBusinessResult throws", async () => {
			MatchUtil.getMatchBusinessResult.mockRejectedValue(new Error("DB failure"));

			const result = await reportEventsHandler._getMatchProData(mockBody);
			expect(result).toEqual({});
			expect(logger.error).toHaveBeenCalled();
		});
	});

	describe("_getCountryCode", () => {
		const body: I360Report = { business_id: "37cefe17-381b-4f3d-9140-6ea8b9abd817" as any };

		beforeEach(() => {
			jest.clearAllMocks();
		});

		it("returns the primary address country", async () => {
			(internalGetBusinessNamesAndAddresses as jest.Mock).mockResolvedValue({
				businessID: body.business_id,
				names: [],
				addresses: [
					{ line_1: "1 Main St", city: "London", state: "", country: "GB", postal_code: "EC1A", mobile: null, is_primary: true },
					{ line_1: "2 Side St", city: "New York", state: "NY", country: "US", postal_code: "10001", mobile: null, is_primary: false }
				]
			});

			const result = await reportEventsHandler._getCountryCode(body);
			expect(result).toBe("GB");
		});

		it("falls back to the first address when none is primary", async () => {
			(internalGetBusinessNamesAndAddresses as jest.Mock).mockResolvedValue({
				businessID: body.business_id,
				names: [],
				addresses: [
					{ line_1: "1 Main St", city: "London", state: "", country: "GB", postal_code: "EC1A", mobile: null, is_primary: false }
				]
			});

			const result = await reportEventsHandler._getCountryCode(body);
			expect(result).toBe("GB");
		});

		it("returns null when addresses array is empty", async () => {
			(internalGetBusinessNamesAndAddresses as jest.Mock).mockResolvedValue({
				businessID: body.business_id,
				names: [],
				addresses: []
			});

			const result = await reportEventsHandler._getCountryCode(body);
			expect(result).toBeNull();
		});

		it("throws when internalGetBusinessNamesAndAddresses rejects", async () => {
			(internalGetBusinessNamesAndAddresses as jest.Mock).mockRejectedValue(new Error("API failure"));

			await expect(reportEventsHandler._getCountryCode(body)).rejects.toThrow("API failure");
		});
	});
});
