import { allFacts, FactEngineWithDefaultOverrides } from "#lib/facts";

describe("Facts", () => {
	const businessID = "00000000-0000-0000-0000-000000000000";

	// Check to make sure we don't have an invalid Fact engine state when 'all' facts are defined.
	// This can happen if we have duplicate fact names+fact sources so this test is just verifying that we don't do that :)
	it("should properly instantate the fact engine with all facts", async () => {
		const factEngine = new FactEngineWithDefaultOverrides(allFacts, { business: businessID });
		const addedFacts = factEngine.dumpFacts();

		const numberOfTotalFacts = Object.entries(allFacts).length;
		const numberOfAddedFacts = Object.entries(addedFacts).length;

		expect(numberOfAddedFacts).toBeDefined();
		expect(numberOfAddedFacts).toBe(numberOfTotalFacts);
	});
});
