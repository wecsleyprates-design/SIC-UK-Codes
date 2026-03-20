/**
 * Tests for TruliooPersonSourceHelper utility class
 */

import { UUID } from "crypto";
import { db } from "#helpers/knex";
import { logger } from "#helpers/logger";
import { TruliooPersonSourceHelper } from "../truliooPersonSourceHelper";
import type { NormalizedWatchlistHit, TransformedPerson } from "../truliooPersonSourceHelper";

// Mock dependencies
jest.mock("#helpers/knex", () => {
	const createMockQuery = (result: any) => {
		const query: any = {};
		query.select = jest.fn(() => query);
		query.where = jest.fn(() => query);
		query.andWhere = jest.fn(() => query);
		query.whereIn = jest.fn(() => query);
		query.whereNotNull = jest.fn(() => query);
		query.join = jest.fn(() => query);
		query.orWhereRaw = jest.fn(() => query);
		query.whereRaw = jest.fn(() => query);
		query.orderBy = jest.fn(() => query);
		query.limit = jest.fn(() => query);
		query.first = jest.fn(() => query);
		query.then = jest.fn((resolve: any) => Promise.resolve(result).then(resolve));
		query.catch = jest.fn((reject: any) => Promise.resolve(result).catch(reject));
		return query;
	};

	let mockQueryResult: any = null;
	const mockDb: any = jest.fn((table: string) => createMockQuery(mockQueryResult));
	mockDb.raw = jest.fn((query: string) => query);
	mockDb.__setResult = (result: any) => {
		mockQueryResult = result;
	};

	return { db: mockDb };
});

jest.mock("#helpers/logger", () => ({
	logger: {
		error: jest.fn(),
		warn: jest.fn(),
		info: jest.fn(),
		debug: jest.fn()
	}
}));

jest.mock("#lib/trulioo/common/utils", () => ({
	extractWatchlistResultsFromTruliooResponse: jest.fn((response: any) => {
		// Mock implementation
		return response?.watchlistResults || [];
	}),
	convertToUUIDFormat: jest.fn((id: string) => {
		// Simple mock: pad to 32 chars and format as UUID
		if (id && id.length === 24) {
			const padded = id.padEnd(32, "0");
			return `${padded.substring(0, 8)}-${padded.substring(8, 12)}-${padded.substring(12, 16)}-${padded.substring(16, 20)}-${padded.substring(20, 32)}`;
		}
		return id;
	})
}));

describe("TruliooPersonSourceHelper", () => {
	const businessID = "00000000-0000-0000-0000-000000000001" as UUID;

	beforeEach(() => {
		jest.clearAllMocks();
		(db as any).__setResult(null);
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	describe("extractWatchlistHitsFromMetadata", () => {
		it("should extract watchlist hits from screeningResults.watchlistHits", () => {
			const meta = {
				screeningResults: {
					watchlistHits: [
						{
							listType: "SANCTIONS",
							listName: "OFAC SDN List",
							matchDetails: "Test Person",
							confidence: 0.9
						}
					]
				}
			};

			const result = TruliooPersonSourceHelper.extractWatchlistHitsFromMetadata(meta);

			expect(result).toHaveLength(1);
			expect(result[0].listType).toBe("SANCTIONS");
			expect(result[0].listName).toBe("OFAC SDN List");
		});

		it("should extract watchlist hits from watchlistResults", () => {
			const meta = {
				watchlistResults: [
					{
						listType: "PEP",
						listName: "PEP List",
						matchDetails: "Test Person"
					}
				]
			};

			const result = TruliooPersonSourceHelper.extractWatchlistHitsFromMetadata(meta);

			expect(result).toHaveLength(1);
			expect(result[0].listType).toBe("PEP");
		});

		it("should transform sources array to normalized format", () => {
			const meta = {
				sources: [
					{
						type: "watchlist_result",
						listType: "SANCTIONS",
						listName: "OFAC",
						metadata: { title: "OFAC SDN List", agency: "US Treasury" },
						matchDetails: "Test Person", // matchDetails should be at top level
						score: 0.8
					}
				]
			};

			const result = TruliooPersonSourceHelper.extractWatchlistHitsFromMetadata(meta);

			expect(result).toHaveLength(1);
			expect(result[0].listType).toBe("SANCTIONS");
			// listName should prefer listName over metadata.title
			expect(result[0].listName).toBe("OFAC");
			expect(result[0].sourceAgencyName).toBe("US Treasury");
			expect(result[0].matchDetails).toBe("Test Person");
			expect(result[0].confidence).toBe(0.8);
		});

		it("should return empty array when no watchlist data exists", () => {
			const meta = {};

			const result = TruliooPersonSourceHelper.extractWatchlistHitsFromMetadata(meta);

			expect(result).toEqual([]);
		});

		it("should prefer screeningResults.watchlistHits over watchlistResults", () => {
			const meta = {
				screeningResults: {
					watchlistHits: [{ listType: "SANCTIONS", listName: "From Screening" }]
				},
				watchlistResults: [{ listType: "PEP", listName: "From Results" }]
			};

			const result = TruliooPersonSourceHelper.extractWatchlistHitsFromMetadata(meta);

			expect(result).toHaveLength(1);
			expect(result[0].listName).toBe("From Screening");
		});
	});

	describe("normalizeWatchlistHits", () => {
		it("should normalize watchlist hits array", () => {
			const hits = [
				{
					listType: "SANCTIONS",
					listName: "OFAC",
					sourceAgencyName: "US Treasury",
					listCountry: "US",
					url: "https://example.com",
					matchDetails: "Test Person",
					confidence: 0.9
				}
			];

			const result = TruliooPersonSourceHelper.normalizeWatchlistHits(hits);

			expect(result).toHaveLength(1);
			expect(result[0]).toEqual({
				listType: "SANCTIONS",
				listName: "OFAC",
				sourceAgencyName: "US Treasury",
				listCountry: "US",
				url: "https://example.com",
				matchDetails: "Test Person",
				confidence: 0.9
			});
		});

		it("should handle missing fields with defaults", () => {
			const hits = [{ listType: "SANCTIONS" }];

			const result = TruliooPersonSourceHelper.normalizeWatchlistHits(hits);

			expect(result).toHaveLength(1);
			expect(result[0].listName).toBe("");
			expect(result[0].listType).toBe("SANCTIONS");
		});

		it("should return empty array for null/undefined", () => {
			expect(TruliooPersonSourceHelper.normalizeWatchlistHits(null)).toEqual([]);
			expect(TruliooPersonSourceHelper.normalizeWatchlistHits(undefined)).toEqual([]);
		});

		it("should return empty array for non-array input", () => {
			expect(TruliooPersonSourceHelper.normalizeWatchlistHits({} as any)).toEqual([]);
		});
	});

	describe("transformPersonResponse", () => {
		it("should transform person response with all fields", () => {
			const response = {
				firstName: "John",
				lastName: "Doe",
				screenedAt: "2024-01-15T10:00:00Z"
			};

			const watchlistHits: NormalizedWatchlistHit[] = [
				{
					listType: "SANCTIONS",
					listName: "OFAC",
					confidence: 0.9
				}
			];

			const result = TruliooPersonSourceHelper.transformPersonResponse(
				response,
				"John Doe",
				"John",
				"Doe",
				watchlistHits
			);

			expect(result.fullName).toBe("John Doe");
			expect(result.firstName).toBe("John");
			expect(result.lastName).toBe("Doe");
			expect(result.screeningResults.watchlistHits).toEqual(watchlistHits);
			expect(result.screeningResults.provider).toBe("");
			expect(result.screeningResults.screenedAt).toBe("2024-01-15T10:00:00Z");
		});

		it("should use response fields as fallback", () => {
			const response = {
				fullName: "Jane Smith",
				firstName: "Jane",
				lastName: "Smith"
			};

			const result = TruliooPersonSourceHelper.transformPersonResponse(response);

			expect(result.fullName).toBe("Jane Smith");
			expect(result.firstName).toBe("Jane");
			expect(result.lastName).toBe("Smith");
		});

		it("should preserve existing screeningResults fields", () => {
			const response = {
				screeningResults: {
					screeningStatus: "completed",
					customField: "value"
				}
			};

			const result = TruliooPersonSourceHelper.transformPersonResponse(response, undefined, undefined, undefined, []);

			expect(result.screeningResults.screeningStatus).toBe("completed");
			expect(result.screeningResults.customField).toBe("value");
			expect(result.screeningResults.watchlistHits).toEqual([]);
		});

		it("should generate screenedAt if not provided", () => {
			const response = {};

			const result = TruliooPersonSourceHelper.transformPersonResponse(response);

			expect(result.screeningResults.screenedAt).toBeDefined();
			expect(typeof result.screeningResults.screenedAt).toBe("string");
		});
	});

	describe("calculatePersonScreeningConfidence", () => {
		it("should return base confidence for having screened persons", () => {
			const persons: TransformedPerson[] = [
				{
					fullName: "Test Person",
					screeningResults: {
						watchlistHits: [],
						provider: "trulioo",
						screenedAt: new Date().toISOString()
					}
				}
			];

			const result = TruliooPersonSourceHelper.calculatePersonScreeningConfidence(persons);

			expect(result).toBeGreaterThanOrEqual(0.6);
			expect(result).toBeLessThanOrEqual(0.95);
		});

		it("should increase confidence for completed screenings", () => {
			const persons: TransformedPerson[] = [
				{
					fullName: "Test Person",
					screeningStatus: "completed",
					screeningResults: {
						watchlistHits: [],
						provider: "trulioo",
						screenedAt: new Date().toISOString()
					}
				}
			];

			const result = TruliooPersonSourceHelper.calculatePersonScreeningConfidence(persons);

			expect(result).toBeGreaterThan(0.6);
		});

		it("should increase confidence for having screening results", () => {
			const persons: TransformedPerson[] = [
				{
					fullName: "Test Person",
					screeningResults: {
						watchlistHits: [
							{
								listType: "SANCTIONS",
								listName: "OFAC",
								confidence: 0.9
							}
						],
						provider: "trulioo",
						screenedAt: new Date().toISOString()
					}
				}
			];

			const result = TruliooPersonSourceHelper.calculatePersonScreeningConfidence(persons);

			expect(result).toBeGreaterThan(0.6);
		});

		it("should cap confidence at 0.95", () => {
			const persons: TransformedPerson[] = [
				{
					fullName: "Test Person",
					screeningStatus: "completed",
					screeningResults: {
						watchlistHits: [
							{ listType: "SANCTIONS", listName: "OFAC", confidence: 0.9 },
							{ listType: "PEP", listName: "PEP List", confidence: 0.8 }
						],
						screeningStatus: "completed",
						provider: "trulioo",
						screenedAt: new Date().toISOString()
					}
				}
			];

			const result = TruliooPersonSourceHelper.calculatePersonScreeningConfidence(persons);

			expect(result).toBeLessThanOrEqual(0.95);
		});

		it("should return lower confidence for empty array", () => {
			const result = TruliooPersonSourceHelper.calculatePersonScreeningConfidence([]);

			expect(result).toBe(0.3);
		});

		it("should handle partial completion rate", () => {
			const persons: TransformedPerson[] = [
				{
					fullName: "Person 1",
					screeningStatus: "completed",
					screeningResults: {
						watchlistHits: [],
						provider: "trulioo",
						screenedAt: new Date().toISOString()
					}
				},
				{
					fullName: "Person 2",
					screeningStatus: "pending",
					screeningResults: {
						watchlistHits: [],
						provider: "trulioo",
						screenedAt: new Date().toISOString()
					}
				}
			];

			const result = TruliooPersonSourceHelper.calculatePersonScreeningConfidence(persons);

			// Should be between base (0.6) and full completion (0.8)
			expect(result).toBeGreaterThan(0.6);
			expect(result).toBeLessThan(0.8);
		});
	});

	describe("loadScreenedPersonsFromPeopleTable", () => {
		it("should load screened persons from people table", async () => {
			const mockPeopleRows = [
				{
					name: "John Doe",
					metadata: JSON.stringify({
						screeningResults: {
							watchlistHits: [
								{
									listType: "SANCTIONS",
									listName: "OFAC",
									confidence: 0.9
								}
							]
						},
						screenedAt: "2024-01-15T10:00:00Z"
					})
				}
			];

			(db as any).mockImplementation((table: string) => {
				if (table === "integration_data.business_entity_people") {
					const queryObj: any = {
						select: jest.fn(() => queryObj),
						join: jest.fn(() => queryObj),
						where: jest.fn(() => queryObj),
						then: jest.fn((resolve: any) => Promise.resolve(mockPeopleRows).then(resolve))
					};
					return queryObj;
				}
				return {
					select: jest.fn().mockReturnThis(),
					where: jest.fn().mockReturnThis()
				};
			});

			const result = await TruliooPersonSourceHelper.loadScreenedPersonsFromPeopleTable(businessID);

			expect(result).not.toBeNull();
			expect(result?.screenedPersons).toHaveLength(1);
			expect(result?.screenedPersons[0].fullName).toBe("John Doe");
			expect(result?.screenedPersons[0].screeningResults.watchlistHits).toHaveLength(1);
			expect(result?.confidence).toBe(0.7);
		});

		it("should return null when no people found", async () => {
			(db as any).mockImplementation((table: string) => {
				if (table === "integration_data.business_entity_people") {
					const queryObj: any = {
						select: jest.fn(() => queryObj),
						join: jest.fn(() => queryObj),
						where: jest.fn(() => queryObj),
						then: jest.fn((resolve: any) => Promise.resolve([]).then(resolve))
					};
					return queryObj;
				}
				return {
					select: jest.fn().mockReturnThis(),
					where: jest.fn().mockReturnThis()
				};
			});

			const result = await TruliooPersonSourceHelper.loadScreenedPersonsFromPeopleTable(businessID);

			expect(result).toBeNull();
		});

		it("should deduplicate by name", async () => {
			const mockPeopleRows = [
				{
					name: "John Doe",
					metadata: JSON.stringify({
						screeningResults: { watchlistHits: [] }
					})
				},
				{
					name: "John Doe", // Duplicate
					metadata: JSON.stringify({
						screeningResults: { watchlistHits: [] }
					})
				}
			];

			(db as any).mockImplementation((table: string) => {
				if (table === "integration_data.business_entity_people") {
					const queryObj: any = {
						select: jest.fn(() => queryObj),
						join: jest.fn(() => queryObj),
						where: jest.fn(() => queryObj),
						then: jest.fn((resolve: any) => Promise.resolve(mockPeopleRows).then(resolve))
					};
					return queryObj;
				}
				return {
					select: jest.fn().mockReturnThis(),
					where: jest.fn().mockReturnThis()
				};
			});

			const result = await TruliooPersonSourceHelper.loadScreenedPersonsFromPeopleTable(businessID);

			expect(result?.screenedPersons).toHaveLength(1);
		});

		it("should handle missing metadata gracefully", async () => {
			const mockPeopleRows = [
				{
					name: "John Doe"
					// No metadata
				},
				{
					name: "Jane Smith",
					metadata: JSON.stringify({
						screeningResults: { watchlistHits: [] }
					})
				}
			];

			(db as any).mockImplementation((table: string) => {
				if (table === "integration_data.business_entity_people") {
					const queryObj: any = {
						select: jest.fn(() => queryObj),
						join: jest.fn(() => queryObj),
						where: jest.fn(() => queryObj),
						then: jest.fn((resolve: any) => Promise.resolve(mockPeopleRows).then(resolve))
					};
					return queryObj;
				}
				return {
					select: jest.fn().mockReturnThis(),
					where: jest.fn().mockReturnThis()
				};
			});

			const result = await TruliooPersonSourceHelper.loadScreenedPersonsFromPeopleTable(businessID);

			expect(result?.screenedPersons).toHaveLength(1);
			expect(result?.screenedPersons[0].fullName).toBe("Jane Smith");
		});
	});

	describe("extractPersonNameFromPeopleTable", () => {
		it("should extract person name from people table", async () => {
			const mockPersonRecord = {
				name: "John Doe",
				metadata: JSON.stringify({
					personData: {
						firstName: "John",
						lastName: "Doe"
					}
				})
			};

			(db as any).mockImplementation((table: string) => {
				if (table === "integration_data.business_entity_people") {
					const queryObj: any = {
						select: jest.fn(() => queryObj),
						join: jest.fn(() => queryObj),
						where: jest.fn(() => queryObj),
						// andWhere now receives a callback that creates nested OR conditions
						andWhere: jest.fn((callback: Function) => {
							// Execute the callback with a mock inner query
							const innerQuery: any = {
								whereRaw: jest.fn(() => innerQuery),
								orWhereRaw: jest.fn(() => innerQuery)
							};
							callback.call(innerQuery);
							return queryObj;
						}),
						first: jest.fn(() => Promise.resolve(mockPersonRecord))
					};
					return queryObj;
				}
				return {
					select: jest.fn().mockReturnThis(),
					where: jest.fn().mockReturnThis()
				};
			});

			const result = await TruliooPersonSourceHelper.extractPersonNameFromPeopleTable(businessID, "test-id-123");

			expect(result).not.toBeNull();
			expect(result?.name).toBe("John Doe");
			expect(result?.firstName).toBe("John");
			expect(result?.lastName).toBe("Doe");
		});

		it("should return null when person not found", async () => {
			(db as any).mockImplementation((table: string) => {
				if (table === "integration_data.business_entity_people") {
					const queryObj: any = {
						select: jest.fn(() => queryObj),
						join: jest.fn(() => queryObj),
						where: jest.fn(() => queryObj),
						andWhere: jest.fn((callback: Function) => {
							const innerQuery: any = {
								whereRaw: jest.fn(() => innerQuery),
								orWhereRaw: jest.fn(() => innerQuery)
							};
							callback.call(innerQuery);
							return queryObj;
						}),
						first: jest.fn(() => Promise.resolve(null))
					};
					return queryObj;
				}
				return {
					select: jest.fn().mockReturnThis(),
					where: jest.fn().mockReturnThis()
				};
			});

			const result = await TruliooPersonSourceHelper.extractPersonNameFromPeopleTable(businessID, "non-existent-id");

			expect(result).toBeNull();
		});

		it("should handle metadata parsing errors gracefully", async () => {
			const mockPersonRecord = {
				name: "John Doe",
				metadata: "invalid-json"
			};

			(db as any).mockImplementation((table: string) => {
				if (table === "integration_data.business_entity_people") {
					const queryObj: any = {
						select: jest.fn(() => queryObj),
						join: jest.fn(() => queryObj),
						where: jest.fn(() => queryObj),
						andWhere: jest.fn((callback: Function) => {
							const innerQuery: any = {
								whereRaw: jest.fn(() => innerQuery),
								orWhereRaw: jest.fn(() => innerQuery)
							};
							callback.call(innerQuery);
							return queryObj;
						}),
						first: jest.fn(() => Promise.resolve(mockPersonRecord))
					};
					return queryObj;
				}
				return {
					select: jest.fn().mockReturnThis(),
					where: jest.fn().mockReturnThis()
				};
			});

			const result = await TruliooPersonSourceHelper.extractPersonNameFromPeopleTable(businessID, "test-id");

			expect(result).not.toBeNull();
			expect(result?.name).toBe("John Doe");
			// firstName/lastName should be undefined due to parsing error
		});

		it("should handle database errors gracefully", async () => {
			(db as any).mockImplementation((table: string) => {
				if (table === "integration_data.business_entity_people") {
					const queryObj: any = {
						select: jest.fn(() => queryObj),
						join: jest.fn(() => queryObj),
						where: jest.fn(() => queryObj),
						andWhere: jest.fn(() => {
							throw new Error("Database error");
						})
					};
					return queryObj;
				}
				return {
					select: jest.fn().mockReturnThis(),
					where: jest.fn().mockReturnThis()
				};
			});

			const result = await TruliooPersonSourceHelper.extractPersonNameFromPeopleTable(businessID, "test-id");

			expect(result).toBeNull();
			expect(logger.debug).toHaveBeenCalled();
		});
	});

	/**
	 * SQL Precedence Tests
	 *
	 * These tests verify that OR conditions are properly grouped with AND conditions
	 * to prevent cross-business data leakage.
	 *
	 * BUG CONTEXT: Prior to the fix, queries like:
	 *   .where("business_id", X)
	 *   .whereRaw("source LIKE ?", [Y])
	 *   .orWhereRaw("source LIKE ?", [Z])
	 *
	 * Generated SQL: WHERE business_id = X AND source LIKE Y OR source LIKE Z
	 * Which is interpreted as: (business_id = X AND source LIKE Y) OR (source LIKE Z)
	 *
	 * This allowed records from ANY business to be returned if they matched Z,
	 * causing duplication issues in the UI.
	 *
	 * FIX: Use .andWhere(function() { this.whereRaw(...).orWhereRaw(...) })
	 * Which generates: WHERE business_id = X AND (source LIKE Y OR source LIKE Z)
	 */
	describe("SQL Precedence - OR condition grouping", () => {
		it("should call andWhere with callback to group OR conditions in extractPersonNameFromPeopleTable", async () => {
			const externalId = "698496f43b00005e00cbc894";
			let andWhereCallback: Function | undefined;

			// Create a mock that captures the andWhere callback
			const mockQuery: any = {
				select: jest.fn(() => mockQuery),
				join: jest.fn(() => mockQuery),
				where: jest.fn(() => mockQuery),
				andWhere: jest.fn((callback: Function) => {
					andWhereCallback = callback;
					return mockQuery;
				}),
				first: jest.fn(() => Promise.resolve(null))
			};

			(db as any).mockImplementation(() => mockQuery);

			await TruliooPersonSourceHelper.extractPersonNameFromPeopleTable(businessID, externalId);

			// Verify andWhere was called (this is the fix - using andWhere with callback)
			expect(mockQuery.andWhere).toHaveBeenCalled();
			expect(andWhereCallback).toBeDefined();

			// Verify the callback structure when executed creates the correct nested query
			const innerQuery: any = {
				whereRaw: jest.fn(() => innerQuery),
				orWhereRaw: jest.fn(() => innerQuery)
			};
			(andWhereCallback as Function).call(innerQuery);

			// Verify both whereRaw and orWhereRaw are called inside the callback
			expect(innerQuery.whereRaw).toHaveBeenCalledWith(
				"integration_data.business_entity_people.source::text LIKE ?",
				[`%${externalId}%`]
			);
			expect(innerQuery.orWhereRaw).toHaveBeenCalled();
		});

		it("should call andWhere with callback to group OR conditions in extractWatchlistResultsFromPeopleTable", async () => {
			const inquiryId = "698496f43b00005e00cbc894";
			let andWhereCallback: Function | undefined;

			const mockQuery: any = {
				select: jest.fn(() => mockQuery),
				join: jest.fn(() => mockQuery),
				where: jest.fn(() => mockQuery),
				andWhere: jest.fn((callback: Function) => {
					andWhereCallback = callback;
					return mockQuery;
				}),
				then: jest.fn((resolve: any) => Promise.resolve([]).then(resolve))
			};

			(db as any).mockImplementation(() => mockQuery);

			await TruliooPersonSourceHelper.extractWatchlistResultsFromPeopleTable(businessID, inquiryId);

			// Verify andWhere was called with a callback
			expect(mockQuery.andWhere).toHaveBeenCalled();
			expect(andWhereCallback).toBeDefined();

			// Verify the callback creates proper grouping
			const innerQuery: any = {
				whereRaw: jest.fn(() => innerQuery),
				orWhereRaw: jest.fn(() => innerQuery)
			};
			(andWhereCallback as Function).call(innerQuery);

			expect(innerQuery.whereRaw).toHaveBeenCalledWith(
				"integration_data.business_entity_people.source::text LIKE ?",
				[`%${inquiryId}%`]
			);
			expect(innerQuery.orWhereRaw).toHaveBeenCalled();
		});

		it("should NOT use top-level orWhereRaw (which would break SQL precedence)", async () => {
			const externalId = "test-external-id";

			const mockQuery: any = {
				select: jest.fn(() => mockQuery),
				join: jest.fn(() => mockQuery),
				where: jest.fn(() => mockQuery),
				andWhere: jest.fn(() => mockQuery),
				whereRaw: jest.fn(() => mockQuery),
				orWhereRaw: jest.fn(() => mockQuery), // This should NOT be called at top level
				first: jest.fn(() => Promise.resolve(null))
			};

			(db as any).mockImplementation(() => mockQuery);

			await TruliooPersonSourceHelper.extractPersonNameFromPeopleTable(businessID, externalId);

			// The top-level orWhereRaw should NOT be called directly on the query
			// It should only be called inside the andWhere callback
			expect(mockQuery.orWhereRaw).not.toHaveBeenCalled();
		});

		it("should ensure business_id filter is always applied before OR conditions", async () => {
			const externalId = "test-external-id";
			const callOrder: string[] = [];

			const mockQuery: any = {
				select: jest.fn(() => {
					callOrder.push("select");
					return mockQuery;
				}),
				join: jest.fn(() => {
					callOrder.push("join");
					return mockQuery;
				}),
				where: jest.fn(() => {
					callOrder.push("where");
					return mockQuery;
				}),
				andWhere: jest.fn(() => {
					callOrder.push("andWhere");
					return mockQuery;
				}),
				first: jest.fn(() => Promise.resolve(null))
			};

			(db as any).mockImplementation(() => mockQuery);

			await TruliooPersonSourceHelper.extractPersonNameFromPeopleTable(businessID, externalId);

			// Verify .where (business_id) is called before .andWhere (OR grouping)
			const whereIndex = callOrder.indexOf("where");
			const andWhereIndex = callOrder.indexOf("andWhere");

			expect(whereIndex).toBeGreaterThan(-1);
			expect(andWhereIndex).toBeGreaterThan(-1);
			expect(whereIndex).toBeLessThan(andWhereIndex);
		});
	});

	describe("extractWatchlistResultsFromPeopleTable", () => {
		it("should extract watchlist results from people table", async () => {
			const mockPersonRows = [
				{
					metadata: JSON.stringify({
						screeningResults: {
							watchlistHits: [
								{
									listType: "SANCTIONS",
									listName: "OFAC",
									confidence: 0.9
								}
							]
						}
					})
				}
			];

			(db as any).mockImplementation((table: string) => {
				if (table === "integration_data.business_entity_people") {
					const queryObj: any = {
						select: jest.fn(() => queryObj),
						join: jest.fn(() => queryObj),
						where: jest.fn(() => queryObj),
						// andWhere now receives a callback that creates nested OR conditions
						andWhere: jest.fn((callback: Function) => {
							const innerQuery: any = {
								whereRaw: jest.fn(() => innerQuery),
								orWhereRaw: jest.fn(() => innerQuery)
							};
							callback.call(innerQuery);
							return queryObj;
						}),
						then: jest.fn((resolve: any) => Promise.resolve(mockPersonRows).then(resolve))
					};
					return queryObj;
				}
				return {
					select: jest.fn().mockReturnThis(),
					where: jest.fn().mockReturnThis()
				};
			});

			const result = await TruliooPersonSourceHelper.extractWatchlistResultsFromPeopleTable(businessID, "test-id");

			expect(result).not.toBeNull();
			expect(result).toHaveLength(1);
			expect(result![0].listType).toBe("SANCTIONS");
		});

		it("should return null when no watchlist results found", async () => {
			const mockPersonRows = [
				{
					metadata: JSON.stringify({
						screeningResults: {
							watchlistHits: []
						}
					})
				}
			];

			(db as any).mockImplementation((table: string) => {
				if (table === "integration_data.business_entity_people") {
					const queryObj: any = {
						select: jest.fn(() => queryObj),
						join: jest.fn(() => queryObj),
						where: jest.fn(() => queryObj),
						andWhere: jest.fn((callback: Function) => {
							const innerQuery: any = {
								whereRaw: jest.fn(() => innerQuery),
								orWhereRaw: jest.fn(() => innerQuery)
							};
							callback.call(innerQuery);
							return queryObj;
						}),
						then: jest.fn((resolve: any) => Promise.resolve(mockPersonRows).then(resolve))
					};
					return queryObj;
				}
				return {
					select: jest.fn().mockReturnThis(),
					where: jest.fn().mockReturnThis()
				};
			});

			const result = await TruliooPersonSourceHelper.extractWatchlistResultsFromPeopleTable(businessID, "test-id");

			expect(result).toBeNull();
		});

		it("should handle database errors gracefully", async () => {
			(db as any).mockImplementation((table: string) => {
				if (table === "integration_data.business_entity_people") {
					const queryObj: any = {
						select: jest.fn(() => queryObj),
						join: jest.fn(() => queryObj),
						where: jest.fn(() => queryObj),
						andWhere: jest.fn(() => {
							throw new Error("Database error");
						})
					};
					return queryObj;
				}
				return {
					select: jest.fn().mockReturnThis(),
					where: jest.fn().mockReturnThis()
				};
			});

			const result = await TruliooPersonSourceHelper.extractWatchlistResultsFromPeopleTable(businessID, "test-id");

			expect(result).toBeNull();
			expect(logger.debug).toHaveBeenCalled();
		});
	});

	describe("processPSCRecords", () => {
		it("should process PSC records and transform them", async () => {
			const mockRecords = [
				{
					response: JSON.stringify({
						fullName: "John Doe",
						watchlistResults: [
							{
								listType: "SANCTIONS",
								listName: "OFAC",
								confidence: 0.9
							}
						]
					}),
					external_id: "test-id-123",
					requested_at: new Date("2024-01-15T10:00:00Z"),
					request_received: new Date("2024-01-15T10:00:00Z")
				}
			];

			const result = await TruliooPersonSourceHelper.processPSCRecords(businessID, mockRecords as any);

			expect(result.screenedPersons).toHaveLength(1);
			expect(result.screenedPersons[0].fullName).toBe("John Doe");
			expect(result.screenedPersons[0].screeningResults.watchlistHits).toHaveLength(1);
			expect(result.mostRecentUpdatedAt).toBeDefined();
		});

		it("should handle already-formatted screenedPersons", async () => {
			const mockRecords = [
				{
					response: JSON.stringify({
						screenedPersons: [
							{
								fullName: "Jane Smith",
								screeningResults: {
									watchlistHits: [],
									provider: "trulioo",
									screenedAt: "2024-01-15T10:00:00Z"
								}
							}
						]
					}),
					requested_at: new Date("2024-01-15T10:00:00Z")
				}
			];

			const result = await TruliooPersonSourceHelper.processPSCRecords(businessID, mockRecords as any);

			expect(result.screenedPersons).toHaveLength(1);
			expect(result.screenedPersons[0].fullName).toBe("Jane Smith");
		});

		it("should handle parsing errors gracefully", async () => {
			const mockRecords = [
				{
					response: "invalid-json",
					requested_at: new Date("2024-01-15T10:00:00Z")
				}
			];

			const result = await TruliooPersonSourceHelper.processPSCRecords(businessID, mockRecords as any);

			expect(result.screenedPersons).toHaveLength(0);
			expect(logger.warn).toHaveBeenCalled();
		});

		it("should deduplicate persons by name when multiple records exist for same person", async () => {
			// Simulate multiple records for the same person (e.g., due to re-runs or data issues)
			const mockRecords = [
				{
					response: JSON.stringify({
						fullName: "Elvis Presley",
						watchlistResults: [
							{ listType: "SANCTIONS", listName: "OFAC", confidence: 0.9 }
						]
					}),
					external_id: "first-record-id",
					requested_at: new Date("2024-01-15T10:00:00Z")
				},
				{
					response: JSON.stringify({
						fullName: "Elvis Presley", // Same person name
						watchlistResults: [
							{ listType: "PEP", listName: "PEP List", confidence: 0.8 }
						]
					}),
					external_id: "second-record-id",
					requested_at: new Date("2024-01-15T11:00:00Z")
				}
			];

			const result = await TruliooPersonSourceHelper.processPSCRecords(businessID, mockRecords as any);

			// Should only have ONE person, not two
			expect(result.screenedPersons).toHaveLength(1);
			expect(result.screenedPersons[0].fullName).toBe("Elvis Presley");
		});

		it("should NOT deduplicate persons with different names", async () => {
			const mockRecords = [
				{
					response: JSON.stringify({
						fullName: "Elvis Presley",
						watchlistResults: []
					}),
					external_id: "first-record-id",
					requested_at: new Date("2024-01-15T10:00:00Z")
				},
				{
					response: JSON.stringify({
						fullName: "John Doe", // Different person
						watchlistResults: []
					}),
					external_id: "second-record-id",
					requested_at: new Date("2024-01-15T11:00:00Z")
				}
			];

			const result = await TruliooPersonSourceHelper.processPSCRecords(businessID, mockRecords as any);

			// Should have TWO different persons
			expect(result.screenedPersons).toHaveLength(2);
			expect(result.screenedPersons.map(p => p.fullName)).toContain("Elvis Presley");
			expect(result.screenedPersons.map(p => p.fullName)).toContain("John Doe");
		});

		it("should deduplicate persons in already-formatted screenedPersons arrays", async () => {
			const mockRecords = [
				{
					response: JSON.stringify({
						screenedPersons: [
							{ fullName: "Elvis Presley", screeningResults: { watchlistHits: [], provider: "trulioo", screenedAt: "2024-01-15" } },
							{ fullName: "Elvis Presley", screeningResults: { watchlistHits: [], provider: "trulioo", screenedAt: "2024-01-16" } } // Duplicate
						]
					}),
					requested_at: new Date("2024-01-15T10:00:00Z")
				}
			];

			const result = await TruliooPersonSourceHelper.processPSCRecords(businessID, mockRecords as any);

			// Should only have ONE person despite two entries in screenedPersons array
			expect(result.screenedPersons).toHaveLength(1);
			expect(result.screenedPersons[0].fullName).toBe("Elvis Presley");
		});

		it("should track most recent updatedAt", async () => {
			const mockRecords = [
				{
					response: JSON.stringify({
						fullName: "Person 1",
						watchlistResults: []
					}),
					requested_at: new Date("2024-01-15T10:00:00Z"),
					request_received: new Date("2024-01-15T10:00:00Z")
				},
				{
					response: JSON.stringify({
						fullName: "Person 2",
						watchlistResults: []
					}),
					requested_at: new Date("2024-01-16T10:00:00Z"),
					request_received: new Date("2024-01-16T10:00:00Z")
				}
			];

			const result = await TruliooPersonSourceHelper.processPSCRecords(businessID, mockRecords as any);

			expect(result.mostRecentUpdatedAt).toEqual(new Date("2024-01-16T10:00:00Z"));
		});
	});
});
