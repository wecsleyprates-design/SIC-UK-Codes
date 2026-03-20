import type { IntegrationFactGetMetadata } from "./types";
import type { BusinessAddress } from "#helpers/api";
import { allFacts, FactEngineWithDefaultOverrides, FactRules } from "#lib/facts";
import { FactName } from "#lib/facts/types";
import { createAdapter } from "./shared/createAdapter";

export interface SerpGoogleProfileMetadata {
	name: string;
	address: string;
}

const FACT_NAMES: FactName[] = ["business_name", "dba", "primary_address", "addresses"];

/**
 * Adapter that converts resolved facts into SerpGoogleProfileMetadata format.
 */
const getMetadata: IntegrationFactGetMetadata<SerpGoogleProfileMetadata> = async businessID => {
	const facts = allFacts.filter(fact => FACT_NAMES.includes(fact.name));
	const factEngine = new FactEngineWithDefaultOverrides(facts, { business: businessID });
	await factEngine.applyRules(FactRules.factWithHighestConfidence);

	const businessName = factEngine.getResolvedFact<string>("business_name")?.value;
	const dba = factEngine.getResolvedFact<string[]>("dba")?.value;
	const primaryAddress = factEngine.getResolvedFact<BusinessAddress>("primary_address")?.value;
	const addresses = factEngine.getResolvedFact<string[]>("addresses")?.value;

	const name: SerpGoogleProfileMetadata["name"] = dba?.[0] || businessName || "";
	let address: SerpGoogleProfileMetadata["address"] = "";

	if (primaryAddress) {
		// Use primary address if available
		address = [
			primaryAddress.line_1,
			primaryAddress.city,
			primaryAddress.state,
			/** Guard against invalid >5 digit postal code input */
			primaryAddress.postal_code?.slice(0, 5),
			primaryAddress.country || "US"
		]
			.filter(Boolean)
			.join(", ");
	} else if (Array.isArray(addresses) && addresses.length > 0) {
		// If the primary address is not available, just use the first address
		address = addresses[0];
	}

	// If we don't have a valid name or address, we cannot create a valid payload
	if (!name || !address) return undefined;

	return { name, address };
};

export const serpGoogleProfileAdapter = createAdapter<SerpGoogleProfileMetadata>({
	getMetadata,
	factNames: FACT_NAMES
});
