import type { IntegrationFactGetMetadata } from "../types";
import { AddressUtil, isCanadianAddress } from "#utils";
import type { OpenCorporatesIntegrationFactMetadata } from "./types";
import { ENTITY_MATCHING_FACT_NAMES, getEntityMatchingMetadata } from "../../lib";
import { entityMatchingProcessFunction } from "../shared/entityMatchingProcessFunction";
import { createAdapter } from "../shared/createAdapter";

/**
 * Adapter that converts resolved facts into OpenCorporates search query format.
 *
 * OpenCorporates supports two modes:
 * 1. EntityMatching mode (AI-based): Uses names + originalAddresses
 * 2. Heuristic mode (direct DB query): Uses names, addresses, zip3, name2, hasCanadianAddress
 *
 * This adapter uses the generalized EntityMatching metadata extractor and adds
 * OpenCorporates-specific fields for the heuristic fallback.
 */
const getMetadata: IntegrationFactGetMetadata<OpenCorporatesIntegrationFactMetadata> = async businessID => {
	/** Get base EntityMatching metadata (names + originalAddresses) */
	const metadata = await getEntityMatchingMetadata(businessID);
	if (!metadata) return undefined;

	/** Add OpenCorporates-specific fields for heuristic fallback */
	const addresses = new Set<string>();
	const zip3Set = new Set<string>();
	const countrySet = new Set<string>();
	let hasCanadianAddress = false;

	metadata.originalAddresses.forEach(address => {
		// Extract zip3 for query optimization
		if (address.postal_code) zip3Set.add(address.postal_code.substring(0, 3));

		// Extract country
		if (address.country) countrySet.add(address.country);

		// Build formatted address string
		const formattedAddress = AddressUtil.partsToString(address);
		addresses.add(formattedAddress);

		// Check if the address is a Canadian address
		if (isCanadianAddress(formattedAddress)) hasCanadianAddress = true;
	});

	return {
		...metadata,
		addresses: Array.from(addresses),
		zip3: Array.from(zip3Set),
		name2: metadata.names.map(name => name.substring(0, 2).toLocaleUpperCase()),
		country: Array.from(countrySet),
		hasCanadianAddress
	};
};

export const openCorporatesAdapter = createAdapter<OpenCorporatesIntegrationFactMetadata>({
	factNames: ENTITY_MATCHING_FACT_NAMES,
	getMetadata,
	process: entityMatchingProcessFunction
});
