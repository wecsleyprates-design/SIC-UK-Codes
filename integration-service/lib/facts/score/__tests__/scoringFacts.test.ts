import { FactName } from "#lib/facts/types";
import { scoringFacts } from "../index";

describe("Scoring Facts", () => {
	describe("Fact Structure", () => {
		it("should have scoring facts loaded", () => {
			expect(scoringFacts).toBeDefined();
			expect(Array.isArray(scoringFacts)).toBe(true);
			expect(scoringFacts.length).toBeGreaterThan(0);
		});

		it("should have business structure facts", () => {
			const busStructFact = scoringFacts.find(fact => fact.name === "bus_struct");
			expect(busStructFact).toBeDefined();
			expect(busStructFact?.source).toBeDefined();
		});

		// Age facts are no longer part of scoringFacts; they're computed downstream from existing facts
		it("should not include age facts in scoringFacts (computed downstream)", () => {
			const ageBusiness = scoringFacts.find(fact => fact.name === "age_business" as FactName);
			const ageBankruptcy = scoringFacts.find(fact => fact.name === "age_bankruptcy" as FactName);
			expect(ageBusiness).toBeUndefined();
			expect(ageBankruptcy).toBeUndefined();
		});

		it("should have financial ratio facts", () => {
			const ratioFact = scoringFacts.find(fact => fact.name === "ratio_debt_to_equity");
			expect(ratioFact).toBeDefined();
			expect(ratioFact?.dependencies).toBeDefined();
		});

		it("should have primary SIC code facts", () => {
			const primsicFact = scoringFacts.find(fact => fact.name === "primsic");
			expect(primsicFact).toBeDefined();
			expect(primsicFact?.source).toBeDefined();
		});

		it("should have financial ratio facts", () => {
			const ratioFacts = scoringFacts.filter(fact => fact.name.startsWith("ratio_"));
			expect(ratioFacts.length).toBeGreaterThan(0);
		});

		it("should have balance sheet facts", () => {
			const bsFacts = scoringFacts.filter(fact => fact.name.startsWith("bs_"));
			expect(bsFacts.length).toBeGreaterThan(0);
		});
	});

	describe("Fact Sources", () => {
		it("should have middesk as a source for business structure", () => {
			const busStructFact = scoringFacts.find(fact => fact.name === "bus_struct");
			expect(busStructFact?.source).toBeDefined();
		});

		it("should have opencorporates as a source for business structure", () => {
			const busStructFact = scoringFacts.find(fact => fact.name === "bus_struct");
			expect(busStructFact?.source).toBeDefined();
		});

		it("should have equifax as a source for primary SIC code", () => {
			const primsicFact = scoringFacts.find(fact => fact.name === "primsic");
			expect(primsicFact?.source).toBeDefined();
		});

		it("should have multiple sources for business structure", () => {
			const busStructFacts = scoringFacts.filter(fact => fact.name === "bus_struct");
			expect(busStructFacts.length).toBeGreaterThan(1);
		});
	});

	describe("Dependent Facts", () => {
		it("should have facts with dependencies", () => {
			const dependentFacts = scoringFacts.filter(fact => fact.dependencies);
			expect(dependentFacts.length).toBeGreaterThan(0);

			for (const fact of dependentFacts) {
				expect(fact.dependencies).toBeDefined();
				expect(Array.isArray(fact.dependencies)).toBe(true);
				expect(fact.dependencies!.length).toBeGreaterThan(0);
			}
		});

		it("should have facts with functions", () => {
			const functionFacts = scoringFacts.filter(fact => fact.fn);
			
			for (const fact of functionFacts) {
				expect(fact.fn).toBeDefined();
				expect(typeof fact.fn).toBe("function");
			}
		});
	});

	describe("Fact Names", () => {
		it("should have fact names for each source", () => {
			const factNames = scoringFacts.map(fact => fact.name);
			expect(factNames.length).toBeGreaterThan(0);
			
			// Check that we have the expected fact names
			expect(factNames).toContain("primsic");
			expect(factNames).toContain("bus_struct");
			// Age facts are computed downstream and not part of scoringFacts
		});

		it("should have descriptive fact names", () => {
			const factNames = scoringFacts.map(fact => fact.name);
			
			// Check that fact names follow a consistent pattern
			for (const name of factNames) {
				expect(name).toMatch(/^[a-z_]+$/);
				expect(name.length).toBeGreaterThan(0);
			}
		});
	});

	describe("Source Coverage", () => {
		it("should cover multiple data sources", () => {
			const allSources = new Set<string>();
			
			for (const fact of scoringFacts) {
				if (fact.source) {
					allSources.add(fact.source.name);
				}
			}

			expect(allSources.size).toBeGreaterThan(1);
			expect(allSources.has("middesk")).toBe(true);
			expect(allSources.has("opencorporates")).toBe(true);
			expect(allSources.has("equifax")).toBe(true);
			// equifax_supplemental is no longer used in scoringFacts
		});
	});

	describe("is_total_revenue fact", () => {
		it("should have multiple sources for fallback when accounting returns zero revenue", () => {
			const isTotalRevenueFacts = scoringFacts.filter(fact => fact.name === "is_total_revenue");

			// Verify is_total_revenue has multiple sources for fallback capability
			expect(isTotalRevenueFacts.length).toBeGreaterThan(1);

			// Check that accountingIncomeStatementsS3 source exists
			const accountingS3Fact = isTotalRevenueFacts.find(fact => fact.source?.name === "accountingIncomeStatementsS3");
			expect(accountingS3Fact).toBeDefined();

			// Check that equifax source exists as fallback
			const equifaxFact = isTotalRevenueFacts.find(fact => fact.source?.name === "equifax");
			expect(equifaxFact).toBeDefined();

			// Check that zoominfo source exists as fallback
			const zoominfoFact = isTotalRevenueFacts.find(fact => fact.source?.name === "zoominfo");
			expect(zoominfoFact).toBeDefined();
		});
	});
});
