/**
 * Tests for truliooPerson source functionality
 * This test suite covers watchlist extraction, transformation, and integration
 * with the watchlist fact. Additional tests for other truliooPerson functionality
 * can be added here in the future.
 */

import { UUID } from "crypto";
import { db } from "#helpers/knex";
import { logger } from "#helpers/logger";
import { INTEGRATION_ID } from "#constants";
import { sources } from "../sources";
import { kybFacts } from "../kyb";

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
		// Mock implementation that extracts watchlist from nested structure
		if (response?.flowData?.serviceData?.[0]?.fullServiceDetails?.Record?.DatasourceResults) {
			const datasourceResults = response.flowData.serviceData[0].fullServiceDetails.Record.DatasourceResults;
			const watchlistDatasource = datasourceResults.find(
				(ds: any) => ds.DatasourceName === "Advanced Watchlist"
			);
			if (watchlistDatasource?.Record?.Results) {
				return watchlistDatasource.Record.Results.map((result: any) => ({
					listType: result.ListType || "SANCTIONS",
					listName: result.ListName || "Test List",
					matchDetails: result.MatchDetails || "Test Match",
					listCountry: result.ListCountry || "US",
					sourceRegion: result.SourceRegion || "North America",
					url: result.Url || "https://example.com"
				}));
			}
		}
		// Fallback: return watchlistResults if present
		return response?.watchlistResults || [];
	})
}));

describe("truliooPerson Source - Watchlist", () => {
	const businessID = "00000000-0000-0000-0000-000000000001" as UUID;

	beforeEach(() => {
		jest.clearAllMocks();
		sources.person.confidence = undefined;
		(db as any).__setResult(null);
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	describe("watchlist extraction from PSC screening", () => {
		it("should extract watchlist hits from PSC screening response with watchlistResults", async () => {
			const mockWatchlistHits = [
				{
					listType: "SANCTIONS",
					listName: "OFAC SDN List",
					matchDetails: "Lord Voldermort",
					listCountry: "US",
					sourceRegion: "North America",
					url: "https://ofac.treasury.gov"
				},
				{
					listType: "PEP",
					listName: "PEP List",
					matchDetails: "Lord Voldermort",
					listCountry: "GB",
					sourceRegion: "Europe",
					url: "https://pep.example.com"
				}
			];

			const mockPSCResponse = {
				watchlistResults: mockWatchlistHits,
				screenedAt: "2024-01-15T10:00:00Z"
			};

			const mockRequestResponse = {
				response: JSON.stringify(mockPSCResponse),
				requested_at: new Date("2024-01-15T10:00:00Z"),
				request_received: new Date("2024-01-15T10:00:00Z")
			};

			// Mock db to return PSC screening record
			(db as any).mockImplementation((table: string) => {
				if (table === "integration_data.request_response") {
					const queryObj: any = {
						select: jest.fn(() => queryObj),
						where: jest.fn(() => queryObj),
						andWhere: jest.fn(() => queryObj),
						whereIn: jest.fn(() => queryObj),
						orderBy: jest.fn(() => queryObj),
						limit: jest.fn(() => queryObj),
						first: jest.fn(() => queryObj),
						then: jest.fn((resolve: any) => Promise.resolve([mockRequestResponse]).then(resolve)),
						catch: jest.fn((reject: any) => Promise.resolve([mockRequestResponse]).catch(reject))
					};
					return queryObj;
				}
				return {
					select: jest.fn().mockReturnThis(),
					where: jest.fn().mockReturnThis()
				};
			});

			const source = sources.person;
			const result = await source.getter(businessID);

			expect(result).toBeDefined();
			expect(result?.screenedPersons).toBeDefined();
			expect(result?.screenedPersons).toHaveLength(1);

			const person = result?.screenedPersons[0];
			expect(person).toBeDefined();
			expect(person?.screeningResults).toBeDefined();
			expect(person?.screeningResults?.watchlistHits).toBeDefined();
			expect(person?.screeningResults?.watchlistHits).toHaveLength(2);
			expect(person?.screeningResults?.watchlistHits[0].listType).toBe("SANCTIONS");
			expect(person?.screeningResults?.watchlistHits[1].listType).toBe("PEP");

			// Verify backward compatibility: watchlistResults should still exist
			expect(person?.watchlistResults).toBeDefined();
			expect(person?.watchlistResults).toHaveLength(2);
		});

		it("should extract watchlist hits from nested PSC response structure", async () => {
			const mockNestedResponse = {
				flowData: {
					serviceData: [
						{
							nodeType: "trulioo_person_wl",
							fullServiceDetails: {
								Record: {
									DatasourceResults: [
										{
											DatasourceName: "Advanced Watchlist",
											Record: {
												Results: [
													{
														ListType: "SANCTIONS",
														ListName: "OFAC SDN List",
														MatchDetails: "Lord Voldermort",
														ListCountry: "US",
														SourceRegion: "North America",
														Url: "https://ofac.treasury.gov"
													}
												]
											}
										}
									]
								}
							}
						}
					]
				},
				screenedAt: "2024-01-15T10:00:00Z"
			};

			const mockRequestResponse = {
				response: JSON.stringify(mockNestedResponse),
				requested_at: new Date("2024-01-15T10:00:00Z"),
				request_received: new Date("2024-01-15T10:00:00Z")
			};

			// Mock db to return PSC screening record
			// getAllFromRequestResponse uses: select().where().andWhere().orderBy()
			(db as any).mockImplementation((table: string) => {
				if (table === "integration_data.request_response") {
					const queryObj: any = {
						select: jest.fn(() => queryObj),
						where: jest.fn(() => queryObj),
						andWhere: jest.fn(() => queryObj),
						whereIn: jest.fn(() => queryObj),
						orderBy: jest.fn(() => queryObj),
						limit: jest.fn(() => queryObj),
						first: jest.fn(() => queryObj),
						then: jest.fn((resolve: any) => Promise.resolve([mockRequestResponse]).then(resolve)),
						catch: jest.fn((reject: any) => Promise.resolve([mockRequestResponse]).catch(reject))
					};
					// Make the query object thenable (awaitable)
					queryObj[Symbol.toPrimitive] = () => "[object Promise]";
					return queryObj;
				}
				return {
					select: jest.fn().mockReturnThis(),
					where: jest.fn().mockReturnThis()
				};
			});

			const { extractWatchlistResultsFromTruliooResponse } = await import("#lib/trulioo/common/utils");
			const source = sources.person;
			const result = await source.getter(businessID);

			expect(result).toBeDefined();
			expect(result?.screenedPersons).toBeDefined();
			expect(result?.screenedPersons).toHaveLength(1);

			const person = result?.screenedPersons[0];
			expect(person?.screeningResults?.watchlistHits).toBeDefined();
			expect(person?.screeningResults?.watchlistHits.length).toBeGreaterThan(0);

			// Verify extractWatchlistResultsFromTruliooResponse was called
			expect(extractWatchlistResultsFromTruliooResponse).toHaveBeenCalled();
		});

			it("should return undefined when no PSC screening records exist", async () => {
			// Mock db to return empty array
			// getAllFromRequestResponse uses: select().where().andWhere().orderBy()
			// When no PSC records exist, code also queries business_entity_people with join()
			(db as any).mockImplementation((table: string) => {
				if (table === "integration_data.request_response") {
					const queryObj: any = {
						select: jest.fn(() => queryObj),
						where: jest.fn(() => queryObj),
						andWhere: jest.fn(() => queryObj),
						whereIn: jest.fn(() => queryObj),
						orderBy: jest.fn(() => queryObj),
						limit: jest.fn(() => queryObj),
						first: jest.fn(() => queryObj),
						then: jest.fn((resolve: any) => Promise.resolve([]).then(resolve)),
						catch: jest.fn((reject: any) => Promise.resolve([]).catch(reject))
					};
					// Make the query object thenable (awaitable)
					queryObj[Symbol.toPrimitive] = () => "[object Promise]";
					return queryObj;
				}
				// For business_entity_people table, need join() method
				const queryObj: any = {
					select: jest.fn(() => queryObj),
					join: jest.fn(() => queryObj),
					where: jest.fn(() => queryObj),
					then: jest.fn((resolve: any) => Promise.resolve([]).then(resolve)),
					catch: jest.fn((reject: any) => Promise.resolve([]).catch(reject))
				};
				return queryObj;
			});

			const source = sources.person;
			const result = await source.getter(businessID);

			expect(result).toBeUndefined();
		});

		it("should aggregate watchlist hits from multiple PSC screening records", async () => {
			const mockPerson1 = {
				watchlistResults: [
					{
						listType: "SANCTIONS",
						listName: "OFAC SDN List",
						matchDetails: "Person 1",
						listCountry: "US"
					}
				],
				screenedAt: "2024-01-15T10:00:00Z"
			};

			const mockPerson2 = {
				watchlistResults: [
					{
						listType: "PEP",
						listName: "PEP List",
						matchDetails: "Person 2",
						listCountry: "GB"
					}
				],
				screenedAt: "2024-01-15T11:00:00Z"
			};

			const mockRequestResponses = [
				{
					response: JSON.stringify(mockPerson1),
					requested_at: new Date("2024-01-15T10:00:00Z"),
					request_received: new Date("2024-01-15T10:00:00Z")
				},
				{
					response: JSON.stringify(mockPerson2),
					requested_at: new Date("2024-01-15T11:00:00Z"),
					request_received: new Date("2024-01-15T11:00:00Z")
				}
			];

			// Mock db to return multiple PSC screening records
			// getAllFromRequestResponse uses: select().where().andWhere().orderBy()
			(db as any).mockImplementation((table: string) => {
				if (table === "integration_data.request_response") {
					const queryObj: any = {
						select: jest.fn(() => queryObj),
						where: jest.fn(() => queryObj),
						andWhere: jest.fn(() => queryObj),
						whereIn: jest.fn(() => queryObj),
						orderBy: jest.fn(() => queryObj),
						limit: jest.fn(() => queryObj),
						first: jest.fn(() => queryObj),
						then: jest.fn((resolve: any) => Promise.resolve(mockRequestResponses).then(resolve)),
						catch: jest.fn((reject: any) => Promise.resolve(mockRequestResponses).catch(reject))
					};
					// Make the query object thenable (awaitable)
					queryObj[Symbol.toPrimitive] = () => "[object Promise]";
					return queryObj;
				}
				return {
					select: jest.fn().mockReturnThis(),
					where: jest.fn().mockReturnThis()
				};
			});

			const source = sources.person;
			const result = await source.getter(businessID);

			expect(result).toBeDefined();
			expect(result?.screenedPersons).toBeDefined();
			expect(result?.screenedPersons).toHaveLength(2);

			// Verify both persons have watchlist hits
			expect(result?.screenedPersons[0]?.screeningResults?.watchlistHits).toHaveLength(1);
			expect(result?.screenedPersons[1]?.screeningResults?.watchlistHits).toHaveLength(1);
		});
	});

	describe("watchlist fact integration", () => {
		/**
		 * IMPORTANT: The watchlist pipeline no longer has a truliooPerson source.
		 * Person-level watchlist hits are now ONLY available via the 'screened_people' fact.
		 * This separation prevents UI duplication where the same person (e.g., "Elvis Presley")
		 * would appear twice - once from watchlist and once from screened_people.
		 *
		 * Architecture:
		 * - 'watchlist_raw' fact = business-level sources (Middesk + TruliooBusiness)
		 * - 'watchlist' fact = synthetic, consolidates watchlist_raw + screened_people
		 * - 'screened_people' fact = person-level hits (TruliooPerson with screeningResults.watchlistHits)
		 */
		it("should NOT have truliooPerson source in watchlist pipeline (separation of concerns)", async () => {
			const watchlistRawFacts = kybFacts.filter(fact => fact.name === "watchlist_raw");
			expect(watchlistRawFacts.length).toBeGreaterThan(0);

			const watchlistRawWithTruliooPerson = watchlistRawFacts.find((fact: any) => fact.source === sources.person);
			expect(watchlistRawWithTruliooPerson).toBeUndefined();

			const watchlistRawSources = watchlistRawFacts.map((fact: any) => fact.source?.name).filter(Boolean);
			expect(watchlistRawSources).toContain("middesk");
			expect(watchlistRawSources).toContain("business");
			expect(watchlistRawSources).not.toContain("person");

			const watchlistFacts = kybFacts.filter(fact => fact.name === "watchlist");
			expect(watchlistFacts).toHaveLength(1);
			expect(watchlistFacts[0].source).toBeNull();
			expect(watchlistFacts[0].dependencies).toContain("watchlist_raw");
			expect(watchlistFacts[0].dependencies).toContain("screened_people");
		});

		it("should expose person watchlist hits via screened_people fact instead", async () => {
			const mockWatchlistHits = [
				{
					listType: "SANCTIONS",
					listName: "OFAC SDN List",
					matchDetails: "Lord Voldermort",
					listCountry: "US",
					sourceRegion: "North America",
					url: "https://ofac.treasury.gov"
				}
			];

			const mockPSCResponse = {
				watchlistResults: mockWatchlistHits,
				fullName: "Lord Voldermort",
				screenedAt: "2024-01-15T10:00:00Z"
			};

			const mockRequestResponse = {
				response: JSON.stringify(mockPSCResponse),
				external_id: "test-inquiry-id-123",
				requested_at: new Date("2024-01-15T10:00:00Z"),
				request_received: new Date("2024-01-15T10:00:00Z")
			};

			// Mock db to return PSC screening record
			(db as any).mockImplementation((table: string) => {
				if (table === "integration_data.request_response") {
					const queryObj: any = {
						select: jest.fn(() => queryObj),
						where: jest.fn(() => queryObj),
						andWhere: jest.fn(() => queryObj),
						whereIn: jest.fn(() => queryObj),
						orderBy: jest.fn(() => queryObj),
						limit: jest.fn(() => queryObj),
						first: jest.fn(() => queryObj),
						then: jest.fn((resolve: any) => Promise.resolve([mockRequestResponse]).then(resolve)),
						catch: jest.fn((reject: any) => Promise.resolve([mockRequestResponse]).catch(reject))
					};
					queryObj[Symbol.toPrimitive] = () => "[object Promise]";
					return queryObj;
				}
				return {
					select: jest.fn().mockReturnThis(),
					where: jest.fn().mockReturnThis()
				};
			});

			// Get truliooPerson source data (used by screened_people fact)
			const source = sources.person;
			const sourceData = await source.getter(businessID);

			// Verify person data is available via screenedPersons (for screened_people fact)
			expect(sourceData).toBeDefined();
			expect(sourceData?.screenedPersons).toBeDefined();
			expect(sourceData?.screenedPersons).toHaveLength(1);

			const person = sourceData?.screenedPersons[0];
			expect(person?.fullName).toBe("Lord Voldermort");
			expect(person?.screeningResults?.watchlistHits).toBeDefined();
			expect(person?.screeningResults?.watchlistHits).toHaveLength(1);
			expect(person?.screeningResults?.watchlistHits[0].listType).toBe("SANCTIONS");
			expect(person?.screeningResults?.watchlistHits[0].listName).toBe("OFAC SDN List");
		});

		it("should correctly transform watchlistResults to screeningResults.watchlistHits", async () => {
			// Create a response that has watchlistResults but not in screeningResults.watchlistHits format
			const mockPSCResponse = {
				watchlistResults: [
					{
						listType: "PEP",
						listName: "PEP List",
						matchDetails: "Test Person",
						listCountry: "GB"
					}
				],
				fullName: "Test Person",
				screenedAt: "2024-01-15T10:00:00Z"
			};

			const mockRequestResponse = {
				response: JSON.stringify(mockPSCResponse),
				external_id: "test-inquiry-id-456",
				requested_at: new Date("2024-01-15T10:00:00Z"),
				request_received: new Date("2024-01-15T10:00:00Z")
			};

			// Mock db to return PSC screening record
			(db as any).mockImplementation((table: string) => {
				if (table === "integration_data.request_response") {
					const queryObj: any = {
						select: jest.fn(() => queryObj),
						where: jest.fn(() => queryObj),
						andWhere: jest.fn(() => queryObj),
						whereIn: jest.fn(() => queryObj),
						orderBy: jest.fn(() => queryObj),
						limit: jest.fn(() => queryObj),
						first: jest.fn(() => queryObj),
						then: jest.fn((resolve: any) => Promise.resolve([mockRequestResponse]).then(resolve)),
						catch: jest.fn((reject: any) => Promise.resolve([mockRequestResponse]).catch(reject))
					};
					queryObj[Symbol.toPrimitive] = () => "[object Promise]";
					return queryObj;
				}
				return {
					select: jest.fn().mockReturnThis(),
					where: jest.fn().mockReturnThis()
				};
			});

			// Get truliooPerson source data
			const source = sources.person;
			const sourceData = await source.getter(businessID);

			// The source should transform watchlistResults to screeningResults.watchlistHits
			expect(sourceData?.screenedPersons[0]?.screeningResults?.watchlistHits).toBeDefined();
			expect(sourceData?.screenedPersons[0]?.screeningResults?.watchlistHits).toHaveLength(1);
			expect(sourceData?.screenedPersons[0]?.screeningResults?.watchlistHits[0].listType).toBe("PEP");
		});
	});
});
