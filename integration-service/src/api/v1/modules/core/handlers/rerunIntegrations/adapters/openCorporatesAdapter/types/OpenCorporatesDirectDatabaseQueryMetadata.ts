/**
 * Metadata format for OpenCorporates direct database query.
 * This matches the metadata shape expected by `buildUSSearchQuery` and `buildCanadaSearchQuery` in `opencorporates.ts`
 */
export interface OpenCorporatesDirectDatabaseQueryMetadata {
	/** Array of business names */
	names: string[];
	/** Array of formatted address strings */
	addresses: string[];
	/** Array of 3-digit zip code prefixes */
	zip3: string[];
	/** Array of 2-character name prefixes */
	name2: string[];
	/** Array of country codes or names */
	country?: string[];
	/**
	 * Boolean indicating if the business has a Canadian address
	 * Used to determine how to search the OpenCorporates database
	 */
	hasCanadianAddress: boolean;
}
