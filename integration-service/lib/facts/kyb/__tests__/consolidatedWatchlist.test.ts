import { calculateConsolidatedWatchlist } from "../consolidatedWatchlist";
import type { FactEngine } from "../../factEngine";
import type { WatchlistValue, WatchlistValueMetadatum } from "../types";
import { WATCHLIST_ENTITY_TYPE } from "../types";
import type { TruliooScreenedPersonData, TruliooWatchlistHit } from "#lib/trulioo/common/types";

function createMockEngine(overrides: {
	watchlistRaw?: { value: WatchlistValue | null };
	screenedPeople?: { value: TruliooScreenedPersonData[] | null };
} = {}): FactEngine {
	return {
		getResolvedFact: (factName: string) => {
			if (factName === "watchlist_raw") return overrides.watchlistRaw ?? null;
			if (factName === "screened_people") return overrides.screenedPeople ?? null;
			return null;
		}
	} as unknown as FactEngine;
}

function createHit(
	overrides: Partial<WatchlistValueMetadatum> & { type: string }
): WatchlistValueMetadatum {
	return {
		id: `hit-${Math.random().toString(36).slice(2, 8)}`,
		metadata: {
			abbr: "TEST",
			title: "Test List",
			agency: "Test Agency",
			agency_abbr: "TA",
			entity_name: "Test Entity",
			...overrides.metadata
		},
		...overrides
	} as WatchlistValueMetadatum;
}

describe("calculateConsolidatedWatchlist", () => {
	describe("adverse media filtering", () => {
		it("should exclude adverse_media from business-level watchlist_raw hits", async () => {
			const engine = createMockEngine({
				watchlistRaw: {
					value: {
						metadata: [
							createHit({ type: "sanctions", metadata: { abbr: "OFAC", title: "OFAC SDN", agency: "OFAC", agency_abbr: "OFAC", entity_name: "Corp A" } }),
							createHit({ type: "adverse_media", metadata: { abbr: "AM", title: "Negative News", agency: "Media", agency_abbr: "M", entity_name: "Corp A" } }),
							createHit({ type: "pep", metadata: { abbr: "PEP", title: "PEP List", agency: "WC", agency_abbr: "WC", entity_name: "Corp A" } })
						],
						message: "Found 3 hits"
					}
				}
			});

			const result = await calculateConsolidatedWatchlist(engine);

			expect(result?.metadata).toHaveLength(2);
			expect(result?.metadata.map(h => h.type)).toEqual(["sanctions", "pep"]);
		});

		it("should exclude adverse_media from person-level screened_people hits", async () => {
			const engine = createMockEngine({
				screenedPeople: {
					value: [
						{
							fullName: "John Doe",
							firstName: "John",
							lastName: "Doe",
							dateOfBirth: "1980-01-01",
							addressLine1: "123 St",
							city: "NYC",
							postalCode: "10001",
							country: "US",
							controlType: "UBO",
							screeningStatus: "completed",
							screeningResults: {
								watchlistHits: [
									{ listType: "PEP", listName: "PEP List", confidence: 95, matchDetails: "John Doe" } as TruliooWatchlistHit,
									{ listType: "ADVERSE_MEDIA", listName: "News Report", confidence: 80, matchDetails: "John Doe" } as TruliooWatchlistHit,
									{ listType: "SANCTIONS", listName: "OFAC", confidence: 90, matchDetails: "John Doe" } as TruliooWatchlistHit
								]
							}
						} as TruliooScreenedPersonData
					]
				}
			});

			const result = await calculateConsolidatedWatchlist(engine);

			expect(result?.metadata).toHaveLength(2);
			expect(result?.metadata.map(h => h.type)).toEqual(["pep", "sanctions"]);
		});

		it("should exclude adverse_media from both sources combined", async () => {
			const engine = createMockEngine({
				watchlistRaw: {
					value: {
						metadata: [
							createHit({ type: "sanctions", metadata: { abbr: "OFAC", title: "OFAC", agency: "OFAC", agency_abbr: "OFAC", entity_name: "Biz X" } }),
							createHit({ type: "adverse_media", metadata: { abbr: "AM", title: "Biz News", agency: "Media", agency_abbr: "M", entity_name: "Biz X" } })
						],
						message: "Found 2 hits"
					}
				},
				screenedPeople: {
					value: [
						{
							fullName: "Jane Smith",
							firstName: "Jane",
							lastName: "Smith",
							dateOfBirth: "1985-05-15",
							addressLine1: "456 Ave",
							city: "London",
							postalCode: "SW1",
							country: "GB",
							controlType: "DIRECTOR",
							screeningStatus: "completed",
							screeningResults: {
								watchlistHits: [
									{ listType: "PEP", listName: "PEP", confidence: 90, matchDetails: "Jane Smith" } as TruliooWatchlistHit,
									{ listType: "ADVERSE_MEDIA", listName: "Person News", confidence: 75, matchDetails: "Jane Smith" } as TruliooWatchlistHit
								]
							}
						} as TruliooScreenedPersonData
					]
				}
			});

			const result = await calculateConsolidatedWatchlist(engine);

			expect(result?.metadata).toHaveLength(2);
			const types = result?.metadata.map(h => h.type);
			expect(types).toContain("sanctions");
			expect(types).toContain("pep");
			expect(types).not.toContain("adverse_media");
		});

		it("should return empty metadata with correct message when only adverse_media hits exist", async () => {
			const engine = createMockEngine({
				watchlistRaw: {
					value: {
						metadata: [
							createHit({ type: "adverse_media", metadata: { abbr: "AM", title: "News 1", agency: "Source", agency_abbr: "S", entity_name: "Corp" } }),
							createHit({ type: "adverse_media", metadata: { abbr: "AM", title: "News 2", agency: "Source", agency_abbr: "S", entity_name: "Corp" } })
						],
						message: "Found 2 hits"
					}
				}
			});

			const result = await calculateConsolidatedWatchlist(engine);

			expect(result?.metadata).toHaveLength(0);
			expect(result?.message).toBe("No Watchlist hits were identified");
		});

		it("should update count in message to reflect filtered (non-AM) hits", async () => {
			const engine = createMockEngine({
				watchlistRaw: {
					value: {
						metadata: [
							createHit({ type: "sanctions", metadata: { abbr: "OFAC", title: "OFAC", agency: "OFAC", agency_abbr: "OFAC", entity_name: "Corp" } }),
							createHit({ type: "adverse_media", metadata: { abbr: "AM", title: "News", agency: "Media", agency_abbr: "M", entity_name: "Corp" } }),
							createHit({ type: "pep", metadata: { abbr: "PEP", title: "PEP", agency: "WC", agency_abbr: "WC", entity_name: "Person" } })
						],
						message: "Found 3 hits"
					}
				}
			});

			const result = await calculateConsolidatedWatchlist(engine);

			expect(result?.metadata).toHaveLength(2);
			expect(result?.message).toBe("Found 2 consolidated watchlist hit(s)");
		});
	});

	describe("basic consolidation (no adverse media)", () => {
		it("should merge business and person hits without duplicates", async () => {
			const engine = createMockEngine({
				watchlistRaw: {
					value: {
						metadata: [
							createHit({ type: "sanctions", metadata: { abbr: "OFAC", title: "OFAC SDN", agency: "OFAC", agency_abbr: "OFAC", entity_name: "Corp A" } })
						],
						message: "Found 1 hit"
					}
				},
				screenedPeople: {
					value: [
						{
							fullName: "John Doe",
							firstName: "John",
							lastName: "Doe",
							dateOfBirth: "1980-01-01",
							addressLine1: "123 St",
							city: "NYC",
							postalCode: "10001",
							country: "US",
							controlType: "UBO",
							screeningStatus: "completed",
							screeningResults: {
								watchlistHits: [
									{ listType: "PEP", listName: "PEP List", confidence: 95, matchDetails: "John Doe" } as TruliooWatchlistHit
								]
							}
						} as TruliooScreenedPersonData
					]
				}
			});

			const result = await calculateConsolidatedWatchlist(engine);

			expect(result?.metadata).toHaveLength(2);
			expect(result?.message).toBe("Found 2 consolidated watchlist hit(s)");
		});

		it("should return empty result when no facts available", async () => {
			const engine = createMockEngine();

			const result = await calculateConsolidatedWatchlist(engine);

			expect(result?.metadata).toHaveLength(0);
			expect(result?.message).toBe("No Watchlist hits were identified");
		});
	});
});
