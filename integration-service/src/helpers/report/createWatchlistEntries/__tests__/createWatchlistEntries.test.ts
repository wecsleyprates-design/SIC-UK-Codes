import { createWatchlistEntries } from "../createWatchlistEntries";
import type { Fact } from "#lib/facts/types";
import type { WatchlistValue, WatchlistValueMetadatum } from "#lib/facts/kyb/types";
import { INTEGRATION_ID } from "#constants";

function makeHit(overrides: Partial<WatchlistValueMetadatum> = {}): WatchlistValueMetadatum {
	const { metadata: metadataOverrides, ...restOverrides } = overrides;
	return {
		id: "hit-1",
		type: "sanctions",
		url: null,
		list_country: null,
		list_region: null,
		...restOverrides,
		metadata: {
			abbr: "OFAC",
			title: "OFAC SDN",
			agency: "Office of Foreign Assets Control",
			agency_abbr: "OFAC",
			entity_name: "TEST ENTITY",
			...metadataOverrides
		}
	};
}

function makeWatchlistFact(
	hits: WatchlistValueMetadatum[],
	platformId: number = INTEGRATION_ID.MIDDESK
): Partial<Fact<WatchlistValue>> {
	return {
		name: "watchlist" as any,
		value: { metadata: hits, message: `Found ${hits.length} hit(s)` },
		"source.platformId": platformId
	} as any;
}

function makeNamesFact(
	names: { name: string }[],
	platformId: number = INTEGRATION_ID.MIDDESK
): Partial<Fact<{ name: string }[]>> {
	return {
		name: "names_submitted" as any,
		value: names,
		"source.platformId": platformId
	} as any;
}

function makePeopleFact(
	names: { name: string }[],
	platformId: number = INTEGRATION_ID.MIDDESK
): Partial<Fact<{ name: string }[]>> {
	return {
		name: "people" as any,
		value: names,
		"source.platformId": platformId
	} as any;
}

function makeLegalNameFact(
	legalName: string,
	platformId: number = INTEGRATION_ID.TRULIOO
): Partial<Fact<string>> {
	return {
		name: "legal_name" as any,
		value: legalName,
		"source.platformId": platformId
	} as any;
}

describe("createWatchlistEntries", () => {
	describe("with Middesk names (US businesses)", () => {
		it("should use Middesk names_submitted for business grouping", () => {
			const hit = makeHit({ metadata: { abbr: "OFAC", title: "OFAC SDN", agency: "OFAC", agency_abbr: "OFAC", entity_name: "ACME CORP" } });
			const watchlist = makeWatchlistFact([hit]);
			const names = makeNamesFact([{ name: "ACME CORP" }]);
			const people = makePeopleFact([]);

			const result = createWatchlistEntries(watchlist, names, people);

			expect(result).toHaveLength(1);
			expect(result[0].entity_name).toBe("ACME CORP");
			expect(result[0].hits).toHaveLength(1);
			expect(result[0].hits[0].list).toBe("OFAC SDN");
		});

		it("should use Middesk people names for person grouping", () => {
			const hit = makeHit({ metadata: { abbr: "PEP", title: "PEP List", agency: "World-Check", agency_abbr: "WC", entity_name: "JOHN DOE" } });
			const watchlist = makeWatchlistFact([hit]);
			const names = makeNamesFact([{ name: "ACME CORP" }]);
			const people = makePeopleFact([{ name: "JOHN DOE" }]);

			const result = createWatchlistEntries(watchlist, names, people);

			const personEntry = result.find(e => e.entity_name === "JOHN DOE");
			expect(personEntry).toBeDefined();
			expect(personEntry!.hits).toHaveLength(1);
		});

		it("should include entities with no hits", () => {
			const watchlist = makeWatchlistFact([]);
			const names = makeNamesFact([{ name: "CLEAN BUSINESS" }]);
			const people = makePeopleFact([]);

			const result = createWatchlistEntries(watchlist, names, people);

			expect(result).toHaveLength(1);
			expect(result[0].entity_name).toBe("CLEAN BUSINESS");
			expect(result[0].hits).toHaveLength(0);
		});
	});

	describe("Trulioo fallback (non-US businesses)", () => {
		it("should fall back to legal_name when Middesk names are empty", () => {
			const hit = makeHit({ metadata: { abbr: "OFAC", title: "OFAC SDN", agency: "OFAC", agency_abbr: "OFAC", entity_name: "AU BUSINESS PTY LTD" } });
			const watchlist = makeWatchlistFact([hit], INTEGRATION_ID.TRULIOO);
			const names = makeNamesFact([], INTEGRATION_ID.TRULIOO);
			const people = makePeopleFact([], INTEGRATION_ID.TRULIOO);
			const legalName = makeLegalNameFact("AU Business Pty Ltd");

			const result = createWatchlistEntries(watchlist, names, people, legalName);

			const businessEntry = result.find(e => e.entity_name === "AU BUSINESS PTY LTD");
			expect(businessEntry).toBeDefined();
			expect(businessEntry!.hits).toHaveLength(1);
		});

		it("should extract business names from watchlist hit metadata when no legal_name", () => {
			const hit = makeHit({ metadata: { abbr: "OFAC", title: "OFAC SDN", agency: "OFAC", agency_abbr: "OFAC", entity_name: "NZ COMPANY LTD" } });
			const watchlist = makeWatchlistFact([hit], INTEGRATION_ID.TRULIOO);
			const names = makeNamesFact([], INTEGRATION_ID.TRULIOO);
			const people = makePeopleFact([], INTEGRATION_ID.TRULIOO);

			const result = createWatchlistEntries(watchlist, names, people);

			expect(result.some(e => e.entity_name === "NZ COMPANY LTD")).toBe(true);
		});

		it("should deduplicate business names from hits (case-insensitive)", () => {
			const hit1 = makeHit({ id: "h1", metadata: { abbr: "OFAC", title: "OFAC SDN", agency: "OFAC", agency_abbr: "OFAC", entity_name: "Duplicate Corp" } });
			const hit2 = makeHit({ id: "h2", metadata: { abbr: "PEP", title: "PEP List", agency: "WC", agency_abbr: "WC", entity_name: "DUPLICATE CORP" } });
			const watchlist = makeWatchlistFact([hit1, hit2], INTEGRATION_ID.TRULIOO);
			const names = makeNamesFact([], INTEGRATION_ID.TRULIOO);
			const people = makePeopleFact([], INTEGRATION_ID.TRULIOO);

			const result = createWatchlistEntries(watchlist, names, people);

			const corpEntries = result.filter(e => e.entity_name === "DUPLICATE CORP");
			expect(corpEntries).toHaveLength(1);
			expect(corpEntries[0].hits).toHaveLength(2);
		});

		it("should use Trulioo people from source.platformId", () => {
			const hit = makeHit({ metadata: { abbr: "PEP", title: "PEP List", agency: "WC", agency_abbr: "WC", entity_name: "DIRECTOR NAME" } });
			const watchlist = makeWatchlistFact([hit], INTEGRATION_ID.TRULIOO);
			const names = makeNamesFact([], INTEGRATION_ID.TRULIOO);
			const people: Partial<Fact<{ name: string }[]>> = {
				name: "people" as any,
				value: [{ name: "Director Name" }],
				"source.platformId": INTEGRATION_ID.TRULIOO
			} as any;

			const result = createWatchlistEntries(watchlist, names, people);

			expect(result.some(e => e.entity_name === "DIRECTOR NAME")).toBe(true);
		});

		it("should use Trulioo people from alternatives when source is not Trulioo", () => {
			const hit = makeHit({ metadata: { abbr: "PEP", title: "PEP List", agency: "WC", agency_abbr: "WC", entity_name: "ALT DIRECTOR" } });
			const watchlist = makeWatchlistFact([hit], INTEGRATION_ID.TRULIOO);
			const names = makeNamesFact([], INTEGRATION_ID.TRULIOO);
			const people: Partial<Fact<{ name: string }[]>> = {
				name: "people" as any,
				value: [],
				"source.platformId": 999,
				alternatives: [
					{ source: INTEGRATION_ID.TRULIOO, value: [{ name: "Alt Director" }] } as any
				]
			} as any;

			const result = createWatchlistEntries(watchlist, names, people);

			expect(result.some(e => e.entity_name === "ALT DIRECTOR")).toBe(true);
		});

		it("should return empty people names when people fact is falsy", () => {
			const watchlist = makeWatchlistFact([], INTEGRATION_ID.TRULIOO);
			const names = makeNamesFact([], INTEGRATION_ID.TRULIOO);
			const legalName = makeLegalNameFact("Solo Business");

			const result = createWatchlistEntries(watchlist, names, undefined as any, legalName);

			expect(result).toHaveLength(1);
			expect(result[0].entity_name).toBe("SOLO BUSINESS");
			expect(result[0].hits).toHaveLength(0);
		});

		it("should combine legal_name and watchlist metadata names without duplicates", () => {
			const hit = makeHit({ metadata: { abbr: "OFAC", title: "OFAC SDN", agency: "OFAC", agency_abbr: "OFAC", entity_name: "AU Business Pty Ltd" } });
			const watchlist = makeWatchlistFact([hit], INTEGRATION_ID.TRULIOO);
			const names = makeNamesFact([], INTEGRATION_ID.TRULIOO);
			const people = makePeopleFact([], INTEGRATION_ID.TRULIOO);
			const legalName = makeLegalNameFact("AU Business Pty Ltd");

			const result = createWatchlistEntries(watchlist, names, people, legalName);

			const auEntries = result.filter(e => e.entity_name === "AU BUSINESS PTY LTD");
			expect(auEntries).toHaveLength(1);
			expect(auEntries[0].hits).toHaveLength(1);
		});
	});

	describe("Middesk priority over Trulioo", () => {
		it("should prefer Middesk names when both sources have data", () => {
			const hit = makeHit({ metadata: { abbr: "OFAC", title: "OFAC SDN", agency: "OFAC", agency_abbr: "OFAC", entity_name: "MIDDESK NAME" } });
			const watchlist = makeWatchlistFact([hit]);
			const names = makeNamesFact([{ name: "MIDDESK NAME" }]);
			const people = makePeopleFact([{ name: "John Owner" }]);
			const legalName = makeLegalNameFact("Trulioo Legal Name");

			const result = createWatchlistEntries(watchlist, names, people, legalName);

			expect(result.some(e => e.entity_name === "MIDDESK NAME")).toBe(true);
			expect(result.some(e => e.entity_name === "TRULIOO LEGAL NAME")).toBe(false);
		});
	});

	describe("hit mapping", () => {
		it("should map hit fields correctly", () => {
			const hit = makeHit({
				metadata: { abbr: "OFAC", title: "OFAC SDN", agency: "Treasury", agency_abbr: "OFAC", entity_name: "TEST" },
				list_country: "US",
				url: "https://example.com"
			});
			const watchlist = makeWatchlistFact([hit]);
			const names = makeNamesFact([{ name: "TEST" }]);
			const people = makePeopleFact([]);

			const result = createWatchlistEntries(watchlist, names, people);

			expect(result[0].hits[0]).toEqual({
				list: "OFAC SDN",
				agency: "Treasury",
				country: "US",
				url: "https://example.com"
			});
		});

		it("should fallback through url fields (list_url, agency_information_url, agency_list_url)", () => {
			const hit = makeHit({
				metadata: { abbr: "X", title: "List", agency: "Agency", agency_abbr: "X", entity_name: "TEST" },
				url: null,
				list_url: "https://list-url.com"
			});
			const watchlist = makeWatchlistFact([hit]);
			const names = makeNamesFact([{ name: "TEST" }]);
			const people = makePeopleFact([]);

			const result = createWatchlistEntries(watchlist, names, people);

			expect(result[0].hits[0].url).toBe("https://list-url.com");
		});
	});
});
