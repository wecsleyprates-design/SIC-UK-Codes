import { FactEngine, FactRules, FactUtils } from "#lib/facts";
import { kybFacts } from "..";
import { sources } from "#lib/facts/sources";
import type { TruliooScreenedPersonData } from "#lib/trulioo/common/types";

describe("people fact with truliooPerson source", () => {
	let factEngine: FactEngine;
	const businessID = "00000000-0000-0000-0000-000000000123";

	let truliooPersonResponse: any;

	const factNames = FactUtils.getAllFactsThatDependOnFacts(["people"], kybFacts);
	const facts = kybFacts.filter(fact => factNames.includes(fact.name));

	beforeEach(() => {
		truliooPersonResponse = null;

		// Mock other sources to return undefined/null
		sources.middesk.getter = async () => null;
		sources.business.getter = async () => null;
		sources.opencorporates.getter = async () => null;
		sources.verdataRaw.getter = async () => null;
		sources.equifax.getter = async () => null;

		// Mock truliooPerson source
		sources.person.getter = async () => truliooPersonResponse;
	});

	it("should extract people from truliooPerson source", async () => {
		truliooPersonResponse = {
			screenedPersons: [
				{
					fullName: "John Doe",
					firstName: "John",
					lastName: "Doe",
					title: "CEO",
					controlType: "UBO",
					screeningStatus: "completed",
					screeningResults: {}
				} as TruliooScreenedPersonData
			]
		};

		factEngine = new FactEngine(facts, { business: businessID });
		await factEngine.applyRules(FactRules.factWithHighestConfidence);

		const result = await factEngine.getResolvedFact("people");

		expect(result?.value).toBeDefined();
		const people = result?.value as Array<{ name: string; titles: string[] }>;
		expect(people).toHaveLength(1);
		expect(people[0].name).toBe("John Doe");
		expect(people[0].titles).toContain("CEO");
		expect(people[0].titles).toContain("UBO");
	});

	it("should construct name from firstName and lastName when fullName is missing", async () => {
		truliooPersonResponse = {
			screenedPersons: [
				{
					firstName: "Jane",
					lastName: "Smith",
					title: "Director",
					screeningStatus: "completed",
					screeningResults: {}
				} as TruliooScreenedPersonData
			]
		};

		factEngine = new FactEngine(facts, { business: businessID });
		await factEngine.applyRules(FactRules.factWithHighestConfidence);

		const result = await factEngine.getResolvedFact("people");

		expect(result?.value).toBeDefined();
		const people = result?.value as Array<{ name: string; titles: string[] }>;
		expect(people).toHaveLength(1);
		expect(people[0].name).toBe("Jane Smith");
		expect(people[0].titles).toContain("Director");
	});

	it("should use default title when title and controlType are missing", async () => {
		truliooPersonResponse = {
			screenedPersons: [
				{
					fullName: "Unknown Person",
					screeningStatus: "completed",
					screeningResults: {}
				} as TruliooScreenedPersonData
			]
		};

		factEngine = new FactEngine(facts, { business: businessID });
		await factEngine.applyRules(FactRules.factWithHighestConfidence);

		const result = await factEngine.getResolvedFact("people");

		expect(result?.value).toBeDefined();
		const people = result?.value as Array<{ name: string; titles: string[] }>;
		expect(people).toHaveLength(1);
		expect(people[0].name).toBe("Unknown Person");
		expect(people[0].titles).toContain("Owner/Controller");
	});

	it("should skip people without names", async () => {
		truliooPersonResponse = {
			screenedPersons: [
				{
					firstName: "",
					lastName: "",
					screeningStatus: "completed",
					screeningResults: {}
				} as TruliooScreenedPersonData,
				{
					fullName: "Valid Person",
					screeningStatus: "completed",
					screeningResults: {}
				} as TruliooScreenedPersonData
			]
		};

		factEngine = new FactEngine(facts, { business: businessID });
		await factEngine.applyRules(FactRules.factWithHighestConfidence);

		const result = await factEngine.getResolvedFact("people");

		expect(result?.value).toBeDefined();
		const people = result?.value as Array<{ name: string; titles: string[] }>;
		expect(people).toHaveLength(1);
		expect(people[0].name).toBe("Valid Person");
	});

	it("should return undefined when no screened people exist", async () => {
		truliooPersonResponse = {
			screenedPersons: []
		};

		factEngine = new FactEngine(facts, { business: businessID });
		await factEngine.applyRules(FactRules.factWithHighestConfidence);

		const result = await factEngine.getResolvedFact("people");

		expect(result?.value).toBeUndefined();
	});

	it("should handle multiple people", async () => {
		truliooPersonResponse = {
			screenedPersons: [
				{
					fullName: "Person One",
					title: "CEO",
					controlType: "UBO",
					dateOfBirth: "1980-01-01",
					addressLine1: "123 Main St",
					city: "New York",
					postalCode: "10001",
					country: "US",
					screeningStatus: "completed",
					screeningResults: {}
				} as TruliooScreenedPersonData,
				{
					fullName: "Person Two",
					title: "CFO",
					controlType: "DIRECTOR",
					dateOfBirth: "1985-05-15",
					addressLine1: "456 Oak Ave",
					city: "London",
					postalCode: "SW1A 1AA",
					country: "GB",
					screeningStatus: "completed",
					screeningResults: {}
				} as TruliooScreenedPersonData
			]
		};

		factEngine = new FactEngine(facts, { business: businessID });
		await factEngine.applyRules(FactRules.factWithHighestConfidence);

		const result = await factEngine.getResolvedFact("people");

		expect(result?.value).toBeDefined();
		const people = result?.value as Array<{ name: string; titles: string[] }>;
		expect(people).toHaveLength(2);
		expect(people[0].name).toBe("Person One");
		expect(people[1].name).toBe("Person Two");
		expect(people[1].titles).toContain("CFO");
		expect(people[1].titles).toContain("DIRECTOR");
	});
});
