import {
	createWatchlistDedupKey,
	transformTruliooHitToWatchlistMetadata,
	extractWatchlistHitsFromScreenedPeople,
	deduplicateWatchlistHits,
	ensureBusinessEntityType,
	transformTruliooBusinessWatchlistResults,
	filterOutAdverseMedia
} from "../watchlistHelpers";
import type { TruliooRawWatchlistHit } from "../watchlistHelpers";
import type { WatchlistValueMetadatum } from "../types";
import { WATCHLIST_ENTITY_TYPE } from "../types";
import type { TruliooWatchlistHit, TruliooScreenedPersonData } from "#lib/trulioo/common/types";

describe("watchlistHelpers", () => {
	describe("createWatchlistDedupKey", () => {
		it("should create a deduplication key from title, agency, and entity_name", () => {
			const hit: WatchlistValueMetadatum = {
				id: "test-id",
				type: "sanctions",
				metadata: {
					abbr: "OFAC",
					title: "OFAC Sanctions List",
					agency: "Office of Foreign Assets Control",
					agency_abbr: "OFAC",
					entity_name: "Test Entity"
				}
			};

			const key = createWatchlistDedupKey(hit);
			expect(key).toBe("ofac sanctions list::office of foreign assets control::test entity");
		});

		it("should handle missing title, agency, and entity_name", () => {
			const hit: WatchlistValueMetadatum = {
				id: "test-id",
				type: "sanctions",
				metadata: {
					abbr: "",
					title: "",
					agency: "",
					agency_abbr: "",
					entity_name: ""
				}
			};

			const key = createWatchlistDedupKey(hit);
			expect(key).toBe("::::");
		});

		it("should trim whitespace and convert to lowercase", () => {
			const hit: WatchlistValueMetadatum = {
				id: "test-id",
				type: "sanctions",
				metadata: {
					abbr: "OFAC",
					title: "  OFAC SANCTIONS LIST  ",
					agency: "  Office of Foreign Assets Control  ",
					agency_abbr: "OFAC",
					entity_name: "  Test Entity  "
				}
			};

			const key = createWatchlistDedupKey(hit);
			expect(key).toBe("ofac sanctions list::office of foreign assets control::test entity");
		});

		it("should produce different keys for different entities on the same list+agency", () => {
			const hitA: WatchlistValueMetadatum = {
				id: "hit-a",
				type: "watchlist_result",
				metadata: {
					abbr: "SDN",
					title: "Specially Designated Nationals",
					agency: "Office of Foreign Assets Control",
					agency_abbr: "OFAC",
					entity_name: "BARCO SHIP MANAGEMENT INC"
				}
			};
			const hitB: WatchlistValueMetadatum = {
				id: "hit-b",
				type: "watchlist_result",
				metadata: {
					abbr: "SDN",
					title: "Specially Designated Nationals",
					agency: "Office of Foreign Assets Control",
					agency_abbr: "OFAC",
					entity_name: "CLIO MANAGEMENT CORP."
				}
			};

			expect(createWatchlistDedupKey(hitA)).not.toBe(createWatchlistDedupKey(hitB));
		});

		it("should produce the same key for the exact same entity on the same list (true duplicate)", () => {
			const hitA: WatchlistValueMetadatum = {
				id: "hit-1",
				type: "watchlist_result",
				metadata: {
					abbr: "SDN",
					title: "Specially Designated Nationals",
					agency: "Office of Foreign Assets Control",
					agency_abbr: "OFAC",
					entity_name: "BARCO SHIP MANAGEMENT INC"
				}
			};
			const hitB: WatchlistValueMetadatum = {
				id: "hit-2",
				type: "watchlist_result",
				metadata: {
					abbr: "SDN",
					title: "Specially Designated Nationals",
					agency: "Office of Foreign Assets Control",
					agency_abbr: "OFAC",
					entity_name: "BARCO SHIP MANAGEMENT INC"
				}
			};

			expect(createWatchlistDedupKey(hitA)).toBe(createWatchlistDedupKey(hitB));
		});
	});

	describe("transformTruliooHitToWatchlistMetadata", () => {
		it("should transform TruliooWatchlistHit to WatchlistValueMetadatum", () => {
			const hit: TruliooWatchlistHit = {
				listType: "SANCTIONS",
				listName: "OFAC Sanctions List",
				confidence: 95,
				matchDetails: "Test Entity",
				url: "https://example.com/hit",
				sourceAgencyName: "Office of Foreign Assets Control",
				sourceRegion: "US",
				listCountry: "US"
			};

			const result = transformTruliooHitToWatchlistMetadata(hit, "Test Entity");

			expect(result.type).toBe("sanctions");
			expect(result.metadata.title).toBe("OFAC Sanctions List");
			expect(result.metadata.agency).toBe("Office of Foreign Assets Control");
			expect(result.metadata.entity_name).toBe("Test Entity");
			expect(result.url).toBe("https://example.com/hit");
			expect(result.list_country).toBe("US");
			expect(result.list_region).toBe("US");
			expect(result.id).toBeDefined();
		});

		it("should use listName as fallback for agency when sourceAgencyName is missing", () => {
			const hit: TruliooWatchlistHit = {
				listType: "PEP",
				listName: "PEP List",
				confidence: 90,
				matchDetails: "John Doe"
			};

			const result = transformTruliooHitToWatchlistMetadata(hit, "John Doe");

			expect(result.metadata.agency).toBe("PEP List");
			expect(result.metadata.title).toBe("PEP List");
		});

		it("should use listType as fallback for title when listName is missing", () => {
			const hit: TruliooWatchlistHit = {
				listType: "ADVERSE_MEDIA",
				listName: "",
				confidence: 85,
				matchDetails: "Jane Smith"
			};

			const result = transformTruliooHitToWatchlistMetadata(hit, "Jane Smith");

			expect(result.metadata.title).toBe("ADVERSE_MEDIA");
		});

		it("should generate agency abbreviation from sourceAgencyName", () => {
			const hit: TruliooWatchlistHit = {
				listType: "SANCTIONS",
				listName: "EU Sanctions",
				confidence: 90,
				matchDetails: "Test",
				sourceAgencyName: "European Union Commission"
			};

			const result = transformTruliooHitToWatchlistMetadata(hit, "Test");

			// Abbreviation is limited to 10 characters: "European Union Commission" -> "EUC" (first letter of each word, then substring(0, 10))
			// E + U + C = "EUC" (3 chars, substring doesn't affect)
			expect(result.metadata.abbr).toBe("EUC");
			expect(result.metadata.agency_abbr).toBe("EUC");
		});

		it("should handle null/undefined values gracefully", () => {
			const hit: TruliooWatchlistHit = {
				listType: "SANCTIONS",
				listName: "Test List",
				confidence: 0,
				matchDetails: ""
			};

			const result = transformTruliooHitToWatchlistMetadata(hit, "Test Entity");

			expect(result.url).toBeNull();
			expect(result.list_country).toBeNull();
			expect(result.list_region).toBeNull();
		});

		it("should use BUSINESS entity_type by default", () => {
			const hit: TruliooWatchlistHit = {
				listType: "SANCTIONS",
				listName: "Test List",
				confidence: 95,
				matchDetails: "Test Entity"
			};

			const result = transformTruliooHitToWatchlistMetadata(hit, "Test Entity");

			expect(result.entity_type).toBe(WATCHLIST_ENTITY_TYPE.BUSINESS);
		});

		it("should use PERSON entity_type when explicitly provided", () => {
			const hit: TruliooWatchlistHit = {
				listType: "PEP",
				listName: "PEP List",
				confidence: 95,
				matchDetails: "John Doe"
			};

			const result = transformTruliooHitToWatchlistMetadata(hit, "John Doe", WATCHLIST_ENTITY_TYPE.PERSON);

			expect(result.entity_type).toBe(WATCHLIST_ENTITY_TYPE.PERSON);
		});
	});

	describe("extractWatchlistHitsFromScreenedPeople", () => {
		it("should extract watchlist hits from screened people with entity_type PERSON", () => {
			const screenedPeople: TruliooScreenedPersonData[] = [
				{
					fullName: "John Doe",
					firstName: "John",
					lastName: "Doe",
					dateOfBirth: "1980-01-01",
					addressLine1: "123 Main St",
					city: "New York",
					postalCode: "10001",
					country: "US",
					controlType: "UBO",
					screeningStatus: "completed",
					screeningResults: {
						watchlistHits: [
							{
								listType: "PEP",
								listName: "PEP List",
								confidence: 95,
								matchDetails: "John Doe",
								sourceAgencyName: "World Check"
							} as TruliooWatchlistHit
						]
					}
				} as TruliooScreenedPersonData
			];

			const result = extractWatchlistHitsFromScreenedPeople(screenedPeople);

			expect(result).toHaveLength(1);
			expect(result[0].metadata.entity_name).toBe("John Doe");
			expect(result[0].type).toBe("pep");
			expect(result[0].entity_type).toBe(WATCHLIST_ENTITY_TYPE.PERSON);
		});

		it("should construct name from firstName and lastName when fullName is missing", () => {
			const screenedPeople: TruliooScreenedPersonData[] = [
				{
					firstName: "Jane",
					lastName: "Smith",
					dateOfBirth: "1985-05-15",
					addressLine1: "456 Oak Ave",
					city: "London",
					postalCode: "SW1A 1AA",
					country: "GB",
					controlType: "DIRECTOR",
					screeningStatus: "completed",
					screeningResults: {
						watchlistHits: [
							{
								listType: "SANCTIONS",
								listName: "EU Sanctions",
								confidence: 90,
								matchDetails: "Jane Smith"
							} as TruliooWatchlistHit
						]
					}
				} as TruliooScreenedPersonData
			];

			const result = extractWatchlistHitsFromScreenedPeople(screenedPeople);

			expect(result).toHaveLength(1);
			expect(result[0].metadata.entity_name).toBe("Jane Smith");
			expect(result[0].entity_type).toBe(WATCHLIST_ENTITY_TYPE.PERSON);
		});

		it("should skip people without names", () => {
			const screenedPeople: TruliooScreenedPersonData[] = [
				{
					firstName: "",
					lastName: "",
					dateOfBirth: "1990-01-01",
					addressLine1: "111 Test St",
					city: "Test City",
					postalCode: "12345",
					country: "US",
					controlType: "UBO",
					screeningStatus: "completed",
					screeningResults: {
						watchlistHits: [
							{
								listType: "PEP",
								listName: "PEP List",
								confidence: 95,
								matchDetails: ""
							} as TruliooWatchlistHit
						]
					}
				} as TruliooScreenedPersonData,
				{
					fullName: "Valid Person",
					dateOfBirth: "1991-02-02",
					addressLine1: "222 Test Ave",
					city: "Test Town",
					postalCode: "54321",
					country: "US",
					controlType: "DIRECTOR",
					screeningStatus: "completed",
					screeningResults: {
						watchlistHits: [
							{
								listType: "PEP",
								listName: "PEP List",
								confidence: 95,
								matchDetails: "Valid Person"
							} as TruliooWatchlistHit
						]
					}
				} as TruliooScreenedPersonData
			];

			const result = extractWatchlistHitsFromScreenedPeople(screenedPeople);

			expect(result).toHaveLength(1);
			expect(result[0].metadata.entity_name).toBe("Valid Person");
		});

		it("should skip people without watchlist hits", () => {
			const screenedPeople: TruliooScreenedPersonData[] = [
				{
					fullName: "Person With Hits",
					dateOfBirth: "1990-01-01",
					addressLine1: "111 Test St",
					city: "Test City",
					postalCode: "12345",
					country: "US",
					controlType: "UBO",
					screeningStatus: "completed",
					screeningResults: {
						watchlistHits: [
							{
								listType: "PEP",
								listName: "PEP List",
								confidence: 95,
								matchDetails: "Person With Hits"
							} as TruliooWatchlistHit
						]
					}
				} as TruliooScreenedPersonData,
				{
					fullName: "Person Without Hits",
					firstName: "Person",
					lastName: "Without Hits",
					dateOfBirth: "1991-02-02",
					addressLine1: "222 Test Ave",
					city: "Test Town",
					postalCode: "54321",
					country: "US",
					controlType: "DIRECTOR",
					screeningStatus: "completed",
					screeningResults: {
						watchlistHits: []
					}
				} as TruliooScreenedPersonData
			];

			const result = extractWatchlistHitsFromScreenedPeople(screenedPeople);

			expect(result).toHaveLength(1);
			expect(result[0].metadata.entity_name).toBe("Person With Hits");
		});

		it("should handle multiple hits per person with entity_type PERSON", () => {
			const screenedPeople: TruliooScreenedPersonData[] = [
				{
					fullName: "John Doe",
					dateOfBirth: "1980-01-01",
					addressLine1: "123 Main St",
					city: "New York",
					postalCode: "10001",
					country: "US",
					controlType: "UBO",
					screeningStatus: "completed",
					screeningResults: {
						watchlistHits: [
							{
								listType: "PEP",
								listName: "PEP List",
								confidence: 95,
								matchDetails: "John Doe"
							} as TruliooWatchlistHit,
							{
								listType: "SANCTIONS",
								listName: "OFAC",
								confidence: 90,
								matchDetails: "John Doe"
							} as TruliooWatchlistHit
						]
					}
				} as TruliooScreenedPersonData
			];

			const result = extractWatchlistHitsFromScreenedPeople(screenedPeople);

			expect(result).toHaveLength(2);
			expect(result[0].type).toBe("pep");
			expect(result[0].entity_type).toBe(WATCHLIST_ENTITY_TYPE.PERSON);
			expect(result[1].type).toBe("sanctions");
			expect(result[1].entity_type).toBe(WATCHLIST_ENTITY_TYPE.PERSON);
		});

		it("should return empty array when no screened people provided", () => {
			const result = extractWatchlistHitsFromScreenedPeople([]);
			expect(result).toHaveLength(0);
		});

		it("should handle people with undefined screeningResults", () => {
			const screenedPeople: TruliooScreenedPersonData[] = [
				{
					fullName: "Person Without Results",
					firstName: "Person",
					lastName: "Without Results",
					dateOfBirth: "1990-01-01",
					addressLine1: "",
					city: "",
					postalCode: "",
					country: "AU",
					controlType: "UBO",
					screeningStatus: "completed"
				} as TruliooScreenedPersonData
			];

			const result = extractWatchlistHitsFromScreenedPeople(screenedPeople);
			expect(result).toHaveLength(0);
		});

		it("should handle multiple people with mixed hits and ensure all are PERSON type", () => {
			const screenedPeople: TruliooScreenedPersonData[] = [
				{
					fullName: "Director AU",
					dateOfBirth: "1975-06-15",
					addressLine1: "1 George St",
					city: "Sydney",
					postalCode: "2000",
					country: "AU",
					controlType: "DIRECTOR",
					screeningStatus: "completed",
					screeningResults: {
						watchlistHits: [
							{ listType: "PEP", listName: "AU PEP List", confidence: 85, matchDetails: "Director AU" } as TruliooWatchlistHit
						]
					}
				} as TruliooScreenedPersonData,
				{
					fullName: "UBO NZ",
					dateOfBirth: "1982-03-10",
					addressLine1: "22 Queen St",
					city: "Auckland",
					postalCode: "1010",
					country: "NZ",
					controlType: "UBO",
					screeningStatus: "completed",
					screeningResults: {
						watchlistHits: [
							{ listType: "SANCTIONS", listName: "NZ Sanctions", confidence: 92, matchDetails: "UBO NZ" } as TruliooWatchlistHit,
							{ listType: "PEP", listName: "NZ PEP", confidence: 78, matchDetails: "UBO NZ" } as TruliooWatchlistHit
						]
					}
				} as TruliooScreenedPersonData
			];

			const result = extractWatchlistHitsFromScreenedPeople(screenedPeople);

			expect(result).toHaveLength(3);
			result.forEach(hit => {
				expect(hit.entity_type).toBe(WATCHLIST_ENTITY_TYPE.PERSON);
			});
			expect(result[0].metadata.entity_name).toBe("Director AU");
			expect(result[1].metadata.entity_name).toBe("UBO NZ");
			expect(result[2].metadata.entity_name).toBe("UBO NZ");
		});
	});

	describe("deduplicateWatchlistHits", () => {
		it("should preserve different entities from the same list and agency", () => {
			const hits: WatchlistValueMetadatum[] = [
				{
					id: "hit-1",
					type: "sanctions",
					metadata: {
						title: "OFAC Sanctions",
						agency: "OFAC",
						abbr: "OFAC",
						agency_abbr: "OFAC",
						entity_name: "Entity One"
					}
				},
				{
					id: "hit-2",
					type: "sanctions",
					metadata: {
						title: "OFAC Sanctions",
						agency: "OFAC",
						abbr: "OFAC",
						agency_abbr: "OFAC",
						entity_name: "Entity Two"
					}
				},
				{
					id: "hit-3",
					type: "pep",
					metadata: {
						title: "PEP List",
						agency: "World Check",
						abbr: "WC",
						agency_abbr: "WC",
						entity_name: "Entity Three"
					}
				}
			];

			const result = deduplicateWatchlistHits(hits);

			expect(result).toHaveLength(3);
			expect(result[0].id).toBe("hit-1");
			expect(result[1].id).toBe("hit-2");
			expect(result[2].id).toBe("hit-3");
		});

		it("should remove true duplicates (same list, agency, and entity_name)", () => {
			const hits: WatchlistValueMetadatum[] = [
				{
					id: "hit-1",
					type: "sanctions",
					metadata: {
						title: "OFAC Sanctions",
						agency: "OFAC",
						abbr: "OFAC",
						agency_abbr: "OFAC",
						entity_name: "Same Entity"
					}
				},
				{
					id: "hit-2",
					type: "sanctions",
					metadata: {
						title: "OFAC Sanctions",
						agency: "OFAC",
						abbr: "OFAC",
						agency_abbr: "OFAC",
						entity_name: "Same Entity"
					}
				}
			];

			const result = deduplicateWatchlistHits(hits);

			expect(result).toHaveLength(1);
			expect(result[0].id).toBe("hit-1");
		});

		it("should preserve hits with different titles", () => {
			const hits: WatchlistValueMetadatum[] = [
				{
					id: "hit-1",
					type: "sanctions",
					metadata: {
						title: "OFAC Sanctions",
						agency: "OFAC",
						abbr: "OFAC",
						agency_abbr: "OFAC",
						entity_name: "Entity One"
					}
				},
				{
					id: "hit-2",
					type: "sanctions",
					metadata: {
						title: "EU Sanctions",
						agency: "EU Commission",
						abbr: "EC",
						agency_abbr: "EC",
						entity_name: "Entity Two"
					}
				}
			];

			const result = deduplicateWatchlistHits(hits);

			expect(result).toHaveLength(2);
		});

		it("should preserve hits with different agencies", () => {
			const hits: WatchlistValueMetadatum[] = [
				{
					id: "hit-1",
					type: "sanctions",
					metadata: {
						title: "Sanctions List",
						agency: "OFAC",
						abbr: "OFAC",
						agency_abbr: "OFAC",
						entity_name: "Entity One"
					}
				},
				{
					id: "hit-2",
					type: "sanctions",
					metadata: {
						title: "Sanctions List",
						agency: "EU Commission",
						abbr: "EC",
						agency_abbr: "EC",
						entity_name: "Entity Two"
					}
				}
			];

			const result = deduplicateWatchlistHits(hits);

			expect(result).toHaveLength(2);
		});

		it("should handle empty array", () => {
			const result = deduplicateWatchlistHits([]);
			expect(result).toHaveLength(0);
		});

		it("should handle case-insensitive deduplication for true duplicates", () => {
			const hits: WatchlistValueMetadatum[] = [
				{
					id: "hit-1",
					type: "sanctions",
					metadata: {
						title: "OFAC Sanctions",
						agency: "OFAC",
						abbr: "OFAC",
						agency_abbr: "OFAC",
						entity_name: "SAME ENTITY"
					}
				},
				{
					id: "hit-2",
					type: "sanctions",
					metadata: {
						title: "ofac sanctions",
						agency: "ofac",
						abbr: "OFAC",
						agency_abbr: "OFAC",
						entity_name: "same entity"
					}
				}
			];

			const result = deduplicateWatchlistHits(hits);

			expect(result).toHaveLength(1);
		});

		it("should preserve all 16 Middesk hits like the Skinsation LA production case (BTT-184)", () => {
			const middeskHits: WatchlistValueMetadatum[] = [
				{ id: "1", type: "watchlist_result", metadata: { abbr: "DPL", title: "Denied Persons List", agency: "Bureau of Industry and Security", agency_abbr: "BIS", entity_name: "SWISSCO MANAGEMENT GROUP, INC" } },
				{ id: "2", type: "watchlist_result", metadata: { abbr: "DPL", title: "Denied Persons List", agency: "Bureau of Industry and Security", agency_abbr: "BIS", entity_name: "LAND RESOURCES MANAGEMENT INC." } },
				{ id: "3", type: "watchlist_result", metadata: { abbr: "DPL", title: "Denied Persons List", agency: "Bureau of Industry and Security", agency_abbr: "BIS", entity_name: "FACILITIES MANAGEMENT, LTD" } },
				{ id: "4", type: "watchlist_result", metadata: { abbr: "DTC", title: "AECA/ITAR Debarred", agency: "Directorate of Defense Trade Controls", agency_abbr: "DDTC", entity_name: "Swissco Management Group, Inc." } },
				{ id: "5", type: "watchlist_result", metadata: { abbr: "EL", title: "Entity List", agency: "Bureau of Industry and Security", agency_abbr: "BIS", entity_name: "Sovfracht Managing Company, LLC" } },
				{ id: "6", type: "watchlist_result", metadata: { abbr: "SDN", title: "Specially Designated Nationals", agency: "Office of Foreign Assets Control", agency_abbr: "OFAC", entity_name: "PROPER IN MANAGEMENT INCORPORATED" } },
				{ id: "7", type: "watchlist_result", metadata: { abbr: "SDN", title: "Specially Designated Nationals", agency: "Office of Foreign Assets Control", agency_abbr: "OFAC", entity_name: "BARCO SHIP MANAGEMENT INC" } },
				{ id: "8", type: "watchlist_result", metadata: { abbr: "SDN", title: "Specially Designated Nationals", agency: "Office of Foreign Assets Control", agency_abbr: "OFAC", entity_name: "AO ABR MANAGEMENT" } },
				{ id: "9", type: "watchlist_result", metadata: { abbr: "SDN", title: "Specially Designated Nationals", agency: "Office of Foreign Assets Control", agency_abbr: "OFAC", entity_name: "OOO BILDING MENEDZHMENT" } },
				{ id: "10", type: "watchlist_result", metadata: { abbr: "SDN", title: "Specially Designated Nationals", agency: "Office of Foreign Assets Control", agency_abbr: "OFAC", entity_name: "LIMITED LIABILITY COMPANY KASPIYSKAYA ENERGIYA ADMINISTRATION OFFICE" } },
				{ id: "11", type: "watchlist_result", metadata: { abbr: "SDN", title: "Specially Designated Nationals", agency: "Office of Foreign Assets Control", agency_abbr: "OFAC", entity_name: "SOVFRACHT MANAGING COMPANY LLC" } },
				{ id: "12", type: "watchlist_result", metadata: { abbr: "SDN", title: "Specially Designated Nationals", agency: "Office of Foreign Assets Control", agency_abbr: "OFAC", entity_name: "POCHON SHIPPING & MANAGEMENT" } },
				{ id: "13", type: "watchlist_result", metadata: { abbr: "SDN", title: "Specially Designated Nationals", agency: "Office of Foreign Assets Control", agency_abbr: "OFAC", entity_name: "SONGWON SHIPPING & MANAGEMENT" } },
				{ id: "14", type: "watchlist_result", metadata: { abbr: "SDN", title: "Specially Designated Nationals", agency: "Office of Foreign Assets Control", agency_abbr: "OFAC", entity_name: "CLIO MANAGEMENT CORP." } },
				{ id: "15", type: "watchlist_result", metadata: { abbr: "SDN", title: "Specially Designated Nationals", agency: "Office of Foreign Assets Control", agency_abbr: "OFAC", entity_name: "GMCS MANAGEMENT LIMITED LIABILITY COMPANY" } },
				{ id: "16", type: "watchlist_result", metadata: { abbr: "SSI", title: "Sectoral Sanctions Identifications", agency: "Office of Foreign Assets Control", agency_abbr: "OFAC", entity_name: "RUSSIAN DIRECT INVESTMENT FUND MANAGEMENT COMPANY" } }
			];

			const result = deduplicateWatchlistHits(middeskHits);

			expect(result).toHaveLength(16);
		});
	});

	describe("ensureBusinessEntityType", () => {
		it("should ensure all hits have entity_type BUSINESS for legacy data", () => {
			const hits: WatchlistValueMetadatum[] = [
				{
					id: "hit-1",
					type: "sanctions",
					// Missing entity_type (legacy data) - should default to BUSINESS
					metadata: {
						abbr: "OFAC",
						title: "OFAC Sanctions",
						agency: "OFAC",
						agency_abbr: "OFAC",
						entity_name: "Test Entity"
					}
				},
				{
					id: "hit-2",
					type: "pep",
					// Missing entity_type (legacy data) - should default to BUSINESS
					metadata: {
						abbr: "WC",
						title: "PEP List",
						agency: "World Check",
						agency_abbr: "WC",
						entity_name: "Test Person"
					}
				}
			];

			const result = ensureBusinessEntityType(hits);

			expect(result).toHaveLength(2);
			expect(result[0].entity_type).toBe(WATCHLIST_ENTITY_TYPE.BUSINESS);
			expect(result[1].entity_type).toBe(WATCHLIST_ENTITY_TYPE.BUSINESS);
		});

		it("should preserve existing BUSINESS entity_type", () => {
			const hits: WatchlistValueMetadatum[] = [
				{
					id: "hit-1",
					type: "sanctions",
					entity_type: WATCHLIST_ENTITY_TYPE.BUSINESS,
					metadata: {
						abbr: "OFAC",
						title: "OFAC Sanctions",
						agency: "OFAC",
						agency_abbr: "OFAC",
						entity_name: "Test Entity"
					}
				}
			];

			const result = ensureBusinessEntityType(hits);

			expect(result).toHaveLength(1);
			expect(result[0].entity_type).toBe(WATCHLIST_ENTITY_TYPE.BUSINESS);
		});

		it("should return empty array for undefined input", () => {
			const result = ensureBusinessEntityType(undefined);
			expect(result).toHaveLength(0);
		});

		it("should return empty array for null input", () => {
			const result = ensureBusinessEntityType(null);
			expect(result).toHaveLength(0);
		});

		it("should return empty array for non-array input", () => {
			const result = ensureBusinessEntityType({} as any);
			expect(result).toHaveLength(0);
		});

		it("should handle empty array", () => {
			const result = ensureBusinessEntityType([]);
			expect(result).toHaveLength(0);
		});

		it("should preserve existing entity_type if already set", () => {
			const hits: WatchlistValueMetadatum[] = [
				{
					id: "hit-1",
					type: "sanctions",
					entity_type: WATCHLIST_ENTITY_TYPE.BUSINESS, // Already set correctly
					metadata: {
						abbr: "OFAC",
						title: "OFAC Sanctions",
						agency: "OFAC",
						agency_abbr: "OFAC",
						entity_name: "Test Entity"
					}
				},
				{
					id: "hit-2",
					type: "pep",
					// Missing entity_type - should default to BUSINESS
					metadata: {
						abbr: "WC",
						title: "PEP List",
						agency: "World Check",
						agency_abbr: "WC",
						entity_name: "Test Person"
					}
				}
			];

			const result = ensureBusinessEntityType(hits);

			expect(result).toHaveLength(2);
			expect(result[0].entity_type).toBe(WATCHLIST_ENTITY_TYPE.BUSINESS);
			expect(result[1].entity_type).toBe(WATCHLIST_ENTITY_TYPE.BUSINESS);
		});

		it("should preserve all other hit properties", () => {
			const hits: WatchlistValueMetadatum[] = [
				{
					id: "hit-1",
					type: "pep",
					entity_type: WATCHLIST_ENTITY_TYPE.BUSINESS, // Already set correctly
					metadata: {
						abbr: "WC",
						title: "PEP List",
						agency: "World Check",
						agency_abbr: "WC",
						entity_name: "Test Person"
					},
					url: "https://example.com/hit",
					list_country: "US",
					list_region: "US"
				}
			];

			const result = ensureBusinessEntityType(hits);

			expect(result).toHaveLength(1);
			expect(result[0].id).toBe("hit-1");
			expect(result[0].type).toBe("pep");
			expect(result[0].metadata.entity_name).toBe("Test Person");
			expect(result[0].url).toBe("https://example.com/hit");
			expect(result[0].list_country).toBe("US");
			expect(result[0].list_region).toBe("US");
			expect(result[0].entity_type).toBe(WATCHLIST_ENTITY_TYPE.BUSINESS);
		});
	});

	describe("transformTruliooBusinessWatchlistResults", () => {
		it("should transform raw Trulioo watchlist results to WatchlistValueMetadatum", () => {
			const rawResults: TruliooRawWatchlistHit[] = [
				{
					id: "hit-1",
					listType: "SANCTIONS",
					listName: "OFAC Sanctions List",
					matchDetails: "Test Business",
					sourceAgencyName: "Office of Foreign Assets Control",
					sourceRegion: "US",
					listCountry: "US",
					url: "https://example.com/hit"
				},
				{
					listType: "PEP",
					listName: "PEP List",
					matchDetails: "Another Business",
					sourceAgencyName: "World Check"
				}
			];

			const result = transformTruliooBusinessWatchlistResults(rawResults);

			expect(result).toHaveLength(2);
			expect(result[0].id).toBe("hit-1");
			expect(result[0].type).toBe("sanctions");
			expect(result[0].entity_type).toBe(WATCHLIST_ENTITY_TYPE.BUSINESS);
			expect(result[0].metadata.title).toBe("OFAC Sanctions List");
			expect(result[0].metadata.entity_name).toBe("Test Business");
			expect(result[0].url).toBe("https://example.com/hit");
			expect(result[0].list_country).toBe("US");
			expect(result[0].list_region).toBe("US");

			expect(result[1].entity_type).toBe(WATCHLIST_ENTITY_TYPE.BUSINESS);
			expect(result[1].type).toBe("pep");
			expect(result[1].metadata.entity_name).toBe("Another Business");
		});

		it("should generate ID when missing", () => {
			const rawResults: TruliooRawWatchlistHit[] = [
				{
					listType: "SANCTIONS",
					listName: "Test List",
					matchDetails: "Test Entity"
				}
			];

			const result = transformTruliooBusinessWatchlistResults(rawResults);

			expect(result[0].id).toBeDefined();
			// ID format: "SANCTIONS-Test List-{timestamp}-{random}"
			expect(result[0].id).toContain("SANCTIONS");
			expect(result[0].id).toContain("Test List");
		});

		it("should handle missing optional fields", () => {
			const rawResults: TruliooRawWatchlistHit[] = [
				{
					listType: "SANCTIONS",
					listName: "Test List",
					matchDetails: "Test Entity"
				}
			];

			const result = transformTruliooBusinessWatchlistResults(rawResults);

			expect(result[0].url).toBeNull();
			expect(result[0].list_country).toBeNull();
			expect(result[0].list_region).toBeNull();
		});

		it("should generate agency abbreviation from sourceAgencyName", () => {
			const rawResults: TruliooRawWatchlistHit[] = [
				{
					listType: "SANCTIONS",
					listName: "Test List",
					matchDetails: "Test Entity",
					sourceAgencyName: "European Union Commission"
				}
			];

			const result = transformTruliooBusinessWatchlistResults(rawResults);

			expect(result[0].metadata.abbr).toBe("EUC");
			expect(result[0].metadata.agency_abbr).toBe("EUC");
		});

		it("should use sourceListType as fallback for title", () => {
			const rawResults: TruliooRawWatchlistHit[] = [
				{
					listType: "SANCTIONS",
					sourceListType: "EU Sanctions",
					matchDetails: "Test Entity"
				}
			];

			const result = transformTruliooBusinessWatchlistResults(rawResults);

			expect(result[0].metadata.title).toBe("EU Sanctions");
		});

		it("should default to 'sanctions' when listType is missing", () => {
			const rawResults: TruliooRawWatchlistHit[] = [
				{
					listName: "Test List",
					matchDetails: "Test Entity"
				}
			];

			const result = transformTruliooBusinessWatchlistResults(rawResults);

			expect(result[0].type).toBe("sanctions");
		});
	});

	describe("ensureBusinessEntityType", () => {
		it("should ensure all hits have entity_type BUSINESS for legacy data", () => {
			const hits: WatchlistValueMetadatum[] = [
				{
					id: "hit-1",
					type: "sanctions",
					// Missing entity_type (legacy data) - should default to BUSINESS
					metadata: {
						abbr: "OFAC",
						title: "OFAC Sanctions",
						agency: "OFAC",
						agency_abbr: "OFAC",
						entity_name: "Test Entity"
					}
				},
				{
					id: "hit-2",
					type: "pep",
					// Missing entity_type (legacy data) - should default to BUSINESS
					metadata: {
						abbr: "WC",
						title: "PEP List",
						agency: "World Check",
						agency_abbr: "WC",
						entity_name: "Test Person"
					}
				}
			];

			const result = ensureBusinessEntityType(hits);

			expect(result).toHaveLength(2);
			expect(result[0].entity_type).toBe(WATCHLIST_ENTITY_TYPE.BUSINESS);
			expect(result[1].entity_type).toBe(WATCHLIST_ENTITY_TYPE.BUSINESS);
		});

		it("should preserve existing BUSINESS entity_type", () => {
			const hits: WatchlistValueMetadatum[] = [
				{
					id: "hit-1",
					type: "sanctions",
					entity_type: WATCHLIST_ENTITY_TYPE.BUSINESS,
					metadata: {
						abbr: "OFAC",
						title: "OFAC Sanctions",
						agency: "OFAC",
						agency_abbr: "OFAC",
						entity_name: "Test Entity"
					}
				}
			];

			const result = ensureBusinessEntityType(hits);

			expect(result).toHaveLength(1);
			expect(result[0].entity_type).toBe(WATCHLIST_ENTITY_TYPE.BUSINESS);
		});

		it("should return empty array for undefined input", () => {
			const result = ensureBusinessEntityType(undefined);
			expect(result).toHaveLength(0);
		});

		it("should return empty array for null input", () => {
			const result = ensureBusinessEntityType(null);
			expect(result).toHaveLength(0);
		});

		it("should return empty array for non-array input", () => {
			const result = ensureBusinessEntityType({} as any);
			expect(result).toHaveLength(0);
		});

		it("should handle empty array", () => {
			const result = ensureBusinessEntityType([]);
			expect(result).toHaveLength(0);
		});

		it("should preserve existing entity_type if already set", () => {
			const hits: WatchlistValueMetadatum[] = [
				{
					id: "hit-1",
					type: "sanctions",
					entity_type: WATCHLIST_ENTITY_TYPE.BUSINESS, // Already set correctly
					metadata: {
						abbr: "OFAC",
						title: "OFAC Sanctions",
						agency: "OFAC",
						agency_abbr: "OFAC",
						entity_name: "Test Entity"
					}
				},
				{
					id: "hit-2",
					type: "pep",
					// Missing entity_type - should default to BUSINESS
					metadata: {
						abbr: "WC",
						title: "PEP List",
						agency: "World Check",
						agency_abbr: "WC",
						entity_name: "Test Person"
					}
				}
			];

			const result = ensureBusinessEntityType(hits);

			expect(result).toHaveLength(2);
			expect(result[0].entity_type).toBe(WATCHLIST_ENTITY_TYPE.BUSINESS);
			expect(result[1].entity_type).toBe(WATCHLIST_ENTITY_TYPE.BUSINESS);
		});

		it("should preserve all other hit properties", () => {
			const hits: WatchlistValueMetadatum[] = [
				{
					id: "hit-1",
					type: "pep",
					entity_type: WATCHLIST_ENTITY_TYPE.BUSINESS, // Already set correctly
					metadata: {
						abbr: "WC",
						title: "PEP List",
						agency: "World Check",
						agency_abbr: "WC",
						entity_name: "Test Person"
					},
					url: "https://example.com/hit",
					list_country: "US",
					list_region: "US"
				}
			];

			const result = ensureBusinessEntityType(hits);

			expect(result).toHaveLength(1);
			expect(result[0].id).toBe("hit-1");
			expect(result[0].type).toBe("pep");
			expect(result[0].metadata.entity_name).toBe("Test Person");
			expect(result[0].url).toBe("https://example.com/hit");
			expect(result[0].list_country).toBe("US");
			expect(result[0].list_region).toBe("US");
			expect(result[0].entity_type).toBe(WATCHLIST_ENTITY_TYPE.BUSINESS);
		});
	});

	describe("transformTruliooBusinessWatchlistResults", () => {
		it("should transform raw Trulioo watchlist results to WatchlistValueMetadatum", () => {
			const rawResults: TruliooRawWatchlistHit[] = [
				{
					id: "hit-1",
					listType: "SANCTIONS",
					listName: "OFAC Sanctions List",
					matchDetails: "Test Business",
					sourceAgencyName: "Office of Foreign Assets Control",
					sourceRegion: "US",
					listCountry: "US",
					url: "https://example.com/hit"
				},
				{
					listType: "PEP",
					listName: "PEP List",
					matchDetails: "Another Business",
					sourceAgencyName: "World Check"
				}
			];

			const result = transformTruliooBusinessWatchlistResults(rawResults);

			expect(result).toHaveLength(2);
			expect(result[0].id).toBe("hit-1");
			expect(result[0].type).toBe("sanctions");
			expect(result[0].entity_type).toBe(WATCHLIST_ENTITY_TYPE.BUSINESS);
			expect(result[0].metadata.title).toBe("OFAC Sanctions List");
			expect(result[0].metadata.entity_name).toBe("Test Business");
			expect(result[0].url).toBe("https://example.com/hit");
			expect(result[0].list_country).toBe("US");
			expect(result[0].list_region).toBe("US");

			expect(result[1].entity_type).toBe(WATCHLIST_ENTITY_TYPE.BUSINESS);
			expect(result[1].type).toBe("pep");
			expect(result[1].metadata.entity_name).toBe("Another Business");
		});

		it("should generate ID when missing", () => {
			const rawResults: TruliooRawWatchlistHit[] = [
				{
					listType: "SANCTIONS",
					listName: "Test List",
					matchDetails: "Test Entity"
				}
			];

			const result = transformTruliooBusinessWatchlistResults(rawResults);

			expect(result[0].id).toBeDefined();
			// ID format: "SANCTIONS-Test List-{timestamp}-{random}"
			expect(result[0].id).toContain("SANCTIONS");
			expect(result[0].id).toContain("Test List");
		});

		it("should handle missing optional fields", () => {
			const rawResults: TruliooRawWatchlistHit[] = [
				{
					listType: "SANCTIONS",
					listName: "Test List",
					matchDetails: "Test Entity"
				}
			];

			const result = transformTruliooBusinessWatchlistResults(rawResults);

			expect(result[0].url).toBeNull();
			expect(result[0].list_country).toBeNull();
			expect(result[0].list_region).toBeNull();
		});

		it("should generate agency abbreviation from sourceAgencyName", () => {
			const rawResults: TruliooRawWatchlistHit[] = [
				{
					listType: "SANCTIONS",
					listName: "Test List",
					matchDetails: "Test Entity",
					sourceAgencyName: "European Union Commission"
				}
			];

			const result = transformTruliooBusinessWatchlistResults(rawResults);

			expect(result[0].metadata.abbr).toBe("EUC");
			expect(result[0].metadata.agency_abbr).toBe("EUC");
		});

		it("should use sourceListType as fallback for title", () => {
			const rawResults: TruliooRawWatchlistHit[] = [
				{
					listType: "SANCTIONS",
					sourceListType: "EU Sanctions",
					matchDetails: "Test Entity"
				}
			];

			const result = transformTruliooBusinessWatchlistResults(rawResults);

			expect(result[0].metadata.title).toBe("EU Sanctions");
		});

		it("should default to 'sanctions' when listType is missing", () => {
			const rawResults: TruliooRawWatchlistHit[] = [
				{
					listName: "Test List",
					matchDetails: "Test Entity"
				}
			];

			const result = transformTruliooBusinessWatchlistResults(rawResults);

			expect(result[0].type).toBe("sanctions");
		});
	});

	describe("filterOutAdverseMedia", () => {
		it("should remove adverse_media hits and keep pep/sanctions", () => {
			const hits: WatchlistValueMetadatum[] = [
				{
					id: "hit-1",
					type: "sanctions",
					metadata: { abbr: "OFAC", title: "OFAC SDN", agency: "OFAC", agency_abbr: "OFAC", entity_name: "Entity A" }
				},
				{
					id: "hit-2",
					type: "adverse_media",
					metadata: { abbr: "AM", title: "Adverse Media List", agency: "Media Source", agency_abbr: "MS", entity_name: "Entity B" }
				},
				{
					id: "hit-3",
					type: "pep",
					metadata: { abbr: "PEP", title: "PEP List", agency: "World Check", agency_abbr: "WC", entity_name: "Entity C" }
				}
			];

			const result = filterOutAdverseMedia(hits);

			expect(result).toHaveLength(2);
			expect(result[0].type).toBe("sanctions");
			expect(result[1].type).toBe("pep");
		});

		it("should return all hits when none are adverse_media", () => {
			const hits: WatchlistValueMetadatum[] = [
				{
					id: "hit-1",
					type: "sanctions",
					metadata: { abbr: "OFAC", title: "OFAC SDN", agency: "OFAC", agency_abbr: "OFAC", entity_name: "Entity A" }
				},
				{
					id: "hit-2",
					type: "pep",
					metadata: { abbr: "PEP", title: "PEP List", agency: "World Check", agency_abbr: "WC", entity_name: "Entity B" }
				}
			];

			const result = filterOutAdverseMedia(hits);

			expect(result).toHaveLength(2);
		});

		it("should return empty array when all hits are adverse_media", () => {
			const hits: WatchlistValueMetadatum[] = [
				{
					id: "hit-1",
					type: "adverse_media",
					metadata: { abbr: "AM", title: "AM List 1", agency: "Source 1", agency_abbr: "S1", entity_name: "Entity A" }
				},
				{
					id: "hit-2",
					type: "adverse_media",
					metadata: { abbr: "AM", title: "AM List 2", agency: "Source 2", agency_abbr: "S2", entity_name: "Entity B" }
				}
			];

			const result = filterOutAdverseMedia(hits);

			expect(result).toHaveLength(0);
		});

		it("should return empty array for empty input", () => {
			const result = filterOutAdverseMedia([]);
			expect(result).toHaveLength(0);
		});

		it("should handle mixed hit types including watchlist_result", () => {
			const hits: WatchlistValueMetadatum[] = [
				{
					id: "hit-1",
					type: "watchlist_result",
					metadata: { abbr: "SDN", title: "SDN List", agency: "OFAC", agency_abbr: "OFAC", entity_name: "Biz A" }
				},
				{
					id: "hit-2",
					type: "adverse_media",
					metadata: { abbr: "AM", title: "AM List", agency: "Source", agency_abbr: "S", entity_name: "Biz B" }
				},
				{
					id: "hit-3",
					type: "sanctions",
					metadata: { abbr: "EU", title: "EU Sanctions", agency: "EU Commission", agency_abbr: "EC", entity_name: "Biz C" }
				}
			];

			const result = filterOutAdverseMedia(hits);

			expect(result).toHaveLength(2);
			expect(result.map(h => h.type)).toEqual(["watchlist_result", "sanctions"]);
		});
	});
});
