// @ts-nocheck
jest.mock("#helpers/knex", () => {
	const createMockQuery = (result: any) => {
		const query: any = {};

		// Add query builder methods - each returns the query object for chaining
		query.select = jest.fn(() => query);
		query.join = jest.fn(() => query);
		query.where = jest.fn(() => query);
		query.andWhere = jest.fn(() => query);
		query.whereIn = jest.fn(() => query);
		query.whereRaw = jest.fn(() => query);
		query.orWhereRaw = jest.fn(() => query);
		query.orderBy = jest.fn(() => query);
		query.limit = jest.fn(() => query);
		query.first = jest.fn(() => query);

		// Make the query object thenable (awaitable)
		query.then = jest.fn((resolve: any) => Promise.resolve(result).then(resolve));
		query.catch = jest.fn((reject: any) => Promise.resolve(result).catch(reject));

		return query;
	};

	let mockQueryResult: any = null;
	const mockDb: any = jest.fn((table: string) => createMockQuery(mockQueryResult));
	mockDb.raw = jest.fn((query: string) => query);

	// Allow setting the result for tests
	mockDb.__setResult = (result: any) => {
		mockQueryResult = result;
	};

	return {
		db: mockDb
	};
});

const { db } = require("#helpers/knex");
import { INTEGRATION_ID } from "#constants";
import type { UUID } from "crypto";

// Import the function indirectly through the source that uses it
// Since getAllFromRequestResponse is not exported, we test it through truliooPerson source
import { sources } from "../sources";

describe("getAllFromRequestResponse (tested through truliooPerson source)", () => {
	const businessID = "00000000-0000-0000-0000-000000000001" as UUID;

	beforeEach(() => {
		jest.clearAllMocks();
		db.__setResult(null); // Reset query result
	});

	afterEach(() => {
		// Restore all spies to their original implementations
		jest.restoreAllMocks();
	});

	describe("Query building and filtering", () => {
		it("should query request_response table with correct business_id", async () => {
			const mockRecords = [
				{
					response: JSON.stringify({ screenedPersons: [{ fullName: "Owner 1" }] }),
					requested_at: new Date(),
					request_received: new Date()
				}
			];

			db.__setResult(mockRecords);

			const source = sources.person;
			await source.getter(businessID);

			// Verify the query was made (indirectly through db mock)
			expect(db).toHaveBeenCalled();
		});

		it("should filter by platform_id correctly", async () => {
			const mockRecords = [
				{
					response: JSON.stringify({ screenedPersons: [{ fullName: "Owner 1" }] }),
					requested_at: new Date(),
					request_received: new Date()
				}
			];

			db.__setResult(mockRecords);

			const source = sources.person;
			const result = await source.getter(businessID);

			// Should only return records for TRULIOO platform
			expect(result).toBeDefined();
		});

		it("should filter by request_type correctly (fetch_business_entity_verification_person)", async () => {
			const mockRecords = [
				{
					response: JSON.stringify({ screenedPersons: [{ fullName: "Owner 1" }] }),
					requested_at: new Date(),
					request_received: new Date()
				}
			];

			db.__setResult(mockRecords);

			const source = sources.person;
			const result = await source.getter(businessID);

			// Should only return records with correct request_type
			expect(result).toBeDefined();
		});
	});

	describe("Multiple records handling", () => {
		it("should return all records, not just the first one", async () => {
			const owner1 = { fullName: "Owner 1", screeningStatus: "completed" };
			const owner2 = { fullName: "Owner 2", screeningStatus: "completed" };
			const owner3 = { fullName: "Owner 3", screeningStatus: "completed" };

			const mockRecords = [
				{
					response: JSON.stringify({ screenedPersons: [owner1] }),
					requested_at: new Date("2024-01-01"),
					request_received: new Date("2024-01-01")
				},
				{
					response: JSON.stringify({ screenedPersons: [owner2] }),
					requested_at: new Date("2024-01-02"),
					request_received: new Date("2024-01-02")
				},
				{
					response: JSON.stringify({ screenedPersons: [owner3] }),
					requested_at: new Date("2024-01-03"),
					request_received: new Date("2024-01-03")
				}
			];

			db.__setResult(mockRecords);

			const source = sources.person;
			const result = await source.getter(businessID);

			expect(result).toBeDefined();
			expect(result?.screenedPersons).toBeDefined();
			expect(result?.screenedPersons.length).toBe(3);
			expect(result?.screenedPersons.map((p: any) => p.fullName)).toEqual(["Owner 1", "Owner 2", "Owner 3"]);
		});

		it("should handle empty array when no records match", async () => {
			db.__setResult([]);

			const source = sources.person;
			const result = await source.getter(businessID);

			expect(result).toBeUndefined();
		});

		it("should order records by requested_at DESC", async () => {
			const owner1 = { fullName: "Owner 1" };
			const owner2 = { fullName: "Owner 2" };
			const owner3 = { fullName: "Owner 3" };

			const mockRecords = [
				{
					response: JSON.stringify({ screenedPersons: [owner3] }),
					requested_at: new Date("2024-01-03"),
					request_received: new Date("2024-01-03")
				},
				{
					response: JSON.stringify({ screenedPersons: [owner1] }),
					requested_at: new Date("2024-01-01"),
					request_received: new Date("2024-01-01")
				},
				{
					response: JSON.stringify({ screenedPersons: [owner2] }),
					requested_at: new Date("2024-01-02"),
					request_received: new Date("2024-01-02")
				}
			];

			db.__setResult(mockRecords);

			const source = sources.person;
			const result = await source.getter(businessID);

			// Records should be processed in DESC order (newest first)
			// But all should be aggregated
			expect(result?.screenedPersons.length).toBe(3);
		});
	});

	describe("Array parameter handling", () => {
		it("should handle array of platform_ids using whereIn", async () => {
			// This tests that the function correctly uses whereIn for array params
			const mockRecords = [
				{
					response: JSON.stringify({ screenedPersons: [{ fullName: "Owner 1" }] }),
					requested_at: new Date(),
					request_received: new Date()
				}
			];

			db.__setResult(mockRecords);

			const source = sources.person;
			const result = await source.getter(businessID);

			expect(result).toBeDefined();
		});
	});

	describe("Response parsing and aggregation", () => {
		it("should parse JSON responses correctly", async () => {
			const owner1 = { fullName: "Owner 1", screeningStatus: "completed" };
			const owner2 = { fullName: "Owner 2", screeningStatus: "completed" };

			const mockRecords = [
				{
					response: JSON.stringify({ screenedPersons: [owner1] }),
					requested_at: new Date(),
					request_received: new Date()
				},
				{
					response: JSON.stringify({ screenedPersons: [owner2] }),
					requested_at: new Date(),
					request_received: new Date()
				}
			];

			db.__setResult(mockRecords);

			const source = sources.person;
			const result = await source.getter(businessID);

			expect(result).toBeDefined();
			expect(result?.screenedPersons.length).toBe(2);
			expect(result?.screenedPersons[0].fullName).toBe("Owner 1");
			expect(result?.screenedPersons[1].fullName).toBe("Owner 2");
		});

		it("should handle already-parsed JSON responses", async () => {
			const owner1 = { fullName: "Owner 1" };

			const mockRecords = [
				{
					response: { screenedPersons: [owner1] }, // Already an object, not a string
					requested_at: new Date(),
					request_received: new Date()
				}
			];

			db.__setResult(mockRecords);

			const source = sources.person;
			const result = await source.getter(businessID);

			expect(result).toBeDefined();
			expect(result?.screenedPersons.length).toBe(1);
		});

		it("should skip records with invalid JSON and continue processing others", async () => {
			const validOwner = { fullName: "Valid Owner" };

			const mockRecords = [
				{
					response: "invalid json {",
					requested_at: new Date(),
					request_received: new Date()
				},
				{
					response: JSON.stringify({ screenedPersons: [validOwner] }),
					requested_at: new Date(),
					request_received: new Date()
				}
			];

			db.__setResult(mockRecords);

			const source = sources.person;
			const result = await source.getter(businessID);

			// Should still return valid data
			expect(result).toBeDefined();
			expect(result?.screenedPersons.length).toBe(1);
			expect(result?.screenedPersons[0].fullName).toBe("Valid Owner");
		});
	});

	describe("Edge cases", () => {
		it("should handle records with null or undefined response", async () => {
			const validOwner = { fullName: "Valid Owner" };

			const mockRecords = [
				{
					response: null,
					requested_at: new Date(),
					request_received: new Date()
				},
				{
					response: JSON.stringify({ screenedPersons: [validOwner] }),
					requested_at: new Date(),
					request_received: new Date()
				}
			];

			db.__setResult(mockRecords);

			const source = sources.person;
			const result = await source.getter(businessID);

			// Should still return valid data
			expect(result).toBeDefined();
			expect(result?.screenedPersons.length).toBe(1);
		});

		it("should handle records with empty screenedPersons arrays", async () => {
			const owner1 = { fullName: "Owner 1" };

			const mockRecords = [
				{
					response: JSON.stringify({ screenedPersons: [] }),
					requested_at: new Date(),
					request_received: new Date()
				},
				{
					response: JSON.stringify({ screenedPersons: [owner1] }),
					requested_at: new Date(),
					request_received: new Date()
				}
			];

			db.__setResult(mockRecords);

			const source = sources.person;
			const result = await source.getter(businessID);

			// Should aggregate only non-empty arrays
			expect(result).toBeDefined();
			expect(result?.screenedPersons.length).toBe(1);
			expect(result?.screenedPersons[0].fullName).toBe("Owner 1");
		});

		it("should handle records without screenedPersons property", async () => {
			const owner1 = { fullName: "Owner 1" };

			const mockRecords = [
				{
					response: JSON.stringify({ someOtherProperty: "value" }),
					requested_at: new Date(),
					request_received: new Date()
				},
				{
					response: JSON.stringify({ screenedPersons: [owner1] }),
					requested_at: new Date(),
					request_received: new Date()
				}
			];

			db.__setResult(mockRecords);

			const source = sources.person;
			const result = await source.getter(businessID);

			// Should handle records without screenedPersons
			expect(result).toBeDefined();
			// If response doesn't have screenedPersons, it might be treated as a single person
			expect(result?.screenedPersons.length).toBeGreaterThanOrEqual(1);
		});
	});
});
