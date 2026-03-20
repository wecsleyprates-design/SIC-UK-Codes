import type { FactEngine } from "../factEngine";
import { truliooFacts } from "../truliooFacts";

const riskScoreFact = truliooFacts.find(f => f.name === "risk_score");
if (!riskScoreFact?.fn) {
	throw new Error("risk_score fact not found");
}

function createMockEngine(resolved: Record<string, { value: unknown }>): FactEngine {
	return {
		getResolvedFact: (name: string) => resolved[name]
	} as unknown as FactEngine;
}

describe("risk_score", () => {
	it("should return 0 when no hits and no high risk people", async () => {
		const engine = createMockEngine({
			watchlist_hits: { value: 0 },
			high_risk_people: { value: [] }
		});
		const result = await riskScoreFact.fn.call(riskScoreFact, engine, undefined);
		expect(result).toBe(0);
	});

	it("should return 0 when facts are not resolved", async () => {
		const engine = createMockEngine({});
		const result = await riskScoreFact.fn.call(riskScoreFact, engine, undefined);
		expect(result).toBe(0);
	});

	it("should score 10 points per watchlist hit", async () => {
		const engine = createMockEngine({
			watchlist_hits: { value: 3 },
			high_risk_people: { value: [] }
		});
		const result = await riskScoreFact.fn.call(riskScoreFact, engine, undefined);
		expect(result).toBe(30);
	});

	it("should score 20 points per high risk person", async () => {
		const engine = createMockEngine({
			watchlist_hits: { value: 0 },
			high_risk_people: { value: [{ fullName: "Person A" }, { fullName: "Person B" }] }
		});
		const result = await riskScoreFact.fn.call(riskScoreFact, engine, undefined);
		expect(result).toBe(40);
	});

	it("should combine watchlist hits and high risk people scores", async () => {
		const engine = createMockEngine({
			watchlist_hits: { value: 2 },
			high_risk_people: { value: [{ fullName: "Person A" }] }
		});
		const result = await riskScoreFact.fn.call(riskScoreFact, engine, undefined);
		expect(result).toBe(40);
	});

	it("should cap risk score at 100", async () => {
		const engine = createMockEngine({
			watchlist_hits: { value: 8 },
			high_risk_people: { value: [
				{ fullName: "P1" }, { fullName: "P2" }, { fullName: "P3" },
				{ fullName: "P4" }, { fullName: "P5" }
			] }
		});
		const result = await riskScoreFact.fn.call(riskScoreFact, engine, undefined);
		expect(result).toBe(100);
	});

	it("should handle watchlist_hits = 1 with high risk people = 4 correctly", async () => {
		const engine = createMockEngine({
			watchlist_hits: { value: 1 },
			high_risk_people: { value: [
				{ fullName: "P1" }, { fullName: "P2" },
				{ fullName: "P3" }, { fullName: "P4" }
			] }
		});
		const result = await riskScoreFact.fn.call(riskScoreFact, engine, undefined);
		expect(result).toBe(90);
	});

	it("should handle edge case: exactly 100 without capping", async () => {
		const engine = createMockEngine({
			watchlist_hits: { value: 0 },
			high_risk_people: { value: [
				{ fullName: "P1" }, { fullName: "P2" }, { fullName: "P3" },
				{ fullName: "P4" }, { fullName: "P5" }
			] }
		});
		const result = await riskScoreFact.fn.call(riskScoreFact, engine, undefined);
		expect(result).toBe(100);
	});

	it("should treat null/undefined watchlist_hits as 0", async () => {
		const engine = createMockEngine({
			watchlist_hits: { value: null },
			high_risk_people: { value: [{ fullName: "P1" }] }
		});
		const result = await riskScoreFact.fn.call(riskScoreFact, engine, undefined);
		expect(result).toBe(20);
	});

	it("should treat null/undefined high_risk_people as empty array", async () => {
		const engine = createMockEngine({
			watchlist_hits: { value: 5 },
			high_risk_people: { value: null }
		});
		const result = await riskScoreFact.fn.call(riskScoreFact, engine, undefined);
		expect(result).toBe(50);
	});
});
