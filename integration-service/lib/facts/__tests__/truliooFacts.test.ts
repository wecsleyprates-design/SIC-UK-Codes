import type { FactEngine } from "../factEngine";
import { truliooFacts } from "../truliooFacts";
import type { TruliooScreenedPersonData } from "#lib/trulioo/common/types";

function findFact(name: string) {
	const fact = truliooFacts.find(f => f.name === name);
	if (!fact?.fn) throw new Error(`Fact '${name}' not found`);
	return fact;
}

function createMockEngine(resolved: Record<string, { value: unknown }>): FactEngine {
	return {
		getResolvedFact: (name: string) => resolved[name]
	} as unknown as FactEngine;
}

describe("truliooFacts architecture", () => {
	describe("removed facts do not exist", () => {
		it("should NOT have watchlist_hits as a trulioo source fact", () => {
			const watchlistHitsFact = truliooFacts.find(f => f.name === "watchlist_hits");
			expect(watchlistHitsFact).toBeUndefined();
		});

		it("should NOT have total_watchlist_hits fact", () => {
			const totalFact = truliooFacts.find(f => (f.name as string) === "total_watchlist_hits");
			expect(totalFact).toBeUndefined();
		});
	});

	describe("remaining facts", () => {
		it("should still have screened_people fact", () => {
			const fact = truliooFacts.find(f => f.name === "screened_people");
			expect(fact).toBeDefined();
			expect(fact?.source?.name).toBe("person");
		});

		it("should still have pep_hits fact", () => {
			const fact = truliooFacts.find(f => f.name === "pep_hits");
			expect(fact).toBeDefined();
		});

		it("should still have sanctions_hits fact", () => {
			const fact = truliooFacts.find(f => f.name === "sanctions_hits");
			expect(fact).toBeDefined();
		});

		it("should still have adverse_media_hits fact", () => {
			const fact = truliooFacts.find(f => f.name === "adverse_media_hits");
			expect(fact).toBeDefined();
		});

		it("should still have high_risk_people fact", () => {
			const fact = truliooFacts.find(f => f.name === "high_risk_people");
			expect(fact).toBeDefined();
			expect(fact?.dependencies).toContain("screened_people");
		});

		it("should still have risk_score fact", () => {
			const fact = truliooFacts.find(f => f.name === "risk_score");
			expect(fact).toBeDefined();
			expect(fact?.dependencies).toContain("watchlist_hits");
			expect(fact?.dependencies).toContain("high_risk_people");
		});

		it("risk_score should NOT depend on total_watchlist_hits", () => {
			const fact = truliooFacts.find(f => f.name === "risk_score");
			expect(fact?.dependencies).not.toContain("total_watchlist_hits");
		});

		it("should still have compliance_status fact", () => {
			const fact = truliooFacts.find(f => f.name === "compliance_status");
			expect(fact).toBeDefined();
		});
	});

	describe("high_risk_people", () => {
		const highRiskPeopleFact = findFact("high_risk_people");

		it("should return empty array when no screened people", async () => {
			const engine = createMockEngine({ screened_people: { value: [] } });
			const result = await highRiskPeopleFact.fn.call(highRiskPeopleFact, engine, undefined);
			expect(result).toEqual([]);
		});

		it("should return empty array when screened_people value is not an array", async () => {
			const engine = createMockEngine({ screened_people: { value: null } });
			const result = await highRiskPeopleFact.fn.call(highRiskPeopleFact, engine, undefined);
			expect(result).toEqual([]);
		});

		it("should filter only people with watchlist hits", async () => {
			const people = [
				{
					fullName: "Has Hits",
					screeningResults: { watchlistHits: [{ listType: "PEP" }] }
				},
				{
					fullName: "No Hits",
					screeningResults: { watchlistHits: [] }
				},
				{
					fullName: "No Results",
					screeningResults: undefined
				}
			] as unknown as TruliooScreenedPersonData[];
			const engine = createMockEngine({ screened_people: { value: people } });
			const result = await highRiskPeopleFact.fn.call(highRiskPeopleFact, engine, undefined);
			expect(result).toHaveLength(1);
			expect(result[0].fullName).toBe("Has Hits");
		});
	});

	describe("compliance_status", () => {
		const complianceFact = findFact("compliance_status");

		it("should return 'pending' when business not verified", async () => {
			const engine = createMockEngine({
				business_verified: { value: false },
				risk_score: { value: 0 }
			});
			const result = await complianceFact.fn.call(complianceFact, engine, undefined);
			expect(result).toBe("pending");
		});

		it("should return 'high_risk' when risk_score >= 80", async () => {
			const engine = createMockEngine({
				business_verified: { value: true },
				risk_score: { value: 80 }
			});
			const result = await complianceFact.fn.call(complianceFact, engine, undefined);
			expect(result).toBe("high_risk");
		});

		it("should return 'medium_risk' when 50 <= risk_score < 80", async () => {
			const engine = createMockEngine({
				business_verified: { value: true },
				risk_score: { value: 50 }
			});
			const result = await complianceFact.fn.call(complianceFact, engine, undefined);
			expect(result).toBe("medium_risk");
		});

		it("should return 'low_risk' when risk_score < 50", async () => {
			const engine = createMockEngine({
				business_verified: { value: true },
				risk_score: { value: 30 }
			});
			const result = await complianceFact.fn.call(complianceFact, engine, undefined);
			expect(result).toBe("low_risk");
		});
	});
});
