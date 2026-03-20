import { combineWatchlistMetadata, combineFacts } from "../rules";
import type { Fact, FactName } from "../types";
import { WATCHLIST_ENTITY_TYPE } from "../kyb/types";

describe("combineWatchlistMetadata rule", () => {
	const factName: FactName = "watchlist_raw";

	// Helper to create a mock fact (using casting for test purposes)
	const createMockFact = (metadata: any[], message: string, sourceName: string): Fact =>
		({
			name: factName,
			source: { name: sourceName } as any,
			value: { metadata, message }
		}) as Fact;

	describe("basic functionality", () => {
		it("should combine metadata from multiple sources without duplicating hits", () => {
			const middeskFact = createMockFact([], "No Watchlist hits were identified", "middesk");

			const personFact = createMockFact(
				[
					{
						id: "hit-1",
						type: "sanctions",
						metadata: { title: "OFAC List", entity_name: "Elvis Presley" },
						url: "https://example.com/hit1"
					},
					{
						id: "hit-2",
						type: "pep",
						metadata: { title: "PEP List", entity_name: "Elvis Presley" },
						url: "https://example.com/hit2"
					}
				],
				"Found 2 watchlist hit(s) from PSC screening",
				"person"
			);

			const result = combineWatchlistMetadata.fn!(null as any, factName, [middeskFact, personFact])!;

			expect(result.value.metadata).toHaveLength(2);
			expect(result.value.message).toBe("Found 2 watchlist hit(s) from PSC screening");
		});

		it("should deduplicate hits with same type + title + entity_name + url", () => {
			const source1Fact = createMockFact(
				[
					{
						id: "hit-1",
						type: "sanctions",
						metadata: { title: "OFAC List", entity_name: "Elvis Presley" },
						url: "https://example.com/hit1"
					}
				],
				"Found 1 hit",
				"business"
			);

			const source2Fact = createMockFact(
				[
					{
						id: "hit-1-duplicate", // Different ID but same content
						type: "sanctions",
						metadata: { title: "OFAC List", entity_name: "Elvis Presley" },
						url: "https://example.com/hit1"
					}
				],
				"Found 1 hit",
				"person"
			);

			const result = combineWatchlistMetadata.fn!(null as any, factName, [source1Fact, source2Fact])!;

			// Should have only 1 hit (deduplicated)
			expect(result.value.metadata).toHaveLength(1);
			expect(result.value.metadata[0].type).toBe("sanctions");
		});

		it("should keep different hits from multiple sources", () => {
			const source1Fact = createMockFact(
				[
					{
						id: "hit-1",
						type: "sanctions",
						metadata: { title: "OFAC List", entity_name: "Elvis Presley" },
						url: "https://example.com/hit1"
					}
				],
				"Found 1 hit",
				"business"
			);

			const source2Fact = createMockFact(
				[
					{
						id: "hit-2",
						type: "pep",
						metadata: { title: "PEP List", entity_name: "Elvis Presley" },
						url: "https://example.com/hit2"
					}
				],
				"Found 1 hit",
				"person"
			);

			const result = combineWatchlistMetadata.fn!(null as any, factName, [source1Fact, source2Fact])!;

			// Should have 2 different hits
			expect(result.value.metadata).toHaveLength(2);
		});
	});

	describe("message handling", () => {
		it("should use informative message instead of 'No Watchlist hits were identified'", () => {
			const middeskFact = createMockFact([], "No Watchlist hits were identified", "middesk");

			const personFact = createMockFact(
				[
					{
						id: "hit-1",
						type: "sanctions",
						metadata: { title: "List", entity_name: "Person" },
						url: "url"
					}
				],
				"Found 1 watchlist hit(s) from PSC screening",
				"person"
			);

			const result = combineWatchlistMetadata.fn!(null as any, factName, [middeskFact, personFact])!;

			expect(result.value.message).toBe("Found 1 watchlist hit(s) from PSC screening");
		});

		it("should generate consolidated message when no informative message is available", () => {
			const fact1 = createMockFact(
				[
					{ id: "hit-1", type: "sanctions", metadata: { title: "List", entity_name: "Person" }, url: "url1" },
					{ id: "hit-2", type: "pep", metadata: { title: "List2", entity_name: "Person" }, url: "url2" }
				],
				"No Watchlist hits were identified", // This shouldn't be used
				"source1"
			);

			const result = combineWatchlistMetadata.fn!(null as any, factName, [fact1])!;

			expect(result.value.message).toBe("Found 2 consolidated watchlist hit(s)");
		});

		it("should return 'No Watchlist hits' message when no hits found", () => {
			const emptyFact1 = createMockFact([], "No Watchlist hits were identified", "middesk");
			const emptyFact2 = createMockFact([], "No Watchlist hits were identified", "business");

			const result = combineWatchlistMetadata.fn!(null as any, factName, [emptyFact1, emptyFact2])!;

			expect(result.value.metadata).toHaveLength(0);
			expect(result.value.message).toBe("No Watchlist hits were identified");
		});
	});

	describe("edge cases", () => {
		it("should handle facts with null/undefined values", () => {
			const nullFact = { name: factName, source: { name: "source1" } as any, value: null } as Fact;
			const undefinedFact = { name: factName, source: { name: "source2" } as any, value: undefined } as Fact;
			const validFact = createMockFact(
				[{ id: "hit-1", type: "sanctions", metadata: { title: "List", entity_name: "Person" }, url: "url" }],
				"Found 1 hit",
				"person"
			);

			const result = combineWatchlistMetadata.fn!(null as any, factName, [nullFact, undefinedFact, validFact])!;

			expect(result.value.metadata).toHaveLength(1);
		});

		it("should handle empty input array", () => {
			const result = combineWatchlistMetadata.fn!(null as any, factName, [])!;

			expect(result.value.metadata).toHaveLength(0);
			expect(result.value.message).toBe("No Watchlist hits were identified");
		});

		it("should handle facts with no metadata property", () => {
			const noMetadataFact = {
				name: factName,
				source: { name: "source1" } as any,
				value: { message: "Some message" }
			} as Fact;

			const result = combineWatchlistMetadata.fn!(null as any, factName, [noMetadataFact])!;

			expect(result.value.metadata).toHaveLength(0);
		});

		it("should handle metadata with missing fields for dedup key", () => {
			const factWithIncompleteHits = createMockFact(
				[
					{ id: "hit-1", type: "sanctions", metadata: {}, url: null },
					{ id: "hit-2", type: null, metadata: { title: "List" }, url: "url" }
				],
				"Found 2 hits",
				"source"
			);

			const result = combineWatchlistMetadata.fn!(null as any, factName, [factWithIncompleteHits])!;

			// Both hits should be included as they have different dedup keys
			expect(result.value.metadata).toHaveLength(2);
		});
	});

	describe("comparison with combineFacts", () => {
		it("combineFacts creates array of objects (the bug), combineWatchlistMetadata merges metadata", () => {
			const middeskFact = createMockFact([], "No Watchlist hits were identified", "middesk");
			const truliooFact = createMockFact(
				[{ id: "hit-1", type: "sanctions", metadata: { title: "List", entity_name: "Person" }, url: "url" }],
				"Found 1 hit",
				"person"
			);

			// combineFacts would create an array with 2 objects (the bug that causes duplicate persons)
			const combineFactsResult = combineFacts.fn!(null as any, factName, [middeskFact, truliooFact], 0)!;

			// combineWatchlistMetadata merges the metadata arrays properly
			const combineWatchlistResult = combineWatchlistMetadata.fn!(null as any, factName, [middeskFact, truliooFact])!;

			// combineFacts creates an array with 2 objects (one empty, one with hits)
			// Note: after Set dedup, it may still have both objects since they're different
			expect(Array.isArray(combineFactsResult.value)).toBe(true);

			// combineWatchlistMetadata returns a single object with merged metadata
			expect(combineWatchlistResult.value).toHaveProperty("metadata");
			expect(combineWatchlistResult.value).toHaveProperty("message");
			expect(Array.isArray(combineWatchlistResult.value.metadata)).toBe(true);
			expect(combineWatchlistResult.value.metadata).toHaveLength(1);
		});
	});

	describe("real-world scenario: US company with PSC screening", () => {
		it("should correctly handle middesk + business sources (no more person)", () => {
			// This test simulates the FIXED scenario:
			// - watchlist fact now only has middesk and business sources
			// - person was REMOVED from watchlist to prevent duplication
			// - Person hits are now ONLY in screened_people fact
			//
			// Previous bug (Elvis Presley duplication):
			// - watchlist had person source (with Elvis hits)
			// - screened_people also had Elvis hits
			// - UI rendered BOTH, showing 2 Elvis cards with different hit counts

			const middeskFact = createMockFact([], "No Watchlist hits were identified", "middesk");

			// Business-level hits from business (not person hits)
			const businessHits = [
				{
					id: "biz-hit-1",
					type: "sanctions",
					metadata: {
						abbr: "OFAC",
						title: "OFAC SDN List",
						agency: "Office of Foreign Assets Control",
						entity_name: "Smith & Associates Consulting" // Business name, not person
					},
					url: "https://ofac.treasury.gov/sanctions",
					list_country: "United States of America"
				}
			];

			const businessFact = createMockFact(businessHits, "Found 1 watchlist hit(s)", "business");

			const result = combineWatchlistMetadata.fn!(null as any, factName, [middeskFact, businessFact])!;

			// Should have 1 business hit (no person hits in watchlist anymore)
			expect(result.value.metadata).toHaveLength(1);
			expect(result.value.metadata[0].metadata.entity_name).toBe("Smith & Associates Consulting");

			// Key validation: result should NOT contain person data (that's in screened_people now)
			const personHits = result.value.metadata.filter(
				(hit: any) => hit.metadata.entity_name === "Elvis Presley"
			);
			expect(personHits).toHaveLength(0);
		});

		it("should demonstrate why person was removed from watchlist (duplication prevention)", () => {
			// This test documents the original bug and why the fix was necessary
			//
			// BEFORE FIX:
			// - watchlist fact had sources: [middesk, business, person]
			// - screened_people fact used: person
			// - SAME data source (person) was used by BOTH facts
			// - UI rendered: watchlist.metadata (86 hits) + screened_people.watchlistHits (93 hits)
			// - Result: 2 cards for "Elvis Presley" with different hit counts
			//
			// AFTER FIX:
			// - watchlist fact has sources: [middesk, business] (NO person)
			// - screened_people fact uses: person
			// - Clear separation: business hits in watchlist, person hits in screened_people
			// - Result: 1 card per person in UI

			const middeskFact = createMockFact([], "No Watchlist hits were identified", "middesk");

			// Business-level watchlist (empty in this case)
			const businessFact = createMockFact([], "No watchlist hits", "business");

			const result = combineWatchlistMetadata.fn!(null as any, factName, [middeskFact, businessFact])!;

			// Watchlist should be empty (no business hits, and person hits are now in screened_people)
			expect(result.value.metadata).toHaveLength(0);
			expect(result.value.message).toBe("No Watchlist hits were identified");

			// This is the expected behavior:
			// - watchlist = business-level hits only
			// - screened_people = person-level hits (rendered separately by UI)
			// - No duplication because each data source is used by ONLY ONE fact
		});
	});

	describe("adverse media filtering", () => {
		it("should exclude adverse_media hits from combined result", () => {
			const factWithMixed = createMockFact(
				[
					{
						id: "hit-1",
						type: "sanctions",
						metadata: { title: "OFAC SDN", entity_name: "Business A" },
						url: "https://example.com/sanctions"
					},
					{
						id: "hit-2",
						type: "adverse_media",
						metadata: { title: "News Article", entity_name: "Business A" },
						url: "https://example.com/adverse"
					},
					{
						id: "hit-3",
						type: "pep",
						metadata: { title: "PEP List", entity_name: "Person A" },
						url: "https://example.com/pep"
					}
				],
				"Found 3 hits",
				"business"
			);

			const result = combineWatchlistMetadata.fn!(null as any, factName, [factWithMixed])!;

			expect(result.value.metadata).toHaveLength(2);
			expect(result.value.metadata.map((h: any) => h.type)).toEqual(["sanctions", "pep"]);
		});

		it("should exclude adverse_media from multiple sources", () => {
			const businessFact = createMockFact(
				[
					{
						id: "hit-1",
						type: "adverse_media",
						metadata: { title: "Negative News", entity_name: "Corp X" },
						url: "https://example.com/news"
					}
				],
				"Found 1 hit",
				"business"
			);

			const personFact = createMockFact(
				[
					{
						id: "hit-2",
						type: "pep",
						metadata: { title: "PEP List", entity_name: "Person Y" },
						url: "https://example.com/pep"
					},
					{
						id: "hit-3",
						type: "adverse_media",
						metadata: { title: "News Report", entity_name: "Person Y" },
						url: "https://example.com/person-news"
					}
				],
				"Found 2 hits",
				"person"
			);

			const result = combineWatchlistMetadata.fn!(null as any, factName, [businessFact, personFact])!;

			expect(result.value.metadata).toHaveLength(1);
			expect(result.value.metadata[0].type).toBe("pep");
		});

		it("should return empty message when all hits are adverse_media", () => {
			const adverseOnlyFact = createMockFact(
				[
					{
						id: "hit-1",
						type: "adverse_media",
						metadata: { title: "AM List", entity_name: "Entity" },
						url: "https://example.com/am"
					}
				],
				"Found 1 hit",
				"business"
			);

			const result = combineWatchlistMetadata.fn!(null as any, factName, [adverseOnlyFact])!;

			expect(result.value.metadata).toHaveLength(0);
			expect(result.value.message).toBe("No Watchlist hits were identified");
		});

		it("should update hit count in message after filtering adverse_media", () => {
			const mixedFact = createMockFact(
				[
					{
						id: "hit-1",
						type: "sanctions",
						metadata: { title: "OFAC", entity_name: "Corp" },
						url: "url1"
					},
					{
						id: "hit-2",
						type: "adverse_media",
						metadata: { title: "News", entity_name: "Corp" },
						url: "url2"
					}
				],
				"No Watchlist hits were identified",
				"business"
			);

			const result = combineWatchlistMetadata.fn!(null as any, factName, [mixedFact])!;

			expect(result.value.metadata).toHaveLength(1);
			expect(result.value.message).toBe("Found 1 consolidated watchlist hit(s)");
		});
	});

	describe("entity_type handling", () => {
		it("should preserve entity_type when combining hits", () => {
			const businessFact = createMockFact(
				[
					{
						id: "hit-1",
						type: "sanctions",
						entity_type: WATCHLIST_ENTITY_TYPE.BUSINESS,
						metadata: { title: "OFAC List", entity_name: "Test Business" },
						url: "https://example.com/hit1"
					}
				],
				"Found 1 hit",
				"business"
			);

			const personFact = createMockFact(
				[
					{
						id: "hit-2",
						type: "pep",
						entity_type: WATCHLIST_ENTITY_TYPE.PERSON,
						metadata: { title: "PEP List", entity_name: "Test Person" },
						url: "https://example.com/hit2"
					}
				],
				"Found 1 hit",
				"person"
			);

			const result = combineWatchlistMetadata.fn!(null as any, factName, [businessFact, personFact])!;

			expect(result.value.metadata).toHaveLength(2);
			expect(result.value.metadata[0].entity_type).toBe(WATCHLIST_ENTITY_TYPE.BUSINESS);
			expect(result.value.metadata[1].entity_type).toBe(WATCHLIST_ENTITY_TYPE.PERSON);
		});

		it("should infer entity_type from source when missing", () => {
			const businessFact = createMockFact(
				[
					{
						id: "hit-1",
						type: "sanctions",
						// Missing entity_type - should infer BUSINESS from business source
						metadata: { title: "OFAC List", entity_name: "Test Business" },
						url: "https://example.com/hit1"
					}
				],
				"Found 1 hit",
				"business"
			);

			const personFact = createMockFact(
				[
					{
						id: "hit-2",
						type: "pep",
						// Missing entity_type - should infer PERSON from person source
						metadata: { title: "PEP List", entity_name: "Test Person" },
						url: "https://example.com/hit2"
					}
				],
				"Found 1 hit",
				"person"
			);

			const result = combineWatchlistMetadata.fn!(null as any, factName, [businessFact, personFact])!;

			expect(result.value.metadata).toHaveLength(2);
			expect(result.value.metadata[0].entity_type).toBe(WATCHLIST_ENTITY_TYPE.BUSINESS);
			expect(result.value.metadata[1].entity_type).toBe(WATCHLIST_ENTITY_TYPE.PERSON);
		});

		it("should default to BUSINESS for non-person sources when entity_type is missing", () => {
			const middeskFact = createMockFact(
				[
					{
						id: "hit-1",
						type: "sanctions",
						// Missing entity_type - should default to BUSINESS for middesk source
						metadata: { title: "OFAC List", entity_name: "Test Business" },
						url: "https://example.com/hit1"
					}
				],
				"Found 1 hit",
				"middesk"
			);

			const result = combineWatchlistMetadata.fn!(null as any, factName, [middeskFact])!;

			expect(result.value.metadata).toHaveLength(1);
			expect(result.value.metadata[0].entity_type).toBe(WATCHLIST_ENTITY_TYPE.BUSINESS);
		});

		it("should preserve entity_type when deduplicating hits", () => {
			const businessFact = createMockFact(
				[
					{
						id: "hit-1",
						type: "sanctions",
						entity_type: WATCHLIST_ENTITY_TYPE.BUSINESS,
						metadata: { title: "OFAC List", entity_name: "Test Business" },
						url: "https://example.com/hit1"
					}
				],
				"Found 1 hit",
				"business"
			);

			const duplicateBusinessFact = createMockFact(
				[
					{
						id: "hit-1-duplicate",
						type: "sanctions",
						entity_type: WATCHLIST_ENTITY_TYPE.BUSINESS,
						metadata: { title: "OFAC List", entity_name: "Test Business" },
						url: "https://example.com/hit1" // Same URL = duplicate
					}
				],
				"Found 1 hit",
				"middesk"
			);

			const result = combineWatchlistMetadata.fn!(null as any, factName, [businessFact, duplicateBusinessFact])!;

			// Should deduplicate but preserve entity_type
			expect(result.value.metadata).toHaveLength(1);
			expect(result.value.metadata[0].entity_type).toBe(WATCHLIST_ENTITY_TYPE.BUSINESS);
		});

		it("should handle hits with mixed entity_types from same source", () => {
			const factWithMixedTypes = createMockFact(
				[
					{
						id: "hit-1",
						type: "sanctions",
						entity_type: WATCHLIST_ENTITY_TYPE.BUSINESS,
						metadata: { title: "OFAC List", entity_name: "Business Entity" },
						url: "https://example.com/hit1"
					},
					{
						id: "hit-2",
						type: "pep",
						entity_type: WATCHLIST_ENTITY_TYPE.PERSON,
						metadata: { title: "PEP List", entity_name: "Person Entity" },
						url: "https://example.com/hit2"
					}
				],
				"Found 2 hits",
				"business"
			);

			const result = combineWatchlistMetadata.fn!(null as any, factName, [factWithMixedTypes])!;

			expect(result.value.metadata).toHaveLength(2);
			expect(result.value.metadata[0].entity_type).toBe(WATCHLIST_ENTITY_TYPE.BUSINESS);
			expect(result.value.metadata[1].entity_type).toBe(WATCHLIST_ENTITY_TYPE.PERSON);
		});

		it("should handle unknown source names", () => {
			const unknownSourceFact = createMockFact(
				[
					{
						id: "hit-1",
						type: "sanctions",
						// Missing entity_type - should default to BUSINESS for unknown source
						metadata: { title: "OFAC List", entity_name: "Test Entity" },
						url: "https://example.com/hit1"
					}
				],
				"Found 1 hit",
				"unknownSource"
			);

			const result = combineWatchlistMetadata.fn!(null as any, factName, [unknownSourceFact])!;

			expect(result.value.metadata).toHaveLength(1);
			expect(result.value.metadata[0].entity_type).toBe(WATCHLIST_ENTITY_TYPE.BUSINESS);
		});

		it("should handle null entity_type values", () => {
			const factWithNullEntityType = createMockFact(
				[
					{
						id: "hit-1",
						type: "sanctions",
						entity_type: null as any,
						metadata: { title: "OFAC List", entity_name: "Test Entity" },
						url: "https://example.com/hit1"
					}
				],
				"Found 1 hit",
				"business"
			);

			const result = combineWatchlistMetadata.fn!(null as any, factName, [factWithNullEntityType])!;

			expect(result.value.metadata).toHaveLength(1);
			expect(result.value.metadata[0].entity_type).toBe(WATCHLIST_ENTITY_TYPE.BUSINESS);
		});

		it("should handle empty string entity_type", () => {
			const factWithEmptyEntityType = createMockFact(
				[
					{
						id: "hit-1",
						type: "sanctions",
						entity_type: "" as any,
						metadata: { title: "OFAC List", entity_name: "Test Entity" },
						url: "https://example.com/hit1"
					}
				],
				"Found 1 hit",
				"person"
			);

			const result = combineWatchlistMetadata.fn!(null as any, factName, [factWithEmptyEntityType])!;

			expect(result.value.metadata).toHaveLength(1);
			// Empty string is falsy, so should infer from source (person = PERSON)
			expect(result.value.metadata[0].entity_type).toBe(WATCHLIST_ENTITY_TYPE.PERSON);
		});
	});
});
