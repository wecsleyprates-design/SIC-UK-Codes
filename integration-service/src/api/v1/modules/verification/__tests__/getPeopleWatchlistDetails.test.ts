/**
 * Tests for getPeopleWatchlistDetails (GET .../people/watchlist).
 * Covers deduplication by normalized name and merge of watchlist_results.
 */

import { createTracker } from "knex-mock-client";
import { BusinessEntityVerificationService } from "../businessEntityVerification";
import { db } from "#helpers/knex";
import type { UUID } from "crypto";

describe("getPeopleWatchlistDetails", () => {
	const businessID = "275b7292-534b-4fb2-870b-abf1793d593b" as UUID;
	let tracker: ReturnType<typeof createTracker>;

	beforeEach(() => {
		tracker = createTracker(db);
	});

	afterEach(() => {
		tracker.reset();
	});

	it("should return empty records when no people exist for business", async () => {
		tracker.on.select(/business_entity_people/).response([]);

		const service = new BusinessEntityVerificationService();
		const result = await service.getPeopleWatchlistDetails({ businessID });

		expect(result).toEqual({ records: [] });
	});

	it("should return one record per person when names are unique", async () => {
		tracker.on.select(/business_entity_people/).response([
			{
				id: "person-1",
				name: "Jacqueline Martin",
				titles: ["Director"],
				metadata: {}
			},
			{
				id: "person-2",
				name: "Hillary Swank",
				titles: ["Officer"],
				metadata: {}
			}
		]);

		const service = new BusinessEntityVerificationService();
		const result = await service.getPeopleWatchlistDetails({ businessID });

		expect(result.records).toHaveLength(2);
		expect(result.records?.map(r => r.name)).toEqual(["Jacqueline Martin", "Hillary Swank"]);
	});

	it("should deduplicate by normalized name (same person, different casing)", async () => {
		tracker.on.select(/business_entity_people/).response([
			{
				id: "person-kyb",
				name: "JACQUELINE MARTIN",
				titles: ["Director"],
				metadata: {}
			},
			{
				id: "person-psc",
				name: "Jacqueline Martin",
				titles: ["Director"],
				metadata: {
					screeningResults: {
						watchlistHits: [
							{ listType: "SANCTIONS", listName: "OFAC", matchDetails: "Hit 1", confidence: 0.9 }
						]
					}
				}
			}
		]);

		const service = new BusinessEntityVerificationService();
		const result = await service.getPeopleWatchlistDetails({ businessID });

		expect(result.records).toHaveLength(1);
		expect(result.records?.[0].name).toBe("Jacqueline Martin"); // Prefer name from record with hits
		expect(result.records?.[0].watchlist_results).toHaveLength(1);
	});

	it("should merge watchlist_results when same person has multiple rows (e.g. KYB + PSC)", async () => {
		tracker.on.select(/business_entity_people/).response([
			{
				id: "row-1",
				name: "Jacqueline Martin",
				titles: ["Director"],
				metadata: {} // No hits from KYB row
			},
			{
				id: "row-2",
				name: "Jacqueline Martin",
				titles: ["Director"],
				metadata: {
					screeningResults: {
						watchlistHits: [
							{ listType: "SANCTIONS", listName: "OFAC", matchDetails: "Hit A", confidence: 0.95 },
							{ listType: "PEP", listName: "PEP List", matchDetails: "Hit B", confidence: 0.8 }
						]
					}
				}
			}
		]);

		const service = new BusinessEntityVerificationService();
		const result = await service.getPeopleWatchlistDetails({ businessID });

		expect(result.records).toHaveLength(1);
		expect(result.records?.[0].watchlist_results).toHaveLength(2);
	});

	it("should prefer display name from record that has hits when merging", async () => {
		tracker.on.select(/business_entity_people/).response([
			{
				id: "first",
				name: "JACQUELINE MARTIN",
				titles: [],
				metadata: {}
			},
			{
				id: "second",
				name: "Jacqueline Martin",
				titles: [],
				metadata: {
					screeningResults: { watchlistHits: [{ listType: "SANCTIONS", listName: "OFAC", matchDetails: "x", confidence: 0.9 }] }
				}
			}
		]);

		const service = new BusinessEntityVerificationService();
		const result = await service.getPeopleWatchlistDetails({ businessID });

		expect(result.records?.[0].name).toBe("Jacqueline Martin");
	});

	it("should deduplicate by trimmed name (leading/trailing spaces)", async () => {
		tracker.on.select(/business_entity_people/).response([
			{ id: "a", name: "  Jacqueline Martin  ", titles: [], metadata: {} },
			{ id: "b", name: "Jacqueline Martin", titles: [], metadata: { screeningResults: { watchlistHits: [{ listType: "SANCTIONS", listName: "OFAC", matchDetails: "y", confidence: 0.9 }] } } }
		]);

		const service = new BusinessEntityVerificationService();
		const result = await service.getPeopleWatchlistDetails({ businessID });

		expect(result.records).toHaveLength(1);
		expect(result.records?.[0].watchlist_results).toHaveLength(1);
	});

	it("should handle metadata as JSON string", async () => {
		tracker.on.select(/business_entity_people/).response([
			{
				id: "p1",
				name: "Jane Doe",
				titles: [],
				metadata: JSON.stringify({
					screeningResults: {
						watchlistHits: [{ listType: "PEP", listName: "PEP DB", matchDetails: "Match", confidence: 0.85 }]
					}
				})
			}
		]);

		const service = new BusinessEntityVerificationService();
		const result = await service.getPeopleWatchlistDetails({ businessID });

		expect(result.records).toHaveLength(1);
		expect(result.records?.[0].watchlist_results).toHaveLength(1);
	});

	it("should use metadata.sources (watchlist_result type) when present", async () => {
			tracker.on.select(/business_entity_people/).response([
				{
					id: "p1",
					name: "John Smith",
					titles: [],
					metadata: {
						sources: [
							{
								type: "watchlist_result",
								metadata: {
									title: "OFAC",
									agency: "US Treasury",
									abbr: "OFAC",
									agency_abbr: "OFAC",
									entity_name: "John Smith"
								},
								listType: "SANCTIONS"
							}
						]
					}
				}
			]);

			const service = new BusinessEntityVerificationService();
			const result = await service.getPeopleWatchlistDetails({ businessID });

			expect(result.records).toHaveLength(1);
			expect(result.records?.[0].watchlist_results).toHaveLength(1);
			expect(result.records?.[0].watchlist_results?.[0].metadata?.title).toBe("OFAC");
		});

	it("should exclude ADVERSE_MEDIA hits from Trulioo screeningResults fallback", async () => {
		tracker.on.select(/business_entity_people/).response([
			{
				id: "p1",
				name: "John Doe",
				titles: ["UBO"],
				metadata: {
					screeningResults: {
						watchlistHits: [
							{ listType: "SANCTIONS", listName: "OFAC", matchDetails: "Hit 1", confidence: 0.95 },
							{ listType: "ADVERSE_MEDIA", listName: "Negative News", matchDetails: "Hit 2", confidence: 0.8 },
							{ listType: "PEP", listName: "PEP List", matchDetails: "Hit 3", confidence: 0.85 }
						]
					}
				}
			}
		]);

		const service = new BusinessEntityVerificationService();
		const result = await service.getPeopleWatchlistDetails({ businessID });

		expect(result.records).toHaveLength(1);
		expect(result.records?.[0].watchlist_results).toHaveLength(2);
		const types = result.records?.[0].watchlist_results?.map(r => r.metadata?.title);
		expect(types).toContain("OFAC");
		expect(types).toContain("PEP List");
		expect(types).not.toContain("Negative News");
	});

	it("should exclude ADVERSE_MEDIA from watchlistResults fallback", async () => {
		tracker.on.select(/business_entity_people/).response([
			{
				id: "p1",
				name: "Jane Smith",
				titles: ["Director"],
				metadata: {
					watchlistResults: [
						{ listType: "ADVERSE_MEDIA", listName: "Bad Press", matchDetails: "Hit A", confidence: 0.7 },
						{ listType: "SANCTIONS", listName: "EU Sanctions", matchDetails: "Hit B", confidence: 0.9 }
					]
				}
			}
		]);

		const service = new BusinessEntityVerificationService();
		const result = await service.getPeopleWatchlistDetails({ businessID });

		expect(result.records).toHaveLength(1);
		expect(result.records?.[0].watchlist_results).toHaveLength(1);
		expect(result.records?.[0].watchlist_results?.[0].metadata?.title).toBe("EU Sanctions");
	});

	it("should return empty watchlist_results when all hits are ADVERSE_MEDIA", async () => {
		tracker.on.select(/business_entity_people/).response([
			{
				id: "p1",
				name: "Only AM Person",
				titles: [],
				metadata: {
					screeningResults: {
						watchlistHits: [
							{ listType: "ADVERSE_MEDIA", listName: "News 1", matchDetails: "Hit", confidence: 0.7 },
							{ listType: "ADVERSE_MEDIA", listName: "News 2", matchDetails: "Hit", confidence: 0.6 }
						]
					}
				}
			}
		]);

		const service = new BusinessEntityVerificationService();
		const result = await service.getPeopleWatchlistDetails({ businessID });

		expect(result.records).toHaveLength(1);
		expect(result.records?.[0].watchlist_results).toHaveLength(0);
	});

	it("should never return watchlist_result with undefined metadata.title (frontend safety)", async () => {
			// Source with partial metadata (e.g. from DB) - backend must normalize or sanitize so frontend never sees undefined
			tracker.on.select(/business_entity_people/).response([
				{
					id: "p1",
					name: "Partial Person",
					titles: [],
					metadata: {
						sources: [
							{
								type: "watchlist_result",
								metadata: { abbr: "X", agency: "Some Agency", entity_name: "Partial Person" }
								// title missing - would have caused "Cannot read properties of undefined (reading 'title')"
							}
						]
					}
				}
			]);

			const service = new BusinessEntityVerificationService();
			const result = await service.getPeopleWatchlistDetails({ businessID });

			expect(result.records).toHaveLength(1);
			expect(result.records?.[0].watchlist_results).toHaveLength(1);
			const hit = result.records?.[0].watchlist_results?.[0];
			expect(hit?.metadata).toBeDefined();
			expect(typeof hit?.metadata?.title).toBe("string");
			expect(typeof hit?.metadata?.agency).toBe("string");
		});
});
