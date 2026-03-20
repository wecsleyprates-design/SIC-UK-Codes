import type { IntegrationFactGetMetadata } from "../types";
import { AddressUtil } from "#utils";
import type { ZoomInfoIntegrationFactMetadata } from "./types";
import { ENTITY_MATCHING_FACT_NAMES, getEntityMatchingMetadata } from "../../lib";
import { entityMatchingProcessFunction } from "../shared/entityMatchingProcessFunction";
import { createAdapter } from "../shared/createAdapter";

/**
 * Adapter that converts resolved facts into ZoomInfo search query format.
 *
 * ZoomInfo supports two modes:
 * 1. EntityMatching mode (AI-based): Uses names + originalAddresses
 * 2. Heuristic mode (direct Redshift query): Uses names, addresses, zip3, name2
 *
 * This adapter uses the generalized EntityMatching metadata extractor and adds
 * ZoomInfo-specific fields for the heuristic fallback.
 */
const getMetadata: IntegrationFactGetMetadata<ZoomInfoIntegrationFactMetadata> = async businessID => {
	/** Get base EntityMatching metadata (names + originalAddresses) */
	const metadata = await getEntityMatchingMetadata(businessID);
	if (!metadata) return undefined;

	/** Add ZoomInfo-specific fields for heuristic fallback */
	const addresses = new Set<string>();
	const zip3Set = new Set<string>();

	metadata.originalAddresses.forEach(address => {
		if (address.postal_code) zip3Set.add(address.postal_code.substring(0, 3));

		const formattedAddress = AddressUtil.partsToString(address);
		addresses.add(formattedAddress);
	});

	return {
		...metadata,
		addresses: Array.from(addresses),
		zip3: Array.from(zip3Set),
		name2: metadata.names.map(name => name.substring(0, 2).toLocaleUpperCase())
	};
};

export const zoomInfoAdapter = createAdapter<ZoomInfoIntegrationFactMetadata>({
	factNames: ENTITY_MATCHING_FACT_NAMES,
	getMetadata,
	process: entityMatchingProcessFunction
});
