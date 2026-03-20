import { OpenCorporatesEntityMatchingMetadata } from "./OpenCorporatesEntityMatchingMetadata";
import { OpenCorporatesDirectDatabaseQueryMetadata } from "./OpenCorporatesDirectDatabaseQueryMetadata";

/**
 * Metadata format for OpenCorporates search query.
 * This matches the metadata shape expected by:
 * 1. `fetchBusinessEntityVerification` in `entityMatching.ts` (for when entity matching is enabled)
 * 2. `buildUSSearchQuery` and `buildCanadaSearchQuery` in `opencorporates.ts` (for when entity matching is disabled)
 */
export interface OpenCorporatesIntegrationFactMetadata
	extends OpenCorporatesEntityMatchingMetadata,
		OpenCorporatesDirectDatabaseQueryMetadata {}
