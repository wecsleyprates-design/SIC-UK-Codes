import { FactEngine, FactRules, FactUtils } from "#lib/facts";
import { kybFacts } from "..";
import { sources } from "#lib/facts/sources";
import type { WatchlistValue } from "../types";
import type { TruliooWatchlistHit, TruliooScreenedPersonData } from "#lib/trulioo/common/types";

describe("watchlist_hits (number derived from consolidated watchlist)", () => {
	let factEngine: FactEngine;
	const businessID = "00000000-0000-0000-0000-000000000789";

	let watchlistFactValue: WatchlistValue | null;
	let screenedPeopleData: TruliooScreenedPersonData[] | null;

	const factNames = FactUtils.getAllFactsThatDependOnFacts(
		["watchlist_hits", "watchlist", "watchlist_raw", "screened_people"],
		kybFacts
	);
	const facts = kybFacts.filter(fact => factNames.includes(fact.name));

	beforeEach(() => {
		watchlistFactValue = null;
		screenedPeopleData = null;

		sources.middesk.getter = async () => ({
			reviewTasks: watchlistFactValue
				? [{ key: "watchlist", metadata: watchlistFactValue.metadata, message: watchlistFactValue.message }]
				: []
		});
		sources.business.getter = async () => null;
		sources.person.getter = async () => ({
			screenedPersons: screenedPeopleData || []
		});
	});

	it("should return 0 when no watchlist hits exist", async () => {
		watchlistFactValue = null;
		screenedPeopleData = [];

		factEngine = new FactEngine(facts, { business: businessID });
		await factEngine.applyRules(FactRules.factWithHighestConfidence);

		const result = factEngine.getResolvedFact("watchlist_hits");
		expect(result?.value).toBe(0);
	});

	it("should return undefined when watchlist fact is not resolved", async () => {
		sources.middesk.getter = async () => null;
		sources.person.getter = async () => null;

		const minimalFacts = kybFacts.filter(f => f.name === "watchlist_hits");
		factEngine = new FactEngine(minimalFacts, { business: businessID });
		await factEngine.applyRules(FactRules.factWithHighestConfidence);

		const result = factEngine.getResolvedFact("watchlist_hits");
		expect(result?.value).toBeUndefined();
	});

	it("should count business-level hits only", async () => {
		watchlistFactValue = {
			metadata: [
				{
					id: "biz-1",
					type: "sanctions",
					metadata: { abbr: "OFAC", title: "OFAC SDN", agency: "OFAC", agency_abbr: "OFAC", entity_name: "Corp A" }
				},
				{
					id: "biz-2",
					type: "pep",
					metadata: { abbr: "WC", title: "PEP List", agency: "World Check", agency_abbr: "WC", entity_name: "Corp A" }
				}
			],
			message: "Found 2 watchlist hit(s)"
		};
		screenedPeopleData = [];

		factEngine = new FactEngine(facts, { business: businessID });
		await factEngine.applyRules(FactRules.factWithHighestConfidence);

		const result = factEngine.getResolvedFact("watchlist_hits");
		expect(result?.value).toBe(2);
	});

	it("should count person-level hits only", async () => {
		watchlistFactValue = null;
		screenedPeopleData = [
			{
				fullName: "Person A",
				firstName: "Person",
				lastName: "A",
				screeningResults: {
					watchlistHits: [
						{ listType: "PEP", listName: "PEP", confidence: 95, matchDetails: "Person A" } as TruliooWatchlistHit,
						{ listType: "SANCTIONS", listName: "OFAC", confidence: 90, matchDetails: "Person A" } as TruliooWatchlistHit
					]
				}
			} as TruliooScreenedPersonData
		];

		factEngine = new FactEngine(facts, { business: businessID });
		await factEngine.applyRules(FactRules.factWithHighestConfidence);

		const result = factEngine.getResolvedFact("watchlist_hits");
		expect(result?.value).toBe(2);
	});

	it("should count combined business + person hits", async () => {
		watchlistFactValue = {
			metadata: [
				{
					id: "biz-1",
					type: "sanctions",
					metadata: { abbr: "OFAC", title: "OFAC SDN", agency: "OFAC", agency_abbr: "OFAC", entity_name: "Acme Inc" }
				}
			],
			message: "Found 1 watchlist hit(s)"
		};

		screenedPeopleData = [
			{
				fullName: "John Doe",
				firstName: "John",
				lastName: "Doe",
				screeningResults: {
					watchlistHits: [
						{ listType: "PEP", listName: "PEP", confidence: 95, matchDetails: "John Doe" } as TruliooWatchlistHit
					]
				}
			} as TruliooScreenedPersonData
		];

		factEngine = new FactEngine(facts, { business: businessID });
		await factEngine.applyRules(FactRules.factWithHighestConfidence);

		const result = factEngine.getResolvedFact("watchlist_hits");
		expect(result?.value).toBe(2);
	});

	it("should handle multiple people with multiple hits each", async () => {
		watchlistFactValue = null;
		screenedPeopleData = [
			{
				fullName: "Person One",
				firstName: "Person",
				lastName: "One",
				screeningResults: {
					watchlistHits: [
						{ listType: "PEP", listName: "PEP", confidence: 95, matchDetails: "Person One" } as TruliooWatchlistHit,
						{ listType: "SANCTIONS", listName: "OFAC", confidence: 90, matchDetails: "Person One" } as TruliooWatchlistHit
					]
				}
			} as TruliooScreenedPersonData,
			{
				fullName: "Person Two",
				firstName: "Person",
				lastName: "Two",
				screeningResults: {
					watchlistHits: [
						{ listType: "ADVERSE_MEDIA", listName: "AM", confidence: 85, matchDetails: "Person Two" } as TruliooWatchlistHit
					]
				}
			} as TruliooScreenedPersonData
		];

		factEngine = new FactEngine(facts, { business: businessID });
		await factEngine.applyRules(FactRules.factWithHighestConfidence);

		const result = factEngine.getResolvedFact("watchlist_hits");
		expect(result?.value).toBe(2); // ADVERSE_MEDIA filtered out, only PEP + SANCTIONS counted
	});

	it("should deduplicate duplicate hits across sources and count unique only", async () => {
		watchlistFactValue = {
			metadata: [
				{
					id: "biz-1",
					type: "sanctions",
					metadata: { abbr: "OFAC", title: "OFAC SDN", agency: "OFAC", agency_abbr: "OFAC", entity_name: "Acme Corp" }
				}
			],
			message: "Found 1 watchlist hit(s)"
		};

		screenedPeopleData = [
			{
				fullName: "Acme Corp",
				firstName: "Acme",
				lastName: "Corp",
				screeningResults: {
					watchlistHits: [
						{
							listType: "SANCTIONS",
							listName: "OFAC SDN",
							confidence: 95,
							matchDetails: "Acme Corp",
							sourceAgencyName: "OFAC",
							listCountry: "US"
						} as TruliooWatchlistHit
					]
				}
			} as TruliooScreenedPersonData
		];

		factEngine = new FactEngine(facts, { business: businessID });
		await factEngine.applyRules(FactRules.factWithHighestConfidence);

		const result = factEngine.getResolvedFact("watchlist_hits");
		expect(result?.value).toBe(1);
	});

	it("should correctly return type number, not array or object", async () => {
		watchlistFactValue = {
			metadata: [
				{
					id: "biz-1",
					type: "sanctions",
					metadata: { abbr: "OFAC", title: "OFAC SDN", agency: "OFAC", agency_abbr: "OFAC", entity_name: "Test" }
				}
			],
			message: "Found 1 watchlist hit(s)"
		};
		screenedPeopleData = [];

		factEngine = new FactEngine(facts, { business: businessID });
		await factEngine.applyRules(FactRules.factWithHighestConfidence);

		const result = factEngine.getResolvedFact("watchlist_hits");
		expect(typeof result?.value).toBe("number");
		expect(Array.isArray(result?.value)).toBe(false);
	});
});
