import { getPlatformIdsByChangedFacts } from "../getPlatformIdsByChangedFacts";
import { INTEGRATION_ID } from "#constants";
import type { FactName } from "#lib/facts/types";

describe("getPlatformIdsByChangedFacts", () => {
	it("should return platforms affected by business_name change", () => {
		/** Arrange */
		const changedFacts: FactName[] = ["business_name"];

		/** Act */
		const result = getPlatformIdsByChangedFacts(changedFacts);

		/** Assert */
		expect(result).toContain(INTEGRATION_ID.SERP_GOOGLE_PROFILE);
		expect(result).toContain(INTEGRATION_ID.MIDDESK);
	});

	it("should return platforms affected by dba change", () => {
		/** Arrange */
		const changedFacts: FactName[] = ["dba"];

		/** Act */
		const result = getPlatformIdsByChangedFacts(changedFacts);

		/** Assert */
		expect(result).toContain(INTEGRATION_ID.SERP_GOOGLE_PROFILE);
		expect(result).toContain(INTEGRATION_ID.MIDDESK);
	});

	it("should return platforms affected by primary_address change", () => {
		/** Arrange */
		const changedFacts: FactName[] = ["primary_address"];

		/** Act */
		const result = getPlatformIdsByChangedFacts(changedFacts);

		/** Assert */
		expect(result).toContain(INTEGRATION_ID.SERP_GOOGLE_PROFILE);
		expect(result).toContain(INTEGRATION_ID.MIDDESK);
	});

	it("should return only Middesk for TIN changes", () => {
		/** Arrange */
		const changedFacts: FactName[] = ["tin"];

		/** Act */
		const result = getPlatformIdsByChangedFacts(changedFacts);

		/** Assert */
		expect(result).not.toContain(INTEGRATION_ID.SERP_GOOGLE_PROFILE);
		expect(result).toContain(INTEGRATION_ID.MIDDESK);
	});

	it("should return Middesk and Worth Website Scanning for website changes", () => {
		/** Arrange */
		const changedFacts: FactName[] = ["website"];

		/** Act */
		const result = getPlatformIdsByChangedFacts(changedFacts);

		/** Assert */
		expect(result).not.toContain(INTEGRATION_ID.SERP_GOOGLE_PROFILE);
		expect(result).toContain(INTEGRATION_ID.MIDDESK);
		expect(result).toContain(INTEGRATION_ID.WORTH_WEBSITE_SCANNING);
	});

	it("should handle multiple fact changes", () => {
		/** Arrange */
		const changedFacts: FactName[] = ["business_name", "tin", "website"];

		/** Act */
		const result = getPlatformIdsByChangedFacts(changedFacts);

		/** Assert */
		expect(result).toContain(INTEGRATION_ID.SERP_GOOGLE_PROFILE);
		expect(result).toContain(INTEGRATION_ID.MIDDESK);
	});

	it("should return empty array for unrelated fact changes", () => {
		/** Arrange */
		const changedFacts: FactName[] = ["nonexistent_fact_name" as FactName];

		/** Act */
		const result = getPlatformIdsByChangedFacts(changedFacts);

		/** Assert */
		expect(result).toHaveLength(0);
	});

	it("should return empty array for empty fact list", () => {
		/** Arrange */
		const changedFacts: FactName[] = [];

		/** Act */
		const result = getPlatformIdsByChangedFacts(changedFacts);

		/** Assert */
		expect(result).toHaveLength(0);
	});

	it("should deduplicate platforms when multiple facts match same platform", () => {
		/** Arrange */
		const changedFacts: FactName[] = ["business_name", "dba", "primary_address"];

		/** Act */
		const result = getPlatformIdsByChangedFacts(changedFacts);

		/** Assert */
		const serpCount = result.filter(id => id === INTEGRATION_ID.SERP_GOOGLE_PROFILE).length;
		const middeskCount = result.filter(id => id === INTEGRATION_ID.MIDDESK).length;
		expect(serpCount).toBe(1);
		expect(middeskCount).toBe(1);
	});
});
