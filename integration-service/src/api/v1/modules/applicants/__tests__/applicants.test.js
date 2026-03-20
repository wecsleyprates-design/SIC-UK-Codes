// @ts-nocheck

import { getBusinessApplicants, sqlQuery, sqlTransaction } from "#helpers/index";
import { StatusCodes } from "http-status-codes";
import { applicants } from "../applicants";
import { ApplicantsApiError } from "../error";
import dayjs from "dayjs";
import { ERROR_CODES } from "#constants";

jest.mock("#helpers/index");
jest.mock("kafkajs");
jest.mock("#configs/index", () => ({
	envConfig: {
		KAFKA_BROKERS: "mocked_brokers",
		KAFKA_SSL_ENABLED: false,
		KAFKA_CLIENT_ID: "mocked_client_id"
		//   ... other mocked configuration properties
	}
}));

beforeAll(() => {
	jest.useFakeTimers("modern");
	jest.setSystemTime(new Date(2024, 4, 26));
	process.env.TZ = "UTC";
});

describe("Applicants", () => {
	afterEach(() => {
		jest.resetAllMocks();
		process.env.TZ = "UTC";
	});

	describe("getBusinessPlaidTransactions", () => {
		const params = {
			businessID: "sampleBusinessID"
		};

		const userInfo = {
			user_id: "user_id"
		};

		const query = {
			pagination: true,
			page: "1",
			items_per_page: "1",
			sort: {
				"bank_account_transactions.date": "ASC"
			},
			search: {
				"bank_account_transactions.description": "Search text"
			},
			filter_date: {
				"bank_account_transactions.date": ["2023-12-22T00:00:00.000Z", "2024-01-22T00:00:00.000Z"]
			}
		};

		const response = {
			records: [
				{
					date: "sampleDate",
					description: "sample description",
					merchant_name: null,
					currency: "sample currency",
					balance: 0,
					transaction: 100,
					account: undefined,
					bank_name: undefined,
					official_name: undefined,
					institution_name: undefined,
					account_type: null,
					account_subtype: null,
					mask: null
				}
			],
			total: 0,
			total_pages: 1,
			total_items: 1
		};

		it("should return the banking transactions of a business", async () => {
			getBusinessApplicants.mockResolvedValueOnce([{ id: "user_id" }]);
			sqlQuery.mockResolvedValueOnce({
				rowCount: 1,
				rows: [
					{
						totalcount: 1
					}
				]
			});

			sqlQuery.mockResolvedValueOnce({
				rowCount: 1,
				rows: [
					{
						date: "sampleDate",
						description: "sample description",
						merchant_name: null,
						currency: "sample currency",
						balance: 0,
						amount: 100,
						bank_account: undefined,
						bank_name: undefined,
						official_name: undefined,
						institution_name: undefined,
						type: null,
						subtype: null
					}
				]
			});

			const result = await applicants.getBusinessPlaidTransactions(params, query, userInfo, {
				authorization: "authorization"
			});

			expect(result).toEqual(response);
		});

		it("should return all the data when pagination is not enabled", async () => {
			getBusinessApplicants.mockResolvedValueOnce([{ id: "user_id" }]);
			sqlQuery.mockResolvedValueOnce({
				rowCount: 1,
				rows: [
					{
						totalcount: 1
					}
				]
			});

			sqlQuery.mockResolvedValueOnce({
				rowCount: 1,
				rows: [
					{
						date: "sampleDate",
						description: "sample description",
						merchant_name: null,
						currency: "sample currency",
						balance: 0,
						amount: -100,
						bank_account: undefined,
						bank_name: undefined,
						official_name: undefined,
						institution_name: undefined,
						type: null,
						subtype: null
					}
				]
			});

			const sampleResponse = {
				records: [
					{
						date: "sampleDate",
						description: "sample description",
						merchant_name: null,
						currency: "sample currency",
						balance: 0,
						transaction: -100,
						account: undefined,
						bank_name: undefined,
						official_name: undefined,
						institution_name: undefined,
						account_type: null,
						account_subtype: null,
						mask: null
					}
				],
				total: 0,
				total_pages: 1,
				total_items: 1
			};

			const result = await applicants.getBusinessPlaidTransactions(params, { ...query, pagination: false }, userInfo, {
				authorization: "authorization"
			});

			expect(result).toEqual(sampleResponse);
		});

		it("should return empty array when no records found", async () => {
			getBusinessApplicants.mockResolvedValueOnce([{ id: "user_id" }]);
			sqlQuery.mockResolvedValueOnce({
				rowCount: 0
			});

			const sampleResponse = {
				records: [],
				total: 0,
				total_pages: 0,
				total_items: 0
			};

			const result = await applicants.getBusinessPlaidTransactions(params, query, userInfo, {
				authorization: "authorization"
			});

			expect(result).toEqual(sampleResponse);
		});

		it("should throw an error when page request is out of range", async () => {
			getBusinessApplicants.mockResolvedValueOnce([{ id: "user_id" }]);

			sqlQuery.mockResolvedValueOnce({
				rowCount: 1,
				rows: [
					{
						totalcount: 1
					}
				]
			});

			try {
				await applicants.getBusinessPlaidTransactions(params, { ...query, page: 20 }, userInfo, {
					authorization: "authorization"
				});
			} catch (error) {
				// Verify that the function throws the expected error
				expect(error).toBeInstanceOf(ApplicantsApiError);
				expect(error.status).toBe(StatusCodes.BAD_REQUEST);
			}
		});
	});

	describe("getAccountBalances", () => {
		const params = {
			businessID: "sampleBusinessID"
		};

		const query = {
			sort: {
				institution_name: "institution",
				balance: 100
			}
		};

		const response = {
			records: [
				{
					institution: "institution",
					balance: 100,
					year: 2024,
					month: 1
				}
			],
			total: 100
		};

		it("should return the account balances of a business", async () => {
			sqlQuery.mockResolvedValueOnce({
				rowCount: 1,
				rows: [
					{
						institution_name: "institution",
						balance: 100,
						year: 2024,
						month: 1
					}
				]
			});

			const result = await applicants.getAccountBalances(params, query);

			expect(result).toEqual(response);
		});

		it("should return emtpy array when no data found", async () => {
			sqlQuery.mockResolvedValueOnce({
				rowCount: 0
			});

			const sampleResponse = {
				records: [],
				total: 0
			};

			const result = await applicants.getAccountBalances(params, query);

			expect(result).toEqual(sampleResponse);
		});
	});

	describe("getTransactionsStats", () => {
		const businessID = "sampleBusinessID";
		const query = {
			platform: "plaid",
			filter_date: {
				"deposits.bank_account_transactions.date": ["2023-12-22T00:00:00.000Z", "2024-01-22T00:00:00.000Z"],
				"spendings.bank_account_transactions.date": ["2023-12-22T00:00:00.000Z", "2024-01-22T00:00:00.000Z"],
				"average_transactions.bank_account_transactions.date": ["2023-12-22T00:00:00.000Z", "2024-01-22T00:00:00.000Z"],
				"sum_transactions.bank_account_transactions.date": ["2023-12-22T00:00:00.000Z", "2024-01-22T00:00:00.000Z"]
			}
		};
		const userInfo = {
			user_id: "user_id"
		};
		const authorization = "authorization";

		afterEach(() => {
			jest.resetAllMocks();
		});

		it("should throw an error if the applicant is not related to the business", async () => {
			getBusinessApplicants.mockResolvedValueOnce([{ id: "other_user_id" }]);

			await expect(applicants.getTransactionsStats({ businessID }, query, userInfo, { authorization })).rejects.toThrow(
				ApplicantsApiError
			);
		});

		it("should return the transactions stats", async () => {
			const records = [{ id: "user_id" }];
			const depositEntries = {
				rowCount: 1,
				rows: [{ category: "Travel", category_count: 1, amount_sum: -100 }]
			};
			const spendingEntries = {
				rowCount: 1,
				rows: [{ category: "Travel", category_count: 1, amount_sum: 100 }]
			};
			const averageTransactionEntries = {
				rowCount: 1,
				rows: [
					{ count: 1, amount: 100, date: "2023-1-22" },
					{ count: 1, amount: 100, date: "2023-1-22" },
					{ count: 1, amount: -100, date: "2023-2-22" },
					{ count: 1, amount: 100, date: "2023-2-22" }
				]
			};

			const sumTransactionEntries = {
				rowCount: 1,
				rows: [
					{ count: 1, amount: 100, date: "2023-1-22" },
					{ count: 1, amount: 100, date: "2023-1-22" },
					{ count: 1, amount: -100, date: "2023-2-22" },
					{ count: 1, amount: 100, date: "2023-2-22" }
				]
			};
			const lastMonthsTransactionEntries = {
				rowCount: 1,
				rows: [{ amount: "100" }]
			};
			const expectedResponse = {
				deposits: {
					categories: [
						{
							amount: 100,
							category: "Travel",
							count: 1
						}
					],
					period: ["2023-12-22T00:00:00.000Z", "2024-01-22T00:00:00.000Z"],
					total_deposits: 100
				},
				spendings: {
					categories: [
						{
							amount: 100,
							count: 1,
							category: "Travel"
						}
					],
					period: ["2023-12-22T00:00:00.000Z", "2024-01-22T00:00:00.000Z"],
					total_spendings: "100.00"
				},
				average_transactions: {
					transaction_type: {
						deposits: [
							{
								amount: 100,
								count: 1,
								month: "February"
							}
						],
						spendings: [
							{
								amount: 100,
								count: 2,
								month: "January"
							},
							{
								amount: 100,
								count: 1,
								month: "February"
							}
						]
					},
					period: ["2023-12-22T00:00:00.000Z", "2024-01-22T00:00:00.000Z"]
				},
				sum_transactions: {
					period: ["2023-12-22T00:00:00.000Z", "2024-01-22T00:00:00.000Z"],
					transaction_type: {
						deposits: [
							{
								amount: 100,
								count: 1,
								month: "February"
							}
						],
						spendings: [
							{
								amount: "200.00",
								count: 2,
								month: "January"
							},
							{
								amount: 100,
								count: 1,
								month: "February"
							}
						]
					}
				},
				last_month_delta: "100.00",
				total_balance: "0.00"
			};

			getBusinessApplicants.mockResolvedValueOnce(records);
			sqlTransaction.mockResolvedValueOnce([
				depositEntries,
				spendingEntries,
				averageTransactionEntries,
				sumTransactionEntries,
				lastMonthsTransactionEntries
			]);

			const result = await applicants.getTransactionsStats({ businessID }, query, userInfo, { authorization });

			expect(result).toEqual(expectedResponse);
		});

		// it("should return the transactions stats when no date_filters are provided", async () => {
		// 	const records = [{ id: "user_id" }];
		// 	const depositEntries = {
		// 		rowCount: 1,
		// 		rows: [{ category: "Travel", category_count: 1, amount_sum: 100, date: "2023-1-22" }]
		// 	};
		// 	const spendingEntries = {
		// 		rowCount: 1,
		// 		rows: [{ category: "Travel", category_count: 1, amount_sum: 100, date: "2023-01-22" }]
		// 	};
		// 	const averageTransactionEntries = {
		// 		rowCount: 1,
		// 		rows: [
		// 			{ count: 1, amount: 100, date: "2023-01-22" },
		// 			{ count: 1, amount: 100, date: "2023-01-22" },
		// 			{ count: 1, amount: -100, date: "2023-02-22" },
		// 			{ count: 1, amount: 100, date: "2023-02-22" }
		// 		]
		// 	};
		// 	const lastMonthsTransactionEntries = {
		// 		rowCount: 1,
		// 		rows: [{ amount: "100" }]
		// 	};
		// 	const expectedResponse = {
		// 		deposits: {
		// 			categories: [{ category: "Travel", count: 1, amount: 100 }],
		// 			period: ["2023-01-22T00:00:00.000Z", "2023-01-23T00:00:00.000Z"],
		// 			total_deposits: "100.00"
		// 		},
		// 		spendings: {
		// 			categories: [{ category: "Travel", count: 1, amount: 100 }],
		// 			period: ["2023-01-22T00:00:00.000Z", "2023-01-23T00:00:00.000Z"],
		// 			total_spendings: "100.00"
		// 		},
		// 		average_transactions: {
		// 			transaction_type: {
		// 				deposits: [
		// 					{
		// 						amount: 100,
		// 						count: 2,
		// 						month: "January"
		// 					},
		// 					{
		// 						amount: 100,
		// 						count: 1,
		// 						month: "February"
		// 					}
		// 				],
		// 				spendings: [
		// 					{
		// 						amount: -100,
		// 						count: 1,
		// 						month: "February"
		// 					}
		// 				]
		// 			},
		// 			period: ["2023-01-01T00:00:00.000Z", "2024-05-26T00:00:00.000Z"]
		// 		},
		// 		last_month_delta: "100.00",
		// 		total_balance: "0.00"
		// 	};

		// 	getBusinessApplicants.mockResolvedValueOnce(records);
		// 	sqlTransaction.mockResolvedValueOnce([depositEntries, spendingEntries, averageTransactionEntries, lastMonthsTransactionEntries]);
		// 	sqlTransaction.mockResolvedValueOnce([depositEntries, spendingEntries, averageTransactionEntries, lastMonthsTransactionEntries]);

		// 	const result = await applicants.getTransactionsStats({ businessID }, {}, userInfo, { authorization });

		// 	expect(result).toEqual(expectedResponse);
		// });

		// it("should return static response if there is no data to be fetched", async () => {
		// 	const records = [{ id: "user_id" }];
		// 	const expectedResponse = {
		// 		deposits: {
		// 			categories: []
		// 		},
		// 		spendings: {
		// 			categories: []
		// 		},
		// 		average_transactions: {
		// 			transaction_type: {
		// 				deposits: [],
		// 				spendings: []
		// 			}
		// 		},
		// 		last_month_delta: 0
		// 	};

		// 	getBusinessApplicants.mockResolvedValueOnce(records);
		// 	sqlTransaction.mockResolvedValueOnce([{ rowCount: 0 }, { rowCount: 0 }]);

		// 	const result = await applicants.getTransactionsStats({ businessID }, {}, userInfo, { authorization });

		// 	expect(result).toEqual(expectedResponse);
		// });
	});

	describe("getBalancesStats", () => {
		const businessID = "sampleBusinessID";
		const startDate = "2023-01-22T18:30:00.000Z";
		const endDate = "2023-02-22T18:30:00.000Z";
		const query = {
			platform: "plaid",
			filter_date: {
				"banking_balances.date": [startDate, endDate]
			}
		};
		const userInfo = {
			user_id: "user_id"
		};
		const authorization = "authorization";

		afterEach(() => {
			jest.resetAllMocks();
		});

		it("should throw an error if the applicant is not related to the business", async () => {
			getBusinessApplicants.mockResolvedValueOnce([{ id: "other_user_id" }]);

			await expect(applicants.getBalancesStats({ businessID }, query, userInfo, { authorization })).rejects.toThrow(
				ApplicantsApiError
			);
		});

		it("should return the balances stats", async () => {
			const records = [{ id: "user_id" }];
			const balancesEntries = {
				rowCount: 1,
				rows: [
					{ year: 2022, month: 12, balance: "50", institution_name: "institution1" },
					{ year: 2023, month: 1, balance: "100", institution_name: "institution1" },
					{ year: 2023, month: 1, balance: "200", institution_name: "institution2" },
					{ year: 2023, month: 2, balance: "300", institution_name: "institution1" }
				]
			};

			const expectedResponse = {
				average_balances: {
					latest_balance: {
						accounts: 1,
						balance: 300,
						date: dayjs("2023-02-01").startOf("month"),
						institutions: { institution1: 300 },
						month: "February",
						previousMonthBalance: 300,
						year: 2023
					},
					monthly_balances: [
						{
							accounts: 2,
							month: "January",
							balance: 300,
							institutions: { institution1: 100, institution2: 200 },
							previousMonthBalance: 50,
							date: dayjs("2023-01-01").startOf("month"),
							year: 2023
						},
						{
							accounts: 1,
							month: "February",
							balance: 300,
							institutions: { institution1: 300 },
							previousMonthBalance: 300,
							date: dayjs("2023-02-01").startOf("month"),
							year: 2023
						}
					],
					total_balance: "300.00",
					period: [dayjs(startDate).startOf("month").toISOString(), endDate]
				},
				last_month_delta: "0.00"
			};

			getBusinessApplicants.mockResolvedValueOnce(records);
			sqlQuery.mockResolvedValueOnce(balancesEntries);

			const result = await applicants.getBalancesStats({ businessID }, query, userInfo, { authorization });

			expect(result).toEqual(expectedResponse);
		});

		it("should return the balances stats even if no filter_date is provided", async () => {
			const records = [{ id: "user_id" }];
			const balancesEntries = {
				rowCount: 3,
				rows: [
					{ year: 2022, month: 12, balance: "100", institution_name: "institution1" },
					{ year: 2023, month: 1, balance: "100", institution_name: "institution1" },
					{ year: 2023, month: 1, balance: "200", institution_name: "institution2" },
					{ year: 2023, month: 2, balance: "300", institution_name: "institution1" }
				]
			};
			const expectedResponse = {
				average_balances: {
					monthly_balances: [
						{
							month: "January",
							balance: 300,
							institutions: { institution1: 100, institution2: 200 },
							previousMonthBalance: 100,
							accounts: 2,
							date: dayjs("2023-01-01").startOf("year"),
							year: 2023
						},
						{
							month: "February",
							balance: 300,
							institutions: { institution1: 300 },
							previousMonthBalance: 300,
							accounts: 1,
							date: dayjs("2023-02-01").startOf("month"),
							year: 2023
						}
					],
					latest_balance: {
						month: "February",
						balance: 300,
						institutions: { institution1: 300 },
						previousMonthBalance: 300,
						accounts: 1,
						date: dayjs("2023-02-01").startOf("month"),
						year: 2023
					},
					total_balance: "300.00",
					period: [dayjs("2023-01-01").startOf("year").toISOString(), dayjs("2023-02-01").endOf("month").toISOString()]
				},
				last_month_delta: "0.00"
			};

			getBusinessApplicants.mockResolvedValueOnce(records);
			sqlQuery
				.mockResolvedValueOnce({
					rowCount: 1,
					rows: [{ year: 2023, month: 2, balance: "300", institution_name: "institution1" }]
				})
				.mockResolvedValueOnce(balancesEntries);

			const result = await applicants.getBalancesStats({ businessID }, {}, userInfo, { authorization });
			expect(result).toEqual(expectedResponse);
		});
	});

	describe("getBusinessTransactionAccounts", () => {
		const params = {
			businessID: "sampleBusinessID"
		};

		const query = {};

		const userInfo = {
			user_id: "user_id",
			role: {
				code: "applicant"
			}
		};

		const authorization = "authorization";

		it("should return the transaction accounts of a business for admin", async () => {
			const userInfoAdmin = {
				user_id: "user_id",
				role: {
					code: "admin"
				}
			};
			const mockResult = {
				rowCount: 2,
				rows: [
					{ bank_account: "12345", bank_name: "Test Bank" },
					{ bank_account: "67890", bank_name: "Another Bank" }
				]
			};

			sqlQuery.mockResolvedValueOnce(mockResult);
			const result = await applicants.getBusinessTransactionAccounts(params.businessID, query, userInfoAdmin, {
				authorization
			});
			expect(result).toEqual([
				{
					bank_account: "12345",
					account_name: "Test Bank",
					official_name: undefined,
					institution_name: undefined,
					type: null,
					subtype: null
				},
				{
					bank_account: "67890",
					account_name: "Another Bank",
					official_name: undefined,
					institution_name: undefined,
					type: null,
					subtype: null
				}
			]);
		});

		it("should return the transaction accounts of a business for applicant", async () => {
			getBusinessApplicants.mockResolvedValueOnce([{ id: "user_id" }]);
			const mockResult = {
				rowCount: 2,
				rows: [
					{ bank_account: "12345", bank_name: "Test Bank" },
					{ bank_account: "67890", bank_name: "Another Bank" }
				]
			};

			sqlQuery.mockResolvedValueOnce(mockResult);
			const result = await applicants.getBusinessTransactionAccounts(params.businessID, query, userInfo, {
				authorization
			});
			expect(result).toEqual([
				{
					bank_account: "12345",
					account_name: "Test Bank",
					official_name: undefined,
					institution_name: undefined,
					type: null,
					subtype: null
				},
				{
					bank_account: "67890",
					account_name: "Another Bank",
					official_name: undefined,
					institution_name: undefined,
					type: null,
					subtype: null
				}
			]);
		});

		it("should throw an error if the applicant is not related to the business", async () => {
			getBusinessApplicants.mockResolvedValueOnce([{ id: "other_user_id" }]);
			try {
				await applicants.getBusinessTransactionAccounts(params, query, userInfo, { authorization });
			} catch (error) {
				expect(error).toBeInstanceOf(ApplicantsApiError);
				expect(error.status).toBe(StatusCodes.BAD_REQUEST);
				expect(error.errorCode).toBe(ERROR_CODES.INVALID);
			}
		});
	});
});
