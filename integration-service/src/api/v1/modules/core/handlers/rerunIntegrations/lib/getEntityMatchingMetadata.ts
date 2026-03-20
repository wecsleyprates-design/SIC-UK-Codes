import type { BusinessAddress } from "#helpers/api";
import { allFacts, FactEngineWithDefaultOverrides, FactRules } from "#lib/facts";
import { AddressUtil } from "#utils";
import { OpenCorporatesEntityMatchingMetadata } from "../adapters/openCorporatesAdapter";
import type { IntegrationFactEntityMatchingMetadata } from "../adapters/types";
import { ENTITY_MATCHING_FACT_NAMES } from "./entityMatchingFactNames";

/**
 * Generic metadata extractor for EntityMatching-based integrations.
 *
 * This function extracts names and addresses from the Facts engine, which is the
 * base metadata required by all EntityMatching integrations. It can optionally
 * include extended metadata (zip3, name2, country) for integrations that have
 * heuristic fallback logic.
 *
 * @param businessID - The business ID to extract metadata for
 * @param config - Optional configuration for additional facts and extended metadata
 * @returns Base or extended metadata, or undefined if insufficient data
 *
 * @example
 * For integrations that only need EntityMatching (no fallback)
 * ```typescript
 * const metadata = await getEntityMatchingMetadata(businessID);
 * ```
 *
 * @example
 * For integrations with fallback logic that applies when entity matching is disabled (like OpenCorporates),
 * you can implement a custom getMetadata function that calls this function and adds additional metadata.
 *
 * Just be sure to account for any fact names that are not included in the standard entity matching fact names.
 * ```typescript
 * const myCustomGetMetadata: IntegrationFactGetMetadata<MyCustomMetadata> = async businessID => {
 *   const metadata = await getEntityMatchingMetadata(businessID);
 *   if (!metadata) return undefined;
 *   const facts = allFacts.filter(fact => fact.name === 'foo')
 *   const factEngine = new FactEngineWithDefaultOverrides(facts, { business: businessID });
 *   await factEngine.applyRules(FactRules.factWithHighestConfidence);
 *   const foo = factEngine.getResolvedFact<string>("foo")?.value;
 *   return { ...metadata, foo };
 * };
 * ```
 */
export async function getEntityMatchingMetadata(
	businessID: string
): Promise<IntegrationFactEntityMatchingMetadata | undefined> {
	/** Set up fact engine with standard entity matching fact names */
	const factNames = ENTITY_MATCHING_FACT_NAMES;
	const facts = allFacts.filter(fact => factNames.includes(fact.name));
	const factEngine = new FactEngineWithDefaultOverrides(facts, { business: businessID });
	await factEngine.applyRules(FactRules.factWithHighestConfidence);

	/** Extract name facts */
	const businessName = factEngine.getResolvedFact<string>("business_name")?.value;
	const legalName = factEngine.getResolvedFact<string>("legal_name")?.value;
	const dba = factEngine.getResolvedFact<string[]>("dba")?.value;
	const namesFound = factEngine.getResolvedFact<string | string[]>("names_found")?.value;
	const namesSubmitted = factEngine.getResolvedFact<{ name: string; submitted: boolean }[]>("names_submitted")?.value;

	/** Extract address facts */
	const primaryAddress = factEngine.getResolvedFact<BusinessAddress>("primary_address")?.value;
	const addresses = factEngine.getResolvedFact<string[]>("addresses")?.value;

	/** Build unique names list */
	const names = new Set<string>();
	if (businessName) names.add(businessName);
	if (legalName) names.add(legalName);
	if (dba && dba?.length) dba.forEach(name => name && names.add(name));

	/** Handle namesFound (can be string or string[]) */
	if (Array.isArray(namesFound)) {
		namesFound.forEach(name => name && names.add(name));
	} else if (namesFound && typeof namesFound === "string") {
		names.add(namesFound);
	}

	/** Handle namesSubmitted */
	if (Array.isArray(namesSubmitted)) namesSubmitted.forEach(({ name }) => name && names.add(name));

	/** Build addresses */
	const originalAddresses: IntegrationFactEntityMatchingMetadata["originalAddresses"] = [];

	if (primaryAddress) originalAddresses.push(primaryAddress);

	if (Array.isArray(addresses)) {
		new Set(addresses).forEach(address => {
			const parts = AddressUtil.stringToParts(address);
			originalAddresses.push({
				line_1: parts.line_1 ?? "",
				apartment: parts.line_2 ?? "",
				city: parts.city ?? "",
				state: parts.state ?? "",
				postal_code: parts.postal_code ?? "",
				country: parts.country ?? ""
			});
		});
	}

	/** Validate minimum requirements */
	if (!names.size || !originalAddresses.length) return undefined;

	return { names: Array.from(names).filter(Boolean), originalAddresses };
}
