import { getPlatformCodesByChangedFacts } from "../getPlatformCodesByChangedFacts";
import type { FactName } from "#lib/facts/types";

describe("getPlatformCodesByChangedFacts", () => {
	it("should return platform codes (strings) affected by business_name change", () => {
		/** Arrange */
		const changedFacts: FactName[] = ["business_name"];

		/** Act */
		const result = getPlatformCodesByChangedFacts(changedFacts);

		/** Assert */
		expect(result).toContain("SERP_GOOGLE_PROFILE");
		expect(result).toContain("MIDDESK");
	});

	it("should return only Middesk code for TIN changes", () => {
		/** Arrange */
		const changedFacts: FactName[] = ["tin"];

		/** Act */
		const result = getPlatformCodesByChangedFacts(changedFacts);

		/** Assert */
		expect(result).not.toContain("SERP_GOOGLE_PROFILE");
		expect(result).toContain("MIDDESK");
	});

	it("should return empty array for unrelated fact changes", () => {
		/** Arrange */
		const changedFacts: FactName[] = ["nonexistent_fact_name" as FactName];

		/** Act */
		const result = getPlatformCodesByChangedFacts(changedFacts);

		/** Assert */
		expect(result).toHaveLength(0);
	});
});
