import { FactEngine } from "./factEngine";
import * as FactRules from "./rules";
import { reviewFacts } from "./reviews";
import { businessFacts } from "./businessDetails";
import { bjlFacts } from "./bjl";
import { matchingFacts } from "./matches/matches";
import { financialFacts } from "./financials/financials";
import { kybFacts } from "./kyb";
import { facts as kybCanadaFacts } from "./kyb/ca";
import { kycFacts } from "./kyc";
import { scoringFacts } from "./score";
import { processingHistoryFacts } from "./processingHistory";
import type { Fact } from "./types";

export const allFacts: Fact[] = [
	...reviewFacts,
	...bjlFacts,
	...matchingFacts,
	...businessFacts,
	...financialFacts,
	...kybFacts,
	...kybCanadaFacts,
	...kycFacts,
	...scoringFacts,
	...processingHistoryFacts
];

/**
 * FactEngine with default rule overrides applied
 * Used for combining facts from multiple sources (names, addresses, etc.)
 */
export class FactEngineWithDefaultOverrides extends FactEngine {
	constructor(facts, scopes) {
		super(facts, scopes);
		this.addRuleOverride(
			[
				"names",
				"addresses",
				"addresses_found",
				"dba_found",
				"names_found",
				"phone_found",
				"website_found",
				"revenue_all_sources",
				"internal_platform_matches_combined"
			],
			FactRules.combineFacts
		);
		this.addRuleOverride("watchlist_raw", FactRules.combineWatchlistMetadata);
	}
}
