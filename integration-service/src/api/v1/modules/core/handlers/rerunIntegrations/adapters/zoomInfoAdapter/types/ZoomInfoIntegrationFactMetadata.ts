import type { IntegrationFactEntityMatchingMetadata } from "../../types";

/**
 * Metadata format for ZoomInfo direct database query (heuristic fallback).
 * This matches the metadata shape expected by `buildSearchQuery` in `zoominfo.ts`.
 */
export interface ZoomInfoDirectDatabaseQueryMetadata {
	/** Array of business names */
	names: string[];
	/** Array of formatted address strings */
	addresses: string[];
	/** Array of 3-digit zip code prefixes */
	zip3: string[];
	/** Array of 2-character name prefixes */
	name2: string[];
}

/**
 * Metadata format for ZoomInfo integration facts.
 * This matches the metadata shape expected by:
 * 1. `fetchBusinessEntityVerification` in `entityMatching.ts` (when entity matching is enabled)
 * 2. `buildSearchQuery` in `zoominfo.ts` (when entity matching is disabled / heuristic fallback)
 */
export interface ZoomInfoIntegrationFactMetadata
	extends IntegrationFactEntityMatchingMetadata,
		ZoomInfoDirectDatabaseQueryMetadata {}
