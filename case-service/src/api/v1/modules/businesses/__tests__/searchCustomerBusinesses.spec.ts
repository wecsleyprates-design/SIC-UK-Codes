jest.mock("#helpers/logger", () => ({
	logger: {
		debug: jest.fn(),
		info: jest.fn(),
		warn: jest.fn(),
		error: jest.fn()
	}
}));

import { db } from "#helpers";
import { PaginationMaxRangeError } from "#errors";
import { BusinessApiError } from "../error";
import { searchCustomerBusinesses } from "../handlers";
import { createTracker, Tracker } from "knex-mock-client";
import { SearchCustomerBusinessesRequestQuery } from "../types";

jest.mock("#helpers", () => {
	const originalModule = jest.requireActual("#helpers");
	const knex = require("knex");
	const { MockClient } = require("knex-mock-client");
	return {
		...originalModule,
		db: knex({ client: MockClient, dialect: "pg" })
	};
});

describe("searchCustomerBusinesses", () => {
	let tracker: Tracker;
	const customerID = "00000000-0000-0000-0000-000000000001";

	beforeAll(() => {
		tracker = createTracker(db);
	});

	afterEach(() => {
		jest.clearAllMocks();
		tracker.reset();
	});

	describe("when search query is provided", () => {
		it("should return businesses matching the search term by name", async () => {
			const mockRows = [
				{
					id: "business-id-1",
					name: "Empresa Teste LTDA",
					address_city: "São Paulo",
					address_state: "SP",
					address_country: "Brazil",
					case_id: "case-id-1"
				}
			];

			tracker.on.select(/COUNT.*DISTINCT/i).responseOnce([{ totalcount: "1" }]);
			tracker.on.select("data_businesses").responseOnce(mockRows);
			tracker.on.select("rel_business_customer_monitoring").responseOnce(mockRows);
			tracker.on.select("data_cases").responseOnce([{ id: "case-id-1" }]);

			const params = { customerID };
			const query = { query: "Em", limit: 10 };

			const result = await searchCustomerBusinesses(params, query);

			expect(result).toEqual({
				records: [
					{
						id: "business-id-1",
						business_id: "business-id-1",
						name: "Empresa Teste LTDA",
						location: "São Paulo, SP, Brazil",
						case_id: "case-id-1"
					}
				],
				total: 1
			});
		});

		it("should return businesses matching by business ID (UUID)", async () => {
			const businessID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
			const mockRows = [
				{
					id: businessID,
					name: "Business Name",
					address_city: "City",
					address_state: "State",
					address_country: "Country",
					case_id: null
				}
			];

			tracker.on.select(/COUNT.*DISTINCT/i).responseOnce([{ totalcount: "1" }]);
			tracker.on.select("data_businesses").responseOnce(mockRows);
			tracker.on.select("rel_business_customer_monitoring").responseOnce(mockRows);

			const params = { customerID };
			const query = { query: businessID, limit: 10 };

			const result = await searchCustomerBusinesses(params, query);

			expect(result.records).toHaveLength(1);
			expect(result.records[0].id).toBe(businessID);
			expect(result.total).toBe(1);
		});

		it("should return businesses matching by partial business ID", async () => {
			const mockRows = [
				{
					id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
					name: "Business Name",
					address_city: "City",
					address_state: "State",
					address_country: "Country",
					case_id: null
				}
			];

			tracker.on.select(/COUNT.*DISTINCT/i).responseOnce([{ totalcount: "1" }]);
			tracker.on.select("data_businesses").responseOnce(mockRows);
			tracker.on.select("rel_business_customer_monitoring").responseOnce(mockRows);

			const params = { customerID };
			const query = { query: "a1b2c3d4", limit: 10 };

			const result = await searchCustomerBusinesses(params, query);

			expect(result.records).toHaveLength(1);
			expect(result.total).toBe(1);
		});

		it("should return businesses matching by case ID", async () => {
			const caseID = "case-123-456-789";
			const mockRows = [
				{
					id: "business-id-1",
					name: "Business Name",
					address_city: "City",
					address_state: "State",
					address_country: "Country",
					case_id: caseID
				}
			];

			tracker.on.select(/COUNT.*DISTINCT/i).responseOnce([{ totalcount: "1" }]);
			tracker.on.select("data_businesses").responseOnce(mockRows);
			tracker.on.select("rel_business_customer_monitoring").responseOnce(mockRows);
			tracker.on.select("data_cases").responseOnce([{ id: caseID }]);

			const params = { customerID };
			const query = { query: caseID, limit: 10 };

			const result = await searchCustomerBusinesses(params, query);

			expect(result.records).toHaveLength(1);
			expect(result.records[0].case_id).toBe(caseID);
			expect(result.total).toBe(1);
		});

		it("should respect the limit parameter", async () => {
			const mockRows = Array.from({ length: 5 }, (_, i) => ({
				id: `business-id-${i}`,
				name: `Business ${i}`,
				address_city: "City",
				address_state: "State",
				address_country: "Country",
				case_id: null
			}));

			tracker.on.select(/COUNT.*DISTINCT/i).responseOnce([{ totalcount: "10" }]);
			tracker.on.select("data_businesses").responseOnce(mockRows);
			tracker.on.select("rel_business_customer_monitoring").responseOnce(mockRows);

			const params = { customerID };
			const query = { query: "Business", limit: 5 };

			const result = await searchCustomerBusinesses(params, query);

			expect(result.records.length).toBeLessThanOrEqual(5);
			expect(result.total).toBe(10);
		});

		it("should return empty results when no matches found", async () => {
			tracker.on.select(/COUNT.*DISTINCT/i).responseOnce([{ totalcount: "0" }]);
			tracker.on.select("data_businesses").responseOnce([]);
			tracker.on.select("rel_business_customer_monitoring").responseOnce([]);
			tracker.on.select(/COUNT.*DISTINCT/i).responseOnce([{ totalcount: "0" }]);

			const params = { customerID };
			const query = { query: "NonExistentBusiness", limit: 10 };

			const result = await searchCustomerBusinesses(params, query);

			expect(result.records).toEqual([]);
			expect(result.total).toBe(0);
		});

		it("should format location correctly when address components are missing", async () => {
			const mockRows = [
				{
					id: "business-id-1",
					name: "Business Name",
					address_city: null,
					address_state: null,
					address_country: null,
					case_id: null
				}
			];

			tracker.on.select(/COUNT.*DISTINCT/i).responseOnce([{ totalcount: "1" }]);
			tracker.on.select("data_businesses").responseOnce(mockRows);
			tracker.on.select("rel_business_customer_monitoring").responseOnce(mockRows);

			const params = { customerID };
			const query = { query: "Business", limit: 10 };

			const result = await searchCustomerBusinesses(params, query);

			expect(result.records[0].location).toBe("N/A");
		});

		it("should format location correctly with partial address components", async () => {
			const mockRows = [
				{
					id: "business-id-1",
					name: "Business Name",
					address_city: "São Paulo",
					address_state: null,
					address_country: "Brazil",
					case_id: null
				}
			];

			tracker.on.select(/COUNT.*DISTINCT/i).responseOnce([{ totalcount: "1" }]);
			tracker.on.select("data_businesses").responseOnce(mockRows);
			tracker.on.select("rel_business_customer_monitoring").responseOnce(mockRows);

			const params = { customerID };
			const query = { query: "Business", limit: 10 };

			const result = await searchCustomerBusinesses(params, query);

			expect(result.records[0].location).toBe("São Paulo, Brazil");
		});
	});

	describe("when search query is empty or not provided", () => {
		it("should return all businesses when query is empty string", async () => {
			const mockRows = [
				{
					id: "business-id-1",
					name: "Business A",
					address_city: "City",
					address_state: "State",
					address_country: "Country",
					case_id: null
				},
				{
					id: "business-id-2",
					name: "Business B",
					address_city: "City",
					address_state: "State",
					address_country: "Country",
					case_id: null
				}
			];

			tracker.on.select(/COUNT.*DISTINCT/i).responseOnce([{ totalcount: "2" }]);
			tracker.on.select("data_businesses").responseOnce(mockRows);
			tracker.on.select("rel_business_customer_monitoring").responseOnce(mockRows);

			const params = { customerID };
			const query = { query: "", limit: 10 };

			const result = await searchCustomerBusinesses(params, query);

			expect(result.records).toHaveLength(2);
			expect(result.total).toBe(2);
		});

		it("should return all businesses when query is not provided", async () => {
			const mockRows = [
				{
					id: "business-id-1",
					name: "Business A",
					address_city: "City",
					address_state: "State",
					address_country: "Country",
					case_id: null
				}
			];

			tracker.on.select(/COUNT.*DISTINCT/i).responseOnce([{ totalcount: "1" }]);
			tracker.on.select("data_businesses").responseOnce(mockRows);
			tracker.on.select("rel_business_customer_monitoring").responseOnce(mockRows);

			const params = { customerID };
			const query: SearchCustomerBusinessesRequestQuery = { limit: 10 };

			const result = await searchCustomerBusinesses(params, query);

			expect(result.records).toHaveLength(1);
			expect(result.total).toBe(1);
		});

		it("should return all businesses ordered by name when no search term", async () => {
			const mockRows = [
				{
					id: "business-id-1",
					name: "Business A",
					address_city: "City",
					address_state: "State",
					address_country: "Country",
					case_id: null
				},
				{
					id: "business-id-2",
					name: "Business B",
					address_city: "City",
					address_state: "State",
					address_country: "Country",
					case_id: null
				}
			];

			tracker.on.select("data_businesses").responseOnce(mockRows);
			tracker.on.select("rel_business_customer_monitoring").responseOnce(mockRows);
			tracker.on.select(/COUNT.*DISTINCT/i).responseOnce([{ totalcount: "2" }]);

			const params = { customerID };
			const query: SearchCustomerBusinessesRequestQuery = { limit: 10 };

			const result = await searchCustomerBusinesses(params, query);

			expect(result.records[0].name).toBe("Business A");
			expect(result.records[1].name).toBe("Business B");
		});
	});

	describe("error handling", () => {
		it("should throw DatabaseError when database query fails", async () => {
			const dbError = new Error("Database connection failed");
			tracker.on.select("data_businesses").simulateError(dbError);

			const params = { customerID };
			const query = { query: "Test", limit: 10 };

			await expect(searchCustomerBusinesses(params, query)).rejects.toThrow();
		});

		it("should rethrow BusinessApiError", async () => {
			const businessError = new BusinessApiError("Business error", 400);
			tracker.on.select("data_businesses").simulateError(businessError);

			const params = { customerID };
			const query = { query: "Test", limit: 10 };

			await expect(searchCustomerBusinesses(params, query)).rejects.toThrow(BusinessApiError);
		});

		it("should convert PaginationMaxRangeError to BusinessApiError", async () => {
			const paginationError = new PaginationMaxRangeError("Pagination error");
			tracker.on.select("data_businesses").simulateError(paginationError);

			const params = { customerID };
			const query = { query: "Test", limit: 10 };

			await expect(searchCustomerBusinesses(params, query)).rejects.toThrow(BusinessApiError);
		});
	});

	describe("default limit", () => {
		it("should use default limit of 10 when not provided", async () => {
			const mockRows = Array.from({ length: 10 }, (_, i) => ({
				id: `business-id-${i}`,
				name: `Business ${i}`,
				address_city: "City",
				address_state: "State",
				address_country: "Country",
				case_id: null
			}));

			tracker.on.select("data_businesses").responseOnce(mockRows);
			tracker.on.select("rel_business_customer_monitoring").responseOnce(mockRows);
			tracker.on.select(/COUNT.*DISTINCT/i).responseOnce([{ totalcount: "10" }]);

			const params = { customerID };
			const query = { query: "Business" };

			const result = await searchCustomerBusinesses(params, query);

			expect(result.records.length).toBeLessThanOrEqual(10);
		});
	});
});
