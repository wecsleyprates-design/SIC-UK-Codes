import { FactEngine } from ".";
import { sources } from "./sources";
import type { Fact, FactName, Rule } from "./types";
import { DEFAULT_FACT_WEIGHT } from "./factEngine";
import type { WatchlistValueMetadatum, WatchlistEntityType } from "./kyb/types";
import { WATCHLIST_ENTITY_TYPE, WATCHLIST_HIT_TYPE } from "./kyb/types";

// When comparing confidence values, if the difference is less than or equal to this threshold, use the weightedFactSelector.
export const WEIGHT_THRESHOLD: number = 0.05;

export const factWithHighestWeight: Rule = {
	name: "factWithHighestWeight",
	description: "Get the fact with the highest weight",
	fn: (_, _factName: FactName, input: Fact[]): Fact | undefined => {
		return input.reduce(
			(acc, fact) => {
				if (fact.value === undefined) {
					return acc;
				}
				if (!acc) {
					return fact;
				}
				const leftWeight = fact.weight ?? fact.source?.weight ?? 1;
				const rightWeight = acc.weight ?? acc.source?.weight ?? 1;

				if (leftWeight > rightWeight) {
					return fact;
				}
				return acc;
			},
			undefined as Fact | undefined
		);
	}
};

export const factWithHighestConfidence: Rule = {
	name: "factWithHighestConfidence",
	description: "Get the fact with the highest confidence and weight if the same confidence",
	fn: (_engine, _factName: FactName, input: Fact[]): Fact | undefined => {
		return input.reduce(
			(acc, fact) => {
				const factConfidence = fact.confidence ?? fact.source?.confidence ?? 0.1;
				const accConfidence = acc?.confidence ?? acc?.source?.confidence ?? 0.1;
				// Ignore facts with no value or empty arrays
				if (fact.value === undefined || (Array.isArray(fact.value) && fact.value.length === 0)) {
					return acc;
				} else if (acc === undefined) {
					return fact;
				} else if (Math.abs(factConfidence - accConfidence) <= WEIGHT_THRESHOLD) {
					return weightedFactSelector(fact, acc);
				} else if (factConfidence > accConfidence) {
					return fact;
				}
				return acc;
			},
			undefined as Fact | undefined
		);
	}
};

export function weightedFactSelector(fact: Fact, otherFact: Fact): Fact {
	// Determine the effective weight of each fact, if the fact is using the default weight, fall back to the source weight.
	const primaryFactWeight =
		fact.weight !== undefined && fact.weight !== DEFAULT_FACT_WEIGHT
			? fact.weight
			: (fact.source?.weight ?? DEFAULT_FACT_WEIGHT);

	const otherFactWeight =
		otherFact.weight !== undefined && otherFact.weight !== DEFAULT_FACT_WEIGHT
			? otherFact.weight
			: (otherFact.source?.weight ?? DEFAULT_FACT_WEIGHT);

	// choose the left on tie; change to ">" if you want the right on ties
	return primaryFactWeight >= otherFactWeight ? fact : otherFact;
}
export const combineFacts: Rule = {
	name: "combineFacts",
	description: "Combine all fact values into an array",
	fn: (_, factName: FactName, input: Fact[], confidence: number): Fact => {
		const combined = {
			name: factName,
			source: null,
			value: input
				.filter(
					fact =>
						fact.value !== undefined &&
						(!Array.isArray(fact.value) || (Array.isArray(fact.value) && fact.value.length > 0))
				)
				.filter(fact => (fact.confidence ? fact.confidence >= confidence : true))
				.flatMap(fact => fact.value)
		} as Fact;
		// Make sure combined.value is all unique
		combined.value = Array.from(new Set(combined.value));
		return combined;
	}
};

export const dependentFact: Rule = {
	name: "dependentFact",
	description: "Set the fact to the value of a dependent fact",
	fn: (engine, factName: FactName, facts: Fact[]): Fact | undefined => {
		const dependentFact = facts.find(fact => fact.name === factName);
		if (dependentFact) {
			return dependentFact;
		}
	}
};

/**
 * A psuedo-rule that is used to override a fact with a manually provided value
 */
export const manualOverride: Rule = {
	name: "manualOverride",
	description: "Override the fact with a manually provided value",
	fn: (engine, factName: FactName): Fact | undefined => {
		const manualEntry = engine.getManualSource()?.rawResponse?.[factName];
		if (manualEntry) {
			return {
				name: factName,
				source: sources.manual,
				value: manualEntry.value,
				override: manualEntry ?? null
			} as Fact;
		}
	}
};

/**
 * Trulioo-specific rules for fact resolution
 * Provides country-specific logic and Trulioo preference rules
 */

/**
 * Rule that prefers Trulioo data for UK/Canada businesses.
 * Note: Use with caution for industrial classification (SIC/NAICS) as Trulioo
 * may return US-centric codes even for UK businesses.
 */
export const truliooPreferredRule: Rule = {
	name: "truliooPreferred",
	description: "Prefer Trulioo data for UK/Canada businesses",
	fn: (engine, factName: FactName, facts: Fact[]): Fact | undefined => {
		// Check if business is in UK/Canada
		const businessCountry = engine.getResolvedFact("primary_address")?.value?.country;
		const isUKCanada = businessCountry === "GB" || businessCountry === "CA";

		if (isUKCanada) {
			// Prefer Trulioo sources for UK/Canada
			const truliooFact = facts.find(fact =>
				fact.source?.name === "business" ||
				fact.source?.name === "person"
			);
			if (truliooFact) return truliooFact;
		}

		// Fall back to highest confidence
		if (facts.length === 0) {
			return undefined;
		}

		return facts.reduce((acc, fact) => {
			if (!acc) return fact;
			const factConfidence = fact.confidence ?? fact.source?.confidence ?? 0;
			const accConfidence = acc.confidence ?? acc.source?.confidence ?? 0;
			return factConfidence > accConfidence ? fact : acc;
		});
	}
};

/**
 * Rule that prefers official registry data (OpenCorporates) for classification facts
 */
export const registryPreferredRule: Rule = {
	name: "registryPreferred",
	description: "Prefer official registry data (OpenCorporates) for classification facts",
	fn: (engine, factName: FactName, facts: Fact[]): Fact | undefined => {
		const registryFact = facts.find(
			fact => fact.source?.name === "opencorporates" && engine.isValidFactValue(fact.value)
		);
		if (registryFact) return registryFact;

		// Fall back to highest confidence
		return facts.reduce(
			(acc, fact) => {
				const factConfidence = fact.confidence ?? fact.source?.confidence ?? 0.1;
				const accConfidence = acc?.confidence ?? acc?.source?.confidence ?? 0.1;
				// Ignore facts with no value or empty arrays
				if (fact.value === undefined || (Array.isArray(fact.value) && fact.value.length === 0)) {
					return acc;
				} else if (acc === undefined) {
					return fact;
				} else if (Math.abs(factConfidence - accConfidence) <= WEIGHT_THRESHOLD) {
					return weightedFactSelector(fact, acc);
				} else if (factConfidence > accConfidence) {
					return fact;
				}
				return acc;
			},
			undefined as Fact | undefined
		);
	}
};

/**
 * Rule that prioritizes Trulioo for risk assessment facts
 */
export const truliooRiskRule: Rule = {
	name: "truliooRisk",
	description: "Prioritize Trulioo for risk assessment and compliance facts",
	fn: (engine, factName: FactName, facts: Fact[]): Fact | undefined => {
		// Risk-related fact names that should prefer Trulioo
		const riskFacts = [
			"risk_score",
			"compliance_status",
			"high_risk_people",
			"watchlist_hits",
			"pep_hits",
			"sanctions_hits",
			"adverse_media_hits"
		];

		if (riskFacts.includes(factName)) {
			// For risk facts, prefer facts from Trulioo sources if available
			// Note: Some risk facts (like risk_score, compliance_status)
			// are calculated facts with source: sources.calculated, so they won't match here
			// but will be handled by the fallback highest confidence logic
			const truliooFact = facts.find(fact =>
				fact.source?.name === "business" ||
				fact.source?.name === "person"
			);
			if (truliooFact) return truliooFact;
		}

		// For other facts or when no Trulioo source found, use highest confidence
		if (facts.length === 0) {
			return undefined;
		}

		return facts.reduce((acc, fact) => {
			if (!acc) return fact;
			const factConfidence = fact.confidence ?? fact.source?.confidence ?? 0;
			const accConfidence = acc.confidence ?? acc.source?.confidence ?? 0;
			return factConfidence > accConfidence ? fact : acc;
		});
	}
};

/**
 * Rule that handles Trulioo business verification status
 */
export const truliooBusinessStatusRule: Rule = {
	name: "truliooBusinessStatus",
	description: "Handle Trulioo business verification status with proper mapping",
	fn: (engine, factName: FactName, facts: Fact[]): Fact | undefined => {
		const truliooFact = facts.find(fact => fact.source?.name === "business");

		if (truliooFact && truliooFact.value) {
			// Map Trulioo status to standardized format
			// The fact uses path: "clientData.status", so value is the status string directly
			const status = truliooFact.value;
			let mappedStatus = "pending";

			if (status === "completed" || status === "success") {
				mappedStatus = "approved";
			} else if (status === "failed" || status === "error" || status === "REJECTED") {
				mappedStatus = "rejected";
			} else if (status === "pending" || status === "in_progress") {
				mappedStatus = "in_review";
			}

			return {
				...truliooFact,
				value: mappedStatus
			};
		}

		return truliooFact;
	}
};

/**
 * Rule that combines watchlist facts by merging their metadata arrays
 * This prevents duplication when multiple sources (middesk, business, person)
 * return watchlist data for the same business.
 *
 * The default combineFacts rule uses flatMap which creates an array of objects,
 * causing the UI to render duplicate persons. This rule instead merges the
 * metadata arrays and deduplicates hits based on type + title + entity_name + url.
 */
export const combineWatchlistMetadata: Rule = {
	name: "combineWatchlistMetadata",
	description: "Combine watchlist facts by merging metadata arrays with deduplication",
	fn: (_, factName: FactName, input: Fact[]): Fact => {
		const allMetadata: WatchlistValueMetadatum[] = [];
		const seenKeys = new Set<string>();
		let message = "";
		let totalHitsFound = 0;

		// Process each fact source
		input.forEach(fact => {
			if (!fact.value) return;

			const watchlistValue = fact.value as { metadata?: WatchlistValueMetadatum[]; message?: string };

			// Extract metadata array from watchlist value
			const metadata = watchlistValue?.metadata;
			if (Array.isArray(metadata)) {
				metadata.forEach((hit: WatchlistValueMetadatum) => {
					// Create dedup key from type + title/agency + entity_name + url
					// This ensures the same hit from different sources is not duplicated
					const dedupKey = `${hit.type || ""}|${hit.metadata?.title || ""}|${hit.metadata?.entity_name || ""}|${hit.url || ""}`;

					if (!seenKeys.has(dedupKey)) {
						seenKeys.add(dedupKey);
						const entityType: WatchlistEntityType = hit.entity_type || (fact.source?.name === "person" ? WATCHLIST_ENTITY_TYPE.PERSON : WATCHLIST_ENTITY_TYPE.BUSINESS);
						allMetadata.push({
							...hit,
							entity_type: entityType
						});
					}
				});
				totalHitsFound += metadata.length;
			}

			// Keep the most informative message (not "No Watchlist hits")
			if (watchlistValue?.message && watchlistValue.message !== "No Watchlist hits were identified") {
				message = watchlistValue.message;
			}
		});

		const filteredMetadata = allMetadata.filter(hit => hit.type !== WATCHLIST_HIT_TYPE.ADVERSE_MEDIA);

		return {
			name: factName,
			source: null,
			value: {
				metadata: filteredMetadata,
				message:
					filteredMetadata.length > 0
						? message || `Found ${filteredMetadata.length} consolidated watchlist hit(s)`
						: "No Watchlist hits were identified"
			}
		} as Fact;
	}
};
