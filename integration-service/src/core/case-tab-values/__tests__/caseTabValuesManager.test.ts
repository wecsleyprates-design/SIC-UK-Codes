/**
 * Unit tests for caseTabValuesManager internals.
 *
 * Ensures KYB_NEEDED_FACT_NAMES includes all transitive dependencies
 * so the FactEngine can resolve computed facts like watchlist_hits.
 */

import { kybFacts } from "#lib/facts/kyb";
import { FactUtils } from "#lib/facts";
import type { FactName } from "#lib/facts/types";

/**
 * Mirror of the constant in caseTabValuesManager.ts.
 * If the source constant changes, this test must be updated to match.
 */
const KYB_NEEDED_FACT_NAMES: FactName[] = [
	"tin", "addresses", "addresses_found", "legal_name", "website_found",
	"watchlist_hits", "watchlist", "watchlist_raw", "screened_people", "idv_status",
];

describe("caseTabValuesManager – KYB fact filtering", () => {
	const namesWithDeps = FactUtils.getAllFactsThatDependOnFacts(KYB_NEEDED_FACT_NAMES, [...kybFacts]);
	const filteredFacts = kybFacts.filter(f => new Set(namesWithDeps).has(f.name));
	const filteredNames = new Set(filteredFacts.map(f => f.name));

	it("should include the full watchlist dependency chain (watchlist_hits → watchlist → watchlist_raw + screened_people)", () => {
		expect(filteredNames.has("watchlist_hits")).toBe(true);
		expect(filteredNames.has("watchlist")).toBe(true);
		expect(filteredNames.has("watchlist_raw")).toBe(true);
		expect(filteredNames.has("screened_people")).toBe(true);
	});

	it("should include all explicitly listed KYB fact names", () => {
		for (const name of KYB_NEEDED_FACT_NAMES) {
			expect(filteredNames.has(name)).toBe(true);
		}
	});
});
