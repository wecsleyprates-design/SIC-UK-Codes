import { Tracker, createTracker } from "knex-mock-client";
import { relatedBusinesses } from "../relatedBusinesses";
import { businesses } from "../businesses";
import { CaseManagementApiError } from "../../case-management/error";

import { sqlQuery, getReportStatusForBusiness } from "#helpers/index";
import { paginate } from "#utils/index";
import { QueryResult } from "pg";
import { UUID } from "crypto";
import { TIN_BEHAVIOR } from "#constants";

jest.mock("kafkajs");

jest.mock("#helpers/index", () => {
	const knex = require("knex");
	const { MockClient } = require("knex-mock-client");
	return {
		db: knex({ client: MockClient, dialect: "pg" }),
		sqlQuery: jest.fn(),
		getReportStatusForBusiness: jest.fn(),
		logger: {
			info: jest.fn(),
			error: jest.fn(),
			warn: jest.fn(),
			debug: jest.fn()
		},
		BullQueue: jest.fn().mockImplementation(() => {
			return {
				add: jest.fn()
			};
		}),
		producer: {
			send: jest.fn()
		}
	};
});

jest.mock("#utils/index", () => ({
	paginate: jest.fn()
}));

jest.mock("#configs/index", () => ({
	envConfig: {
		CRYPTO_SECRET_KEY: "secretkey",
		CRYPTO_IV: "cryptoiv",
		KAFKA_BROKERS: "mocked_brokers",
		KAFKA_SSL_ENABLED: false,
		KAFKA_CLIENT_ID: "mocked_client_id"
	}
}));

jest.mock("../businesses");

const mockSqlQuery = sqlQuery as jest.MockedFunction<typeof sqlQuery>;
const mockGetReportStatusForBusiness = getReportStatusForBusiness as jest.MockedFunction<
	typeof getReportStatusForBusiness
>;
const mockPaginate = paginate as jest.MockedFunction<typeof paginate>;
const mockBusinesses = businesses as jest.Mocked<typeof businesses>;

describe("RelatedBusinesses", () => {
	let tracker: Tracker;

	const createMockIds = () => ({
		businessID: "123e4567-e89b-12d3-a456-426614174000" as UUID,
		customerID: "987fcdeb-51a2-43d7-af12-987654321098" as UUID,
		tin: "123456789"
	});

	const createDefaultParams = () => {
		const ids = createMockIds();
		return {
			businessID: ids.businessID,
			customerID: ids.customerID
		};
	};

	const createMockBusinessRows = () => {
		const ids = createMockIds();
		return [
			{
				id: "111e4567-e89b-12d3-a456-426614174001",
				name: "Test Business 1",
				status: "active",
				created_at: "2025-01-01T00:00:00Z",
				case_id: "case1",
				case_status: "APPROVED",
				customer_id: ids.customerID
			},
			{
				id: "222e4567-e89b-12d3-a456-426614174002",
				name: "Test Business 2",
				status: "active",
				created_at: "2025-01-02T00:00:00Z",
				case_id: "case2",
				case_status: "PENDING",
				customer_id: ids.customerID
			}
		];
	};

	const createMockReportStatus = () => [
		{
			id: "111e4567-e89b-12d3-a456-426614174001",
			status: "completed",
			report_id: "report1",
			created_at: "2025-01-01T01:00:00Z"
		},
		{
			id: "222e4567-e89b-12d3-a456-426614174002",
			status: "pending",
			report_id: "report2",
			created_at: "2025-01-02T01:00:00Z"
		}
	];

	type GetBusinessByIDResult = Awaited<ReturnType<typeof businesses.getBusinessByID>>;
	const createMockGetBusinessByIDResult = (overrides: Partial<GetBusinessByIDResult> = {}) => {
		const mockBusiness: Partial<GetBusinessByIDResult> = {
			tin: createMockIds().tin,
			...overrides
		};
		return mockBusiness as GetBusinessByIDResult;
	};

	beforeAll(() => {
		const knex = require("knex");
		const { MockClient } = require("knex-mock-client");
		const db = knex({ client: MockClient, dialect: "pg" });
		tracker = createTracker(db);
	});

	beforeEach(() => {
		jest.clearAllMocks();
		tracker.reset();

		mockBusinesses.getBusinessByID.mockResolvedValue(createMockGetBusinessByIDResult());
	});

	afterEach(() => {
		jest.resetAllMocks();
	});

	describe("getRelatedBusinesses", () => {
		describe("successful scenarios", () => {
			it("should return related businesses with default pagination and sorting", async () => {
				const mockIds = createMockIds();
				const defaultParams = createDefaultParams();
				const mockBusinessRows = createMockBusinessRows();
				const mockReportStatus = createMockReportStatus();

				// Mock count query
				mockSqlQuery.mockResolvedValueOnce({ rows: [{ count: "2" }] } as QueryResult);

				// Mock businesses query
				mockSqlQuery.mockResolvedValueOnce({ rows: mockBusinessRows } as QueryResult);

				// Mock paginate utility
				mockPaginate.mockReturnValue({
					totalPages: 1,
					totalItems: 2
				});

				// Mock report status enrichment
				mockGetReportStatusForBusiness.mockResolvedValue(mockReportStatus);

				const query = {};
				const result = await relatedBusinesses.getRelatedBusinesses(defaultParams, query);

				expect(mockBusinesses.getBusinessByID).toHaveBeenCalledWith({
					businessID: mockIds.businessID,
					tinBehavior: TIN_BEHAVIOR.ENCRYPT
				});

				expect(mockSqlQuery).toHaveBeenCalledTimes(2);

				// Verify count query
				expect(mockSqlQuery).toHaveBeenNthCalledWith(1, {
					sql: expect.stringContaining("SELECT COUNT(*)"),
					values: [mockIds.tin, mockIds.businessID, mockIds.customerID]
				});

				// Verify businesses query with default sorting
				expect(mockSqlQuery).toHaveBeenNthCalledWith(2, {
					sql: expect.stringContaining("ORDER BY db.created_at DESC"),
					values: [mockIds.tin, mockIds.businessID, mockIds.customerID]
				});

				expect(mockGetReportStatusForBusiness).toHaveBeenCalledWith(
					[
						{ id: mockBusinessRows[0].id, status: mockBusinessRows[0].case_status },
						{ id: mockBusinessRows[1].id, status: mockBusinessRows[1].case_status }
					],
					mockIds.customerID
				);

				expect(result).toEqual({
					records: expect.arrayContaining([
						expect.objectContaining({
							id: mockBusinessRows[0].id,
							name: mockBusinessRows[0].name,
							report_status: "completed",
							report_id: "report1",
							report_created_at: "2025-01-01T01:00:00Z"
						}),
						expect.objectContaining({
							id: mockBusinessRows[1].id,
							name: mockBusinessRows[1].name,
							report_status: "pending",
							report_id: "report2",
							report_created_at: "2025-01-02T01:00:00Z"
						})
					]),
					total_pages: 1,
					total_items: 2
				});
			});

			it("should handle the case where pagination is disabled", async () => {
				const mockIds = createMockIds();
				const defaultParams = createDefaultParams();
				const mockBusinessRows = createMockBusinessRows();
				const mockReportStatus = createMockReportStatus();

				mockSqlQuery.mockResolvedValueOnce({
					rows: [{ count: "2" }]
				} as QueryResult);

				mockSqlQuery.mockResolvedValueOnce({
					rows: mockBusinessRows
				} as QueryResult);

				mockPaginate.mockReturnValue({
					totalPages: 1,
					totalItems: 2
				});

				mockGetReportStatusForBusiness.mockResolvedValue(mockReportStatus);

				const query = { pagination: "false" };
				const result = await relatedBusinesses.getRelatedBusinesses(defaultParams, query);

				// Should not contain pagination LIMIT/OFFSET in query when pagination is disabled
				// (Note: LATERAL JOIN will still have LIMIT 1 which is expected)
				expect(mockSqlQuery).toHaveBeenNthCalledWith(2, {
					sql: expect.not.stringMatching(/LIMIT \d+ OFFSET \d+/),
					values: [mockIds.tin, mockIds.businessID, mockIds.customerID]
				});

				expect(result.records).toHaveLength(2);
			});

			it("should handle custom pagination parameters", async () => {
				const mockIds = createMockIds();
				const defaultParams = createDefaultParams();
				const mockBusinessRows = createMockBusinessRows();
				const mockReportStatus = createMockReportStatus();

				mockSqlQuery.mockResolvedValueOnce({ rows: [{ count: "10" }] } as QueryResult);

				mockSqlQuery.mockResolvedValueOnce({ rows: [mockBusinessRows[0]] } as QueryResult);

				mockPaginate.mockReturnValue({
					totalPages: 2,
					totalItems: 10
				});

				mockGetReportStatusForBusiness.mockResolvedValue([mockReportStatus[0]]);

				const query = {
					items_per_page: 5,
					page: 2
				};

				const result = await relatedBusinesses.getRelatedBusinesses(defaultParams, query);

				// Should contain LIMIT and OFFSET for page 2
				expect(mockSqlQuery).toHaveBeenNthCalledWith(2, {
					sql: expect.stringContaining("LIMIT 5 OFFSET 5"),
					values: [mockIds.tin, mockIds.businessID, mockIds.customerID]
				});

				expect(result.total_pages).toBe(2);
				expect(result.total_items).toBe(10);
			});

			it("should handle custom sorting by db.name", async () => {
				const mockIds = createMockIds();
				const defaultParams = createDefaultParams();
				const mockBusinessRows = createMockBusinessRows();
				const mockReportStatus = createMockReportStatus();

				mockSqlQuery.mockResolvedValueOnce({
					rows: [{ count: "2" }]
				} as QueryResult);

				mockSqlQuery.mockResolvedValueOnce({
					rows: mockBusinessRows
				} as QueryResult);

				mockPaginate.mockReturnValue({
					totalPages: 1,
					totalItems: 2
				});

				mockGetReportStatusForBusiness.mockResolvedValue(mockReportStatus);

				const query = {
					sort: { "db.name": "ASC" }
				};
				await relatedBusinesses.getRelatedBusinesses(defaultParams, query);

				expect(mockSqlQuery).toHaveBeenNthCalledWith(2, {
					sql: expect.stringContaining("ORDER BY db.name ASC"),
					values: [mockIds.tin, mockIds.businessID, mockIds.customerID]
				});
			});

			it("should ignore invalid sort parameters and use default sorting", async () => {
				const mockIds = createMockIds();
				const defaultParams = createDefaultParams();
				const mockBusinessRows = createMockBusinessRows();
				const mockReportStatus = createMockReportStatus();

				mockSqlQuery.mockResolvedValueOnce({
					rows: [{ count: "2" }]
				} as QueryResult);

				mockSqlQuery.mockResolvedValueOnce({
					rows: mockBusinessRows
				} as QueryResult);

				mockPaginate.mockReturnValue({
					totalPages: 1,
					totalItems: 2
				});

				mockGetReportStatusForBusiness.mockResolvedValue(mockReportStatus);

				const query = {
					sort: { "invalid.field": "ASC" }
				};
				await relatedBusinesses.getRelatedBusinesses(defaultParams, query);

				// Should fall back to default sorting
				expect(mockSqlQuery).toHaveBeenNthCalledWith(2, {
					sql: expect.stringContaining("ORDER BY db.created_at DESC"),
					values: [mockIds.tin, mockIds.businessID, mockIds.customerID]
				});
			});

			it("should work without customerID", async () => {
				const mockIds = createMockIds();
				const mockBusinessRows = createMockBusinessRows();
				const mockReportStatus = createMockReportStatus();

				const paramsWithoutCustomer = {
					businessID: mockIds.businessID,
					customerID: null as unknown as UUID
				};

				mockSqlQuery.mockResolvedValueOnce({
					rows: [{ count: "2" }]
				} as QueryResult);

				mockSqlQuery.mockResolvedValueOnce({
					rows: mockBusinessRows
				} as QueryResult);

				mockPaginate.mockReturnValue({
					totalPages: 1,
					totalItems: 2
				});

				mockGetReportStatusForBusiness.mockResolvedValue(mockReportStatus);

				const query = {};
				await relatedBusinesses.getRelatedBusinesses(paramsWithoutCustomer, query);

				// Should not include customer filter in queries
				expect(mockSqlQuery).toHaveBeenNthCalledWith(1, {
					sql: expect.not.stringContaining("AND dc.customer_id = $3"),
					values: [mockIds.tin, mockIds.businessID]
				});

				expect(mockSqlQuery).toHaveBeenNthCalledWith(2, {
					sql: expect.not.stringContaining("AND dc.customer_id IS NOT NULL"),
					values: [mockIds.tin, mockIds.businessID]
				});
			});
		});

		describe("empty result scenarios", () => {
			it("should return empty result when no related businesses found", async () => {
				const defaultParams = createDefaultParams();

				mockSqlQuery.mockResolvedValueOnce({
					rows: [{ count: "0" }]
				} as QueryResult);

				const query = {};
				const result = await relatedBusinesses.getRelatedBusinesses(defaultParams, query);

				expect(result).toEqual({
					records: [],
					total_pages: 0,
					total_items: 0
				});

				// Should not execute the businesses query when count is 0
				expect(mockSqlQuery).toHaveBeenCalledTimes(1);
			});
		});

		describe("error scenarios", () => {
			it("should throw error when page requested is out of range", async () => {
				const mockIds = createMockIds();
				const defaultParams = createDefaultParams();

				// Mock count query first
				mockSqlQuery.mockResolvedValueOnce({
					rows: [{ count: "10" }]
				} as QueryResult);

				mockPaginate.mockReturnValue({
					totalPages: 2,
					totalItems: 10
				});

				const query = {
					page: 5, // Page beyond total pages
					items_per_page: 5
				};

				await expect(relatedBusinesses.getRelatedBusinesses(defaultParams, query)).rejects.toThrow(
					CaseManagementApiError
				);

				// Reset mocks and test again for the specific error message
				jest.clearAllMocks();
				mockBusinesses.getBusinessByID.mockResolvedValue({
					tin: mockIds.tin
				} as GetBusinessByIDResult);
				mockSqlQuery.mockResolvedValueOnce({
					rows: [{ count: "10" }]
				} as QueryResult);
				mockPaginate.mockReturnValue({
					totalPages: 2,
					totalItems: 10
				});

				await expect(relatedBusinesses.getRelatedBusinesses(defaultParams, query)).rejects.toThrow(
					"Page Requested is Out of Max Page Range"
				);
			});

			it("should allow page 1 when total pages is 0", async () => {
				const defaultParams = createDefaultParams();

				mockSqlQuery.mockResolvedValueOnce({
					rows: [{ count: "0" }]
				} as QueryResult);

				const query = {
					page: 1
				};

				const result = await relatedBusinesses.getRelatedBusinesses(defaultParams, query);

				expect(result).toEqual({
					records: [],
					total_pages: 0,
					total_items: 0
				});
			});

			it("should handle database errors gracefully", async () => {
				const defaultParams = createDefaultParams();
				const dbError = new Error("Database connection failed");
				mockSqlQuery.mockRejectedValue(dbError);

				const query = {};

				await expect(relatedBusinesses.getRelatedBusinesses(defaultParams, query)).rejects.toThrow(
					"Database connection failed"
				);
			});

			it("should handle businesses.getBusinessByID errors", async () => {
				const defaultParams = createDefaultParams();
				const businessError = new Error("Business not found");
				mockBusinesses.getBusinessByID.mockRejectedValue(businessError);

				const query = {};

				await expect(relatedBusinesses.getRelatedBusinesses(defaultParams, query)).rejects.toThrow(
					"Business not found"
				);
			});
		});
	});

	describe("_enrichBusinessReportStatus", () => {
		it("should enrich business data with report status", async () => {
			const mockIds = createMockIds();

			const inputBusinesses = [
				{
					id: "111e4567-e89b-12d3-a456-426614174001",
					name: "Test Business 1",
					case_status: "APPROVED"
				},
				{
					id: "222e4567-e89b-12d3-a456-426614174002",
					name: "Test Business 2",
					case_status: "PENDING"
				}
			];

			const mockReportStatus = [
				{
					id: "111e4567-e89b-12d3-a456-426614174001",
					status: "completed",
					report_id: "report1",
					created_at: "2025-01-01T01:00:00Z"
				}
			];

			mockGetReportStatusForBusiness.mockResolvedValue(mockReportStatus);

			const result = await relatedBusinesses._enrichBusinessReportStatus(inputBusinesses, mockIds.customerID);

			expect(mockGetReportStatusForBusiness).toHaveBeenCalledWith(
				[
					{ id: inputBusinesses[0].id, status: inputBusinesses[0].case_status },
					{ id: inputBusinesses[1].id, status: inputBusinesses[1].case_status }
				],
				mockIds.customerID
			);

			expect(result).toEqual([
				{
					id: "111e4567-e89b-12d3-a456-426614174001",
					name: "Test Business 1",
					case_status: "APPROVED",
					report_status: "completed",
					report_id: "report1",
					report_created_at: "2025-01-01T01:00:00Z"
				},
				{
					id: "222e4567-e89b-12d3-a456-426614174002",
					name: "Test Business 2",
					case_status: "PENDING",
					report_status: null,
					report_id: null,
					report_created_at: null
				}
			]);
		});

		it("should handle empty business list", async () => {
			const mockIds = createMockIds();

			mockGetReportStatusForBusiness.mockResolvedValue([]);

			const result = await relatedBusinesses._enrichBusinessReportStatus([], mockIds.customerID);

			expect(result).toEqual([]);
			expect(mockGetReportStatusForBusiness).toHaveBeenCalledWith([], mockIds.customerID);
		});

		it("should filter out businesses without id or status", async () => {
			const mockIds = createMockIds();

			const inputBusinesses = [
				{
					id: "111e4567-e89b-12d3-a456-426614174001",
					name: "Test Business 1",
					case_status: "APPROVED"
				},
				{
					id: null,
					name: "Test Business 2",
					case_status: "PENDING"
				},
				{
					id: "333e4567-e89b-12d3-a456-426614174003",
					name: "Test Business 3",
					case_status: null
				}
			];

			mockGetReportStatusForBusiness.mockResolvedValue([]);

			const result = await relatedBusinesses._enrichBusinessReportStatus(inputBusinesses, mockIds.customerID);

			expect(mockGetReportStatusForBusiness).toHaveBeenCalledWith(
				[{ id: inputBusinesses[0].id, status: inputBusinesses[0].case_status }],
				mockIds.customerID
			);

			expect(result).toHaveLength(3);
			expect(result[0]).toHaveProperty("report_status", null);
			expect(result[1]).toHaveProperty("report_status", null);
			expect(result[2]).toHaveProperty("report_status", null);
		});
	});
});
