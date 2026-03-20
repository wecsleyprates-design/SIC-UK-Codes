/**
 * Utility functions for Trulioo integration
 */

import type { TruliooBusinessData, TruliooBusinessAddress, TruliooBusinessAddressData, TruliooStandardizedLocation ,
	TruliooWatchlistHit,
	TruliooWatchlistRawHit
} from "./types";

/**
 * Checks if a Trulioo status indicates a completed/successful verification
 * Trulioo can return: "completed", "success", "ACCEPTED", "COMPLETED", "SUCCESS"
 * @param status - The status string to check (can be undefined/null)
 * @returns true if the status indicates completion, false otherwise
 */
export function isTruliooCompletedStatus(status: string | undefined | null): boolean {
	if (!status) {
		return false;
	}
	const upperStatus = status.toUpperCase();
	return upperStatus === "COMPLETED" || upperStatus === "SUCCESS" || upperStatus === "ACCEPTED";
}

/**
 * Extracts address components from a Trulioo address object, handling both camelCase and snake_case formats
 * @param address - The address object (can be TruliooBusinessAddress or TruliooBusinessAddressData)
 * @param businessData - Optional businessData for fallback to top-level fields
 * @returns Object with address components or undefined if addressLine1 is missing
 */
export function extractTruliooAddressComponents(
	address: TruliooBusinessAddress | TruliooBusinessAddressData | undefined,
	businessData?: TruliooBusinessData
):
	| {
		addressLine1: string;
		addressLine2?: string;
		city: string;
		state: string;
		postalCode: string;
		country: string;
	}
	| undefined {
	if (!address) {
		return undefined;
	}

	// Handle both camelCase (addressLine1) and snake_case (address_line_1) formats
	const addressLine1 = address.addressLine1 || (address as any)?.address_line_1;
	if (!addressLine1) {
		return undefined;
	}

	const addressLine2 = address.addressLine2 || (address as any)?.address_line_2;
	const city = address.city || businessData?.city;
	const state = address.state || businessData?.state;
	const postalCode = address.postalCode || (address as any)?.postal_code || businessData?.postalCode;
	const country = address.country || businessData?.country;

	// Validate required fields
	if (!city || !state || !postalCode || !country) {
		return undefined;
	}

	return {
		addressLine1,
		addressLine2,
		city,
		state,
		postalCode,
		country
	};
}

/**
 * Gets the primary address from Trulioo business data, or falls back to the first address or businessData.address
 * @param businessData - The Trulioo business data
 * @returns The address object (primary, first, or businessData.address) or undefined
 */
export function getTruliooPrimaryAddress(
	businessData: TruliooBusinessData
): TruliooBusinessAddress | TruliooBusinessAddressData | undefined {
	// Prefer primary address if available, otherwise use first address
	const primaryAddress =
		businessData.business_addresses?.find(addr => addr.is_primary) || businessData.business_addresses?.[0];
	return primaryAddress || businessData.address;
}

/**
 * Extracts all addresses from Trulioo business data as formatted strings
 * @param businessData - The Trulioo business data
 * @returns Array of formatted address strings
 */
function formatAddressComponents(components: { addressLine1: string; addressLine2?: string; city: string; state: string; postalCode: string; country: string }): string {
	return [components.addressLine1, components.addressLine2, components.city, components.state, components.postalCode, components.country].filter(Boolean).join(", ");
}

export function extractTruliooAddressesAsStrings(businessData: TruliooBusinessData): string[] {
	const addresses: string[] = [];

	if (businessData.address) {
		const components = extractTruliooAddressComponents(businessData.address, businessData);
		if (components) addresses.push(formatAddressComponents(components));
	}

	if (Array.isArray(businessData.business_addresses)) {
		businessData.business_addresses.forEach(addr => {
			const components = extractTruliooAddressComponents(addr, businessData);
			if (components) addresses.push(formatAddressComponents(components));
		});
	}

	if (addresses.length === 0 && (businessData.city || businessData.state || businessData.postalCode)) {
		const parts = [businessData.address?.addressLine1, businessData.city, businessData.state, businessData.postalCode, businessData.country].filter(Boolean);
		if (parts.length > 0) addresses.push(parts.join(", "));
	}

	return addresses;
}

/**
 * Extracts a single address from Trulioo business data for normalization
 * Prefers primary address, then first address, then businessData.address
 * @param businessData - The Trulioo business data
 * @returns Address components object or undefined if address cannot be extracted
 */
export function extractTruliooAddressForNormalization(businessData: TruliooBusinessData):
	| {
		addressLine1: string;
		addressLine2?: string;
		city: string;
		state: string;
		postalCode: string;
		country: string;
	}
	| undefined {
	const address = getTruliooPrimaryAddress(businessData);
	return extractTruliooAddressComponents(address, businessData);
}

/**
 * Extracts registration number from Trulioo flowData structure
 * Looks for fieldData entries with role "company_nr" and extracts the value
 * @param clientData - The clientData object from Trulioo response
 * @returns The registration number/TIN as a string, or undefined if not found
 */
export function extractRegistrationNumberFromFlowData(clientData: any): string | undefined {
	if (!clientData?.flowData) {
		return undefined;
	}

	// flowData is an object with flow IDs as keys
	const flowDataEntries = Object.values(clientData.flowData) as any[];

	for (const flowEntry of flowDataEntries) {
		if (!flowEntry?.fieldData) {
			continue;
		}

		// fieldData is an object with element IDs as keys
		const fieldDataEntries = Object.values(flowEntry.fieldData) as any[];

		for (const field of fieldDataEntries) {
			// Look for field with role "company_nr"
			if (field?.role === "company_nr" && field?.value) {
				// value is typically an array, get first element
				const value = Array.isArray(field.value) ? field.value[0] : field.value;
				if (value && typeof value === "string") {
					return value;
				}
			}
		}
	}

	return undefined;
}

/**
 * Extracts registration number from business data, checking multiple possible field names
 * Note: Registration number and TIN (Tax Identification Number) are treated as equivalent,
 * as in many jurisdictions the registration number IS the TIN
 * @param businessData - The business data object (can be TruliooBusinessData or any object with registration/TIN fields)
 * @returns The registration number/TIN as a string, or undefined if not found
 */
export function extractRegistrationNumber(
	businessData: Record<string, unknown> | TruliooBusinessData
): string | undefined {
	if (!businessData) {
		return undefined;
	}

	// Check all possible field names together (registration number and TIN are equivalent)
	const registrationNumber =
		businessData.registrationNumber ||
		businessData.registration_number ||
		businessData.companyregno ||
		businessData.company_regno ||
		businessData.businessNumber ||
		businessData.tin ||
		businessData.tax_id ||
		businessData.taxId ||
		businessData.ein;

	if (registrationNumber && typeof registrationNumber === "string") {
		return registrationNumber;
	}

	return undefined;
}

/**
 * Extracts registration number from Trulioo response, checking both businessData and flowData structures
 * @param truliooResponse - The full Trulioo response object
 * @returns The registration number/TIN as a string, or undefined if not found
 */
export function extractRegistrationNumberFromTruliooResponse(truliooResponse: any): string | undefined {
	if (!truliooResponse?.clientData) {
		return undefined;
	}

	const clientData = truliooResponse.clientData;

	// First try to get from businessData (completed verification)
	if (clientData.businessData) {
		const fromBusinessData = extractRegistrationNumber(clientData.businessData);
		if (fromBusinessData) {
			return fromBusinessData;
		}
	}

	// Fallback to flowData structure (in-progress verification)
	return extractRegistrationNumberFromFlowData(clientData);
}

/**
 * Extract serviceData array from Trulioo clientData
 * serviceData can be in clientData.serviceData or clientData.flowData[].serviceData
 * @param clientData - The clientData from Trulioo response
 * @returns Array of service data items or empty array
 */
export function getServiceDataArray(clientData: any): any[] {
	if (!clientData) {
		return [];
	}

	// First, try clientData.serviceData directly
	if (Array.isArray(clientData.serviceData)) {
		return clientData.serviceData;
	}

	// Then try clientData.flowData[].serviceData
	if (clientData.flowData && typeof clientData.flowData === "object") {
		const flowDataItems = Object.values(clientData.flowData) as any[];
		for (const flowDataItem of flowDataItems) {
			if (flowDataItem?.serviceData && Array.isArray(flowDataItem.serviceData)) {
				return flowDataItem.serviceData;
			}
		}
	}

	return [];
}

/**
 * Find a field value in AppendedFields within DatasourceResults
 * @param datasourceResults - Array of datasource results from Trulioo
 * @param fieldName - Name of the field to find
 * @returns The field data value or undefined
 */
export function findFieldInAppendedFields(
	datasourceResults: any[],
	fieldName: string
): { data: any; datasourceName?: string } | undefined {
	if (!Array.isArray(datasourceResults)) {
		return undefined;
	}

	for (const result of datasourceResults) {
		if (!Array.isArray(result?.AppendedFields)) {
			continue;
		}

		const field = result.AppendedFields.find((f: any) => f.FieldName === fieldName);
		if (field?.Data) {
			return {
				data: field.Data,
				datasourceName: result.DatasourceName
			};
		}
	}

	return undefined;
}

/**
 * Search a JSON structure for occurrences of a dynamically provided key path.
 *
 * The final entry in `fieldPath` is treated as the key whose value should be returned.
 * Every preceding entry must appear (in order) somewhere along the path to that key.
 * Intermediate dynamic keys or array indices are allowed between entries.
 *
 * @example
 * findFieldInInputArray(response, [
 *   "clientData",
 *   "flowData",
 *   "serviceData",
 *   "fullServiceDetails",
 *   "InputFields",
 *   "Value"
 * ]);
 */
export function findFieldInInputArray<Value = any, Item = any>(
	root: Record<string, unknown>,
	fieldPath: string[]
): { path: (string | number)[]; value: Value; item?: Item }[] {
	if (!Array.isArray(fieldPath) || fieldPath.length === 0) {
		throw new Error("fieldPath must be a non-empty array");
	}

	const targetKey = fieldPath[fieldPath.length - 1];
	const requiredAncestors = fieldPath.slice(0, -1);
	const results: { path: (string | number)[]; value: Value; item?: Item }[] = [];

	function ancestorsMatch(path: (string | number)[]): boolean {
		if (requiredAncestors.length === 0) {
			return true;
		}

		const stringSegments = path.filter(segment => typeof segment === "string") as string[];
		let ancestorIndex = requiredAncestors.length - 1;

		for (let i = stringSegments.length - 1; i >= 0 && ancestorIndex >= 0; i--) {
			if (stringSegments[i] === requiredAncestors[ancestorIndex]) {
				ancestorIndex--;
			}
		}

		return ancestorIndex < 0;
	}

	function walk(node: any, path: (string | number)[]): void {
		if (node === null || typeof node !== "object") {
			return;
		}

		if (Array.isArray(node)) {
			node.forEach((item, index) => walk(item, path.concat(index)));
			return;
		}

		for (const [key, value] of Object.entries(node)) {
			const currentPath = path.concat(key);

			if (key === targetKey && ancestorsMatch(path)) {
				results.push({
					path: currentPath,
					value: value as Value,
					item: node as Item
				});
			}

			walk(value, currentPath);
		}
	}

	walk(root, []);
	return results;
}

/**
 * Map source region to country name for display
 * @param sourceRegion - Source region from Trulioo (e.g., "North America", "Europe")
 * @returns Country name or undefined
 */
function extractFieldValue(obj: any, ...fieldNames: string[]): string | undefined {
	for (const fieldName of fieldNames) {
		if (obj[fieldName]) {
			return String(obj[fieldName]).trim();
		}
	}
	return undefined;
}

/**
 * Extracts a field value from Trulioo service data
 * @param clientData - The Trulioo clientData object
 * @param fieldName - The name of the field to extract
 * @returns The field value as a string, or undefined if not found
 */
export function extractFieldFromTruliooServiceData(clientData: any, fieldName: string): string | undefined {
	const serviceDataArray = getServiceDataArray(clientData);
	for (const service of serviceDataArray) {
		if (!service?.fullServiceDetails?.Record?.DatasourceResults) continue;
		const field = findFieldInAppendedFields(service.fullServiceDetails.Record.DatasourceResults, fieldName);
		if (field?.data) return String(field.data);
	}
	return undefined;
}

/**
 * Gets incorporation date from business data object
 * @param businessData - The business data object
 * @returns ISO string date or undefined
 */
export function getIncorporationDateFromBusinessData(businessData: any): string | undefined {
	const incorporationDate = businessData?.incorporationDate || businessData?.dateOfIncorporation || businessData?.incorporation_date;
	if (!incorporationDate) return undefined;
	try {
		const date = new Date(incorporationDate);
		return !isNaN(date.getTime()) ? date.toISOString() : undefined;
	} catch {
		return undefined;
	}
}

/**
 * Generates registry URL for Trulioo business filings based on country and state
 * This is Trulioo-specific logic for determining registry URLs
 * @param country - Country code (e.g., "CA", "US")
 * @param state - State/province code (e.g., "ON", "BC")
 * @returns Registry URL string or empty string if no URL can be determined
 */
export function getTruliooRegistryUrl(country?: string, state?: string): string {
	if (!country) {
		return "";
	}

	const countryUpper = country.toUpperCase();
	const stateUpper = state?.toUpperCase();

	// Canada-specific registry URLs
	if (countryUpper === "CA") {
		if (stateUpper === "ON") {
			return "https://www.ontario.ca/page/search-ontario-business-registry";
		}
		// Federal Canada registry
		return "https://www.ic.gc.ca/app/scr/cc/CorporationsCanada/fdrlCrpSrch.html";
	}

	// Australia - ASIC (Australian Securities and Investments Commission)
	if (countryUpper === "AU") {
		return "https://connectonline.asic.gov.au/RegistrySearch/faces/landing/SearchRegisters.jspx";
	}

	// New Zealand - Companies Office
	if (countryUpper === "NZ") {
		return "https://app.companiesoffice.govt.nz/";
	}

	// Puerto Rico - Departamento de Estado de Puerto Rico
	if (countryUpper === "PR") {
		return "https://prcorpfiling.f1hst.com/CorporationSearch.aspx";
	}

	// Add other country-specific URLs here as needed
	return "";
}

/**
 * Extracts incorporation date from Trulioo clientData
 * @param clientData - The Trulioo clientData object
 * @returns ISO string date or undefined
 */
export function extractIncorporationDateFromTrulioo(clientData: any): string | undefined {
	const businessData = clientData?.businessData;
	if (businessData) {
		const date = getIncorporationDateFromBusinessData(businessData);
		if (date) return date;
	}

	const serviceDataArray = getServiceDataArray(clientData);
	for (const service of serviceDataArray) {
		if (!service?.fullServiceDetails?.Record?.DatasourceResults) continue;
		const datasourceResults = service.fullServiceDetails.Record.DatasourceResults;
		if (!Array.isArray(datasourceResults)) continue;

		const year = findFieldInAppendedFields(datasourceResults, "YearOfIncorporation")?.data;
		const month = findFieldInAppendedFields(datasourceResults, "MonthOfIncorporation")?.data;
		const day = findFieldInAppendedFields(datasourceResults, "DayOfIncorporation")?.data;

		if (year && month && day) {
			try {
				const dateStr = `${String(year)}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
				const date = new Date(dateStr);
				if (!isNaN(date.getTime())) return date.toISOString();
			} catch {
				continue;
			}
		}
	}
	return undefined;
}

/**
 * Extracts year of incorporation from Trulioo clientData
 * @param clientData - The Trulioo clientData object
 * @returns Year as string or undefined
 */
export function extractYearOfIncorporationFromTrulioo(clientData: any): string | undefined {
	const businessData = clientData?.businessData;
	if (businessData) {
		const incorporationDate = businessData.incorporationDate || businessData.dateOfIncorporation || businessData.incorporation_date;
		if (incorporationDate) {
			try {
				const year = new Date(incorporationDate).getFullYear();
				if (!isNaN(year)) return year.toString();
			} catch { }
		}
	}
	const year = extractFieldFromTruliooServiceData(clientData, "YearOfIncorporation");
	if (year && !isNaN(parseInt(year)) && parseInt(year) > 1800 && parseInt(year) <= new Date().getFullYear()) return year;
	return undefined;
}

/**
 * Extracts directors and officers from Trulioo clientData.
 * Iterates through ALL DatasourceResults across all services to collect directors,
 * since multiple data providers may return StandardizedDirectorsOfficers (some empty, some populated).
 * @param clientData - The Trulioo clientData object
 * @param jurisdiction - Optional jurisdiction string
 * @returns Array of officer objects with name, titles, and jurisdictions
 */
export function extractDirectorsOfficersFromTrulioo(clientData: any, jurisdiction?: string): any[] {
	const officers: any[] = [];
	const serviceDataArray = getServiceDataArray(clientData);

	for (const service of serviceDataArray) {
		const datasourceResults = service?.fullServiceDetails?.Record?.DatasourceResults;
		if (!Array.isArray(datasourceResults)) continue;

		// Iterate ALL datasources — multiple providers may return StandardizedDirectorsOfficers
		for (const datasource of datasourceResults) {
			if (!Array.isArray(datasource?.AppendedFields)) continue;

			const field = datasource.AppendedFields.find(
				(f: any) => f.FieldName === "StandardizedDirectorsOfficers"
			);
			if (!field?.Data) continue;

			try {
				let directorsData = typeof field.Data === "string" ? JSON.parse(field.Data) : field.Data;
				if (!directorsData) continue;

				if (!Array.isArray(directorsData)) {
					if (directorsData.StandardizedDirectorsOfficers && Array.isArray(directorsData.StandardizedDirectorsOfficers)) {
						directorsData = directorsData.StandardizedDirectorsOfficers;
					} else if (directorsData.FullName || directorsData.fullName || directorsData.name) {
						directorsData = [directorsData];
					} else {
						directorsData = Object.values(directorsData).filter((item: any) => item && (item.FullName || item.fullName || item.name));
					}
				}

				if (Array.isArray(directorsData)) {
					directorsData.forEach((director: any) => {
						const name = director.FullName || director.fullName || director.name;
						if (name) {
							// Extract address from FullAddress array (first element if available)
							const fullAddress = director.FullAddress && Array.isArray(director.FullAddress) && director.FullAddress.length > 0
								? director.FullAddress[0]
								: undefined;

							officers.push({
								name,
								titles: director.Designation || director.designation || director.title ? [director.Designation || director.designation || director.title] : ["Director"],
								jurisdictions: jurisdiction ? [jurisdiction] : undefined,
								fullAddress
							});
						}
					});
				}
			} catch { /* skip malformed datasource */ }
		}
	}

	if (officers.length === 0) return [];
	// Deduplicate by normalized name
	const seen = new Set<string>();
	return officers.filter(officer => {
		const key = officer.name.toLowerCase().trim();
		return seen.has(key) ? false : (seen.add(key), true);
	});
}

/**
 * Map source region to country name for display
 * @param sourceRegion - Source region from Trulioo (e.g., "North America", "Europe")
 * @returns Country name or undefined
 */
function mapRegionToCountry(sourceRegion?: string): string | undefined {
	if (!sourceRegion) return undefined;

	const regionMap: Record<string, string> = {
		"North America": "United States of America",
		"United States": "United States of America",
		"Europe": "Europe",
		"European Union": "European Union",
		"Asia": "Asia",
		"South America": "South America",
		"Africa": "Africa",
		"Oceania": "Oceania"
	};

	return regionMap[sourceRegion] || sourceRegion;
}

function createWatchlistHit(
	hit: TruliooWatchlistRawHit,
	listType: "SANCTIONS" | "ADVERSE_MEDIA" | "PEP",
	defaultListName: string
): TruliooWatchlistHit {
	// Prioritize subjectMatched and entityName over remarks since they contain the actual entity name
	// remarks is usually metadata like dates, not the entity name
	const matchDetails = hit.subjectMatched || hit.entityName || hit.remarks || `${listType} hit`;

	return {
		listType,
		listName: hit.sourceListType || defaultListName,
		confidence: Number(hit.score) || 0,
		matchDetails,
		url: hit.URL || undefined,
		sourceAgencyName: hit.sourceAgencyName || undefined,
		sourceRegion: hit.sourceRegion || undefined,
		sourceListType: hit.sourceListType || undefined,
		listCountry: mapRegionToCountry(hit.sourceRegion)
	};
}

/**
 * Extracts watchlist results from Trulioo clientData response
 * This is a utility function that can be used without instantiating TruliooBase
 * @param rawClientData - The clientData from Trulioo response
 * @returns Array of watchlist hits or undefined
 */
export function extractWatchlistResultsFromTruliooResponse(rawClientData: any): TruliooWatchlistHit[] | undefined {
	const serviceDataArray = getServiceDataArray(rawClientData);

	if (serviceDataArray.length === 0) {
		return undefined;
	}

	const watchlistNode = serviceDataArray.find((item: any) => {
		const nodeType = toShortNodeType(item?.nodeType);
		return (
			nodeType === "business_wl" ||
			nodeType === "kyb_wl" ||
			nodeType === "person_wl"
		);
	});

	if (!watchlistNode) {
		return undefined;
	}

	// First, check if watchlistResults is already an array (pre-processed)
	if (watchlistNode.watchlistResults && Array.isArray(watchlistNode.watchlistResults) && watchlistNode.watchlistResults.length > 0) {
		return watchlistNode.watchlistResults;
	}

	const watchlistResults: TruliooWatchlistHit[] = [];

	// PRIORITY 1: Extract detailed hits from fullServiceDetails (most accurate)
	// This contains the actual hit details with subjectMatched, sourceListType, etc.
	if (watchlistNode.fullServiceDetails?.Record?.DatasourceResults) {
		const datasourceResults = watchlistNode.fullServiceDetails.Record.DatasourceResults;
		const watchlistDatasource = datasourceResults.find(
			(ds: any) =>
				ds.DatasourceName === "Advanced Business Watchlist" ||
				ds.DatasourceName === "Advanced Watchlist" ||
				ds.DatasourceName?.toLowerCase().includes("watchlist")
		);

		if (watchlistDatasource?.AppendedFields) {
			const watchlistHitDetailsField = watchlistDatasource.AppendedFields.find(
				(field: any) => field.FieldName === "WatchlistHitDetails"
			);

			if (watchlistHitDetailsField?.Data) {
				const hitDetails = watchlistHitDetailsField.Data;

				// Extract WL_results (Sanctions) - detailed hits
				if (hitDetails.WL_results && Array.isArray(hitDetails.WL_results) && hitDetails.WL_results.length > 0) {
					watchlistResults.push(...hitDetails.WL_results.map((hit: any) => createWatchlistHit(hit, "SANCTIONS", hit.sourceListType || "Advanced Watchlist")));
				}

				// Extract AM_results (Adverse Media) - detailed hits
				if (hitDetails.AM_results && Array.isArray(hitDetails.AM_results) && hitDetails.AM_results.length > 0) {
					watchlistResults.push(...hitDetails.AM_results.map((hit: any) => createWatchlistHit(hit, "ADVERSE_MEDIA", hit.sourceListType || "Adverse Media")));
				}

				// Extract PEP_results (PEP) - detailed hits
				if (hitDetails.PEP_results && Array.isArray(hitDetails.PEP_results) && hitDetails.PEP_results.length > 0) {
					watchlistResults.push(...hitDetails.PEP_results.map((hit: any) => createWatchlistHit(hit, "PEP", hit.sourceListType || "PEP")));
				}

				// If we found detailed hits, return them immediately (don't fall back to summary)
				if (watchlistResults.length > 0) {
					return watchlistResults;
				}
			}
		}
	}

	// PRIORITY 2: Fallback to summary format if detailed hits are not available
	// Extract watchlist hits from summary format (curated data from Trulioo)
	// Format: { "Advanced Watchlist": { watchlistStatus: "Potential Hit", watchlistHitDetails: { num_WL_hits: 138, ... } } }
	const watchlistData = watchlistNode.watchlistResults || watchlistNode;
	if (watchlistData && typeof watchlistData === "object" && !Array.isArray(watchlistData)) {
		const watchlistNames = Object.keys(watchlistData);
		const directProperties = ["watchlistStatus", "wlHitsNumber", "amHitsNumber", "pepHitsNumber", "listName", "confidence", "matchDetails"];

		for (const watchlistName of watchlistNames) {
			// Skip direct properties - these are not watchlist names
			if (directProperties.includes(watchlistName)) {
				continue;
			}

			const watchlistInfo = watchlistData[watchlistName];
			if (!watchlistInfo || typeof watchlistInfo !== "object") {
				continue;
			}

			// Get hits from watchlistHitDetails or WatchlistData (summary structures)
			const hits = watchlistInfo?.watchlistHitDetails || watchlistInfo?.WatchlistData || watchlistInfo;
			if (!hits || typeof hits !== "object") {
				continue;
			}

			// Extract hit counts - support both formats: wlHitsNumber/amHitsNumber/pepHitsNumber AND num_WL_hits/num_AM_hits/num_PEP_hits
			const wlHits = Number(hits.wlHitsNumber || hits.num_WL_hits) || 0;
			const amHits = Number(hits.amHitsNumber || hits.num_AM_hits) || 0;
			const pepHits = Number(hits.pepHitsNumber || hits.num_PEP_hits) || 0;
			const totalHits = wlHits + amHits + pepHits;

			if (totalHits > 0) {
				const confidence = Number(hits.confidence || watchlistInfo?.confidence) || 0;

				// Create individual SANCTIONS entries (placeholder format)
				for (let i = 0; i < wlHits; i++) {
					watchlistResults.push({
						listType: "SANCTIONS",
						listName: watchlistName,
						confidence,
						matchDetails: `Watchlist hit ${i + 1} of ${wlHits}`
					});
				}

				// Create individual ADVERSE_MEDIA entries (placeholder format)
				for (let i = 0; i < amHits; i++) {
					watchlistResults.push({
						listType: "ADVERSE_MEDIA",
						listName: watchlistName,
						confidence,
						matchDetails: `Adverse media hit ${i + 1} of ${amHits}`
					});
				}

				// Create individual PEP entries (placeholder format)
				for (let i = 0; i < pepHits; i++) {
					watchlistResults.push({
						listType: "PEP",
						listName: watchlistName,
						confidence,
						matchDetails: `PEP hit ${i + 1} of ${pepHits}`
					});
				}
			}
		}

		// Return if we found hits from summary
		if (watchlistResults.length > 0) {
			return watchlistResults;
		}

		// Fallback: Check if watchlistResults is a direct object with summary (simpler format)
		// Format: { watchlistStatus: "Potential Hit", wlHitsNumber: 48, ... }
		if (watchlistData.watchlistStatus && watchlistData.wlHitsNumber !== undefined) {
			const watchlistStatus = String(watchlistData.watchlistStatus).toLowerCase();
			const wlHitsNumber = Number(watchlistData.wlHitsNumber) || 0;
			const amHitsNumber = Number(watchlistData.amHitsNumber) || 0;
			const pepHitsNumber = Number(watchlistData.pepHitsNumber) || 0;

			if (
				(watchlistStatus === "potential hit" || watchlistStatus === "hit") &&
				(wlHitsNumber > 0 || amHitsNumber > 0 || pepHitsNumber > 0)
			) {
				const listName = watchlistData.listName || "Watchlist";
				const confidence = Number(watchlistData.confidence) || 0;

				// Create individual SANCTIONS entries (placeholder format)
				for (let i = 0; i < wlHitsNumber; i++) {
					watchlistResults.push({
						listType: "SANCTIONS",
						listName,
						confidence,
						matchDetails: `Watchlist hit ${i + 1} of ${wlHitsNumber}`
					});
				}

				// Create individual ADVERSE_MEDIA entries (placeholder format)
				for (let i = 0; i < amHitsNumber; i++) {
					watchlistResults.push({
						listType: "ADVERSE_MEDIA",
						listName: watchlistData.listName || "Adverse Media",
						confidence,
						matchDetails: `Adverse media hit ${i + 1} of ${amHitsNumber}`
					});
				}

				// Create individual PEP entries (placeholder format)
				for (let i = 0; i < pepHitsNumber; i++) {
					watchlistResults.push({
						listType: "PEP",
						listName: watchlistData.listName || "PEP",
						confidence,
						matchDetails: `PEP hit ${i + 1} of ${pepHitsNumber}`
					});
				}

				if (watchlistResults.length > 0) {
					return watchlistResults;
				}
			}
		}
	}

	// If we reach here, no hits were found
	return undefined;
}

/**
 * Extracts StandardizedIndustries from Trulioo response
 * StandardizedIndustries can contain industry classification codes like NAICS, SIC, etc.
 * @param rawClientData - The raw clientData from Trulioo response
 * @returns Array of industry objects with classification codes, or undefined if not found
 */
export function extractStandardizedIndustriesFromTruliooResponse(rawClientData: any): Array<{
	naicsCode?: string;
	sicCode?: string;
	industryName?: string;
	industryDescription?: string;
}> | undefined {
	const serviceDataArray = getServiceDataArray(rawClientData);

	if (serviceDataArray.length === 0) {
		return undefined;
	}

	const industries: Array<{
		naicsCode?: string;
		sicCode?: string;
		industryName?: string;
		industryDescription?: string;
	}> = [];

	// Search through all serviceData items for StandardizedIndustries
	for (const serviceDataItem of serviceDataArray) {
		if (!serviceDataItem?.fullServiceDetails?.Record?.DatasourceResults) {
			continue;
		}

		const datasourceResults = serviceDataItem.fullServiceDetails.Record.DatasourceResults;

		for (const datasource of datasourceResults) {
			if (!datasource?.AppendedFields || !Array.isArray(datasource.AppendedFields)) {
				continue;
			}

			const standardizedIndustriesField = datasource.AppendedFields.find(
				(field: any) => field.FieldName === "StandardizedIndustries"
			);

			if (!standardizedIndustriesField?.Data) {
				continue;
			}

			let standardizedIndustriesData: any;
			try {
				if (typeof standardizedIndustriesField.Data === "string") {
					standardizedIndustriesData = JSON.parse(standardizedIndustriesField.Data);
				} else {
					standardizedIndustriesData = standardizedIndustriesField.Data;
				}
			} catch (e) {
				continue;
			}

			const standardizedIndustries = standardizedIndustriesData?.StandardizedIndustries;
			if (!Array.isArray(standardizedIndustries) || standardizedIndustries.length === 0) {
				continue;
			}

			for (const industry of standardizedIndustries) {
				const industryObj: {
					naicsCode?: string;
					sicCode?: string;
					industryName?: string;
					industryDescription?: string;
				} = {};

				const naicsCode = extractFieldValue(industry, "NAICSCode", "NaicsCode", "naicsCode");
				if (naicsCode && /^\d{6}$/.test(naicsCode)) {
					industryObj.naicsCode = naicsCode;
				}

				industryObj.sicCode = extractFieldValue(industry, "SICCode", "SicCode", "sicCode");
				industryObj.industryName = extractFieldValue(industry, "IndustryName", "industryName", "Name", "name");
				industryObj.industryDescription = extractFieldValue(industry, "IndustryDescription", "industryDescription", "Description", "description");
				if (industryObj.naicsCode || industryObj.sicCode || industryObj.industryName || industryObj.industryDescription) {
					industries.push(industryObj);
				}
			}
		}
	}

	return industries.length > 0 ? industries : undefined;
}

/**
 * Sanitizes a string for safe logging by removing newline characters
 * to prevent Log Injection vulnerabilities (CWE-117).
 * @param input - The string to sanitize
 * @returns The sanitized string
 */
export function sanitizeLog(input: string | number | undefined | null): string {
	return String(input || "").replace(/\n|\r/g, "");
}

/**
 * Generate a deterministic UUID from a string input
 * Uses SHA-256 hash to ensure same input produces same UUID
 * @param input - The string to hash into a UUID
 * @returns A 36-character UUID string
 */
export function generateDeterministicUUID(input: string): string {
	const { createHash } = require("crypto");
	const hash = createHash("sha256").update(input).digest();
	// Convert first 16 bytes to UUID format (v4 style)
	const hex = hash.toString("hex").substring(0, 32);
	return `${hex.substring(0, 8)}-${hex.substring(8, 12)}-4${hex.substring(13, 16)}-${((parseInt(hex.substring(16, 18), 16) & 0x3f) | 0x80).toString(16)}${hex.substring(18, 20)}-${hex.substring(20, 32)}`;
}

/**
 * Converts a 24-character Trulioo ID (hfSession/external_id) to a 36-character UUID format.
 * Trulioo uses 24-char hex strings. This utility pads and formats them into standard UUID strings.
 * @param truliooId - The 24-character ID from Trulioo
 * @returns A 36-character UUID string
 */
export function convertToUUIDFormat(truliooId: string): string {
	if (truliooId && truliooId.length === 24) {
		const paddedId = truliooId.padEnd(32, "0");
		return `${paddedId.substring(0, 8)}-${paddedId.substring(8, 12)}-${paddedId.substring(12, 16)}-${paddedId.substring(16, 20)}-${paddedId.substring(20, 32)}`;
	}
	return truliooId;
}

/**
 * Extracts StandardizedLocations from Trulioo response
 * @param rawClientData - The raw clientData from Trulioo response
 * @returns Array of location objects, or undefined if not found
 */
export function extractStandardizedLocationsFromTruliooResponse(rawClientData: Record<string, unknown>): TruliooStandardizedLocation[] | undefined {
	const serviceDataArray = getServiceDataArray(rawClientData);
	const locations: TruliooStandardizedLocation[] = [];

	for (const serviceDataItem of serviceDataArray) {
		const field = findFieldInAppendedFields(serviceDataItem?.fullServiceDetails?.Record?.DatasourceResults, "StandardizedLocations");
		if (!field?.data) continue;

		try {
			const data = typeof field.data === "string" ? JSON.parse(field.data) : field.data;
			const standardizedLocations = (data as Record<string, unknown>)?.StandardizedLocations;
			if (Array.isArray(standardizedLocations)) {
				locations.push(...standardizedLocations.filter((loc: Record<string, unknown>) => loc.Address1 || loc.City) as TruliooStandardizedLocation[]);
			}
		} catch {
			continue;
		}
	}

	return locations.length > 0 ? locations : undefined;
}

/**
 * Address-related field names in Trulioo DatasourceFields.
 * These are the fields that indicate whether the submitted address
 * matches the registered/reported address from each datasource.
 */
const ADDRESS_FIELD_NAMES = new Set([
	"Address1",
	"StreetName",
	"StreetType",
	"BuildingNumber",
	"City",
	"PostalCode",
	"StateProvinceCode",
	"Suburb"
]);

/** The official consolidated datasource name in Trulioo KYB responses. */
const COMPREHENSIVE_VIEW_DATASOURCE = "Comprehensive View";

/** Type alias for the address match result. */
type AddressMatchResult = "match" | "nomatch" | undefined;

/**
 * Extracts the address match status from Trulioo DatasourceFields.
 *
 * Trulioo returns per-field match statuses inside each DatasourceResult:
 *   DatasourceResults[].DatasourceFields[{ Status, FieldName }]
 *
 * Status values: "match", "nomatch", "missing"
 *
 * Rule (aligned with product on 2026-02-13):
 *   - If ANY address field has "nomatch" → the submitted address does NOT
 *     match the registered address → return "nomatch"
 *   - If all address fields are "match" or "missing" → return "match"
 *   - If no DatasourceFields are found → return undefined (caller decides fallback)
 *
 * IMPORTANT: We use ONLY the "Comprehensive View" datasource from Trulioo.
 * The Comprehensive View is Trulioo's consolidated/official result that aggregates
 * data from multiple individual datasources (Business Insights, Business Essentials, etc.).
 * Individual datasources may report "nomatch" on address fields due to having
 * different/incomplete data, while the Comprehensive View correctly shows "match"
 * when the primary registry confirms the address.
 *
 * If no Comprehensive View is found, we fall back to checking all datasources.
 *
 * @param clientData - The clientData from Trulioo response
 * @returns "match" | "nomatch" | undefined
 */
export function extractAddressMatchStatusFromDatasourceFields(
	clientData: Record<string, unknown> | undefined
): AddressMatchResult {
	if (!clientData) return undefined;

	const serviceDataArray = getServiceDataArray(clientData);

	// First pass: look for the "Comprehensive View" datasource (Trulioo's consolidated result)
	const comprehensiveResult = evaluateAddressFields(serviceDataArray, COMPREHENSIVE_VIEW_DATASOURCE);
	if (comprehensiveResult !== undefined) {
		return comprehensiveResult;
	}

	// Fallback: if no Comprehensive View found, check all datasources
	return evaluateAddressFields(serviceDataArray);
}

/**
 * Evaluate address-related DatasourceFields and return the aggregated match status.
 *
 * @param serviceDataArray - Array of Trulioo serviceData items
 * @param datasourceNameFilter - When provided, only this named datasource is inspected.
 *                               When omitted, ALL datasources are checked (fallback).
 * @returns "match" if all address fields are match/missing,
 *          "nomatch" if ANY address field has nomatch,
 *          undefined if no address fields were found at all.
 */
function evaluateAddressFields(
	serviceDataArray: unknown[],
	datasourceNameFilter?: string
): AddressMatchResult {
	let foundAddressFields = false;

	for (const serviceDataItem of serviceDataArray) {
		const datasourceResults =
			(serviceDataItem as Record<string, any>)?.fullServiceDetails?.Record?.DatasourceResults;
		if (!Array.isArray(datasourceResults)) continue;

		for (const datasource of datasourceResults) {
			if (datasourceNameFilter && datasource?.DatasourceName !== datasourceNameFilter) continue;

			const fields = datasource?.DatasourceFields;
			if (!Array.isArray(fields)) continue;

			for (const field of fields) {
				if (!ADDRESS_FIELD_NAMES.has(field?.FieldName)) continue;

				foundAddressFields = true;

				if (field.Status === "nomatch") {
					return "nomatch";
				}
			}
		}
	}

	return foundAddressFields ? "match" : undefined;
}

/**
 * Extracts person name from Trulioo response, checking multiple possible locations:
 * 1. Direct fields: fullName, personName, person_name
 * 2. firstName + lastName combination
 * 3. flowData.fieldData with roles first_name/last_name (PSC flow structure)
 *
 * @param rawClientData - The raw clientData from Trulioo response
 * @returns Object with personName, firstName, and lastName, or undefined if not found
 */
export function extractPersonNameFromTruliooResponse(rawClientData: any): {
	personName: string;
	firstName?: string;
	lastName?: string;
} | undefined {
	if (!rawClientData) {
		return undefined;
	}

	// Priority 1: Direct name fields
	let personName =
		rawClientData.fullName ||
		rawClientData.personName ||
		rawClientData.person_name;

	if (personName) {
		return {
			personName: personName.trim(),
			firstName: rawClientData.firstName,
			lastName: rawClientData.lastName
		};
	}

	// Priority 2: firstName + lastName combination
	if (rawClientData.firstName || rawClientData.lastName) {
		personName = `${rawClientData.firstName || ""} ${rawClientData.lastName || ""}`.trim();
		if (personName) {
			return {
				personName,
				firstName: rawClientData.firstName,
				lastName: rawClientData.lastName
			};
		}
	}

	// Priority 3: Extract from flowData.fieldData (PSC flow structure)
	if (rawClientData.flowData) {
		const flowDataEntries = Object.values(rawClientData.flowData);
		for (const flowDataItem of flowDataEntries) {
			if (flowDataItem && typeof flowDataItem === "object" && (flowDataItem as any).fieldData) {
				const fieldData = (flowDataItem as any).fieldData;
				const fieldDataEntries = Object.values(fieldData);
				let firstName = "";
				let lastName = "";

				for (const field of fieldDataEntries) {
					if (field && typeof field === "object") {
						const fieldObj = field as any;
						if (fieldObj.role === "first_name" && fieldObj.value && Array.isArray(fieldObj.value) && fieldObj.value.length > 0) {
							firstName = fieldObj.value[0];
						}
						if (fieldObj.role === "last_name" && fieldObj.value && Array.isArray(fieldObj.value) && fieldObj.value.length > 0) {
							lastName = fieldObj.value[0];
						}
					}
				}

				if (firstName || lastName) {
					personName = `${firstName} ${lastName}`.trim();
					return {
						personName,
						firstName: firstName || undefined,
						lastName: lastName || undefined
					};
				}
			}
		}
	}

	return undefined;
}

/**
 * Extracts websiteURL from Trulioo response
 * Searches through serviceData for StandardizedCommunication fields
 * StandardizedCommunication can contain website/URL information
 * @param rawClientData - The raw clientData from Trulioo response
 * @returns Website URL string or undefined
 */
export function extractWebsiteFromTruliooResponse(rawClientData: any): string | undefined {
	const serviceDataArray = getServiceDataArray(rawClientData);

	if (serviceDataArray.length === 0) {
		return undefined;
	}

	// Search through all serviceData items for StandardizedCommunication
	for (const serviceDataItem of serviceDataArray) {
		if (!serviceDataItem?.fullServiceDetails?.Record?.DatasourceResults) {
			continue;
		}

		const datasourceResults = serviceDataItem.fullServiceDetails.Record.DatasourceResults;

		for (const datasource of datasourceResults) {
			if (!datasource?.AppendedFields || !Array.isArray(datasource.AppendedFields)) {
				continue;
			}

			const standardizedCommunicationField = datasource.AppendedFields.find(
				(field: any) => field.FieldName === "StandardizedCommunication"
			);

			if (!standardizedCommunicationField?.Data) {
				continue;
			}

			let standardizedCommunicationData: any;
			try {
				if (typeof standardizedCommunicationField.Data === "string") {
					standardizedCommunicationData = JSON.parse(standardizedCommunicationField.Data);
				} else {
					standardizedCommunicationData = standardizedCommunicationField.Data;
				}
			} catch (e) {
				continue;
			}

			const standardizedCommunication = standardizedCommunicationData?.StandardizedCommunication;
			if (!Array.isArray(standardizedCommunication) || standardizedCommunication.length === 0) {
				continue;
			}

			for (const comm of standardizedCommunication) {
				const websiteUrl = extractFieldValue(
					comm,
					"Website", "website", "URL", "url", "WebsiteURL", "websiteUrl", "WebsiteUrl",
					"WebAddress", "webAddress", "Domain", "domain"
				);

				if (websiteUrl && typeof websiteUrl === "string") {
					const trimmedUrl = websiteUrl.trim();
					if (
						trimmedUrl.startsWith("http://") ||
						trimmedUrl.startsWith("https://") ||
						/^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/.test(trimmedUrl)
					) {
						if (!trimmedUrl.startsWith("http://") && !trimmedUrl.startsWith("https://")) {
							return `https://${trimmedUrl}`;
						}
						return trimmedUrl;
					}
				}
			}
		}
	}

	return undefined;
}

/**
 * Returns the short nodeType form for comparison (e.g. "trulioo_business_wl" or "_business_wl" → "business_wl").
 * Call this when reading nodeType so both in-memory and stored values match the same checks.
 */
export function toShortNodeType(nodeType: string | undefined): string | undefined {
	if (!nodeType || typeof nodeType !== "string") return nodeType;
	if (nodeType.startsWith("trulioo_")) return nodeType.slice(8);
	if (nodeType.startsWith("_")) return nodeType.slice(1);
	return nodeType;
}

/**
 * Sanitizes Trulioo payload before saving to DB: hides "trulioo" label per requirement.
 * - Sets provider to "" (empty string) when present.
 * - Replaces nodeType values: "trulioo_*" → "*" (e.g. trulioo_kyb_insights → kyb_insights, trulioo_business_wl → business_wl).
 * Applies recursively to nested objects and arrays. Does not mutate input.
 *
 * @param payload - Raw response object (KYB or PSC) to sanitize before persisting
 * @returns A copy of the payload with provider emptied and nodeType labels sanitized
 */
export function sanitizeTruliooLabelsFromPayload<T>(payload: T): T {
	if (payload === null || typeof payload !== "object") {
		return payload;
	}
	if (Array.isArray(payload)) {
		return payload.map((item) =>
			item !== null && typeof item === "object"
				? sanitizeTruliooLabelsFromPayload(item as object)
				: item
		) as T;
	}
	const result = { ...payload } as Record<string, unknown>;
	for (const key of Object.keys(result)) {
		const val = result[key];
		if (key === "provider" && typeof val === "string") {
			result[key] = "";
		} else if (key === "nodeType" && typeof val === "string") {
			result[key] = toShortNodeType(val) ?? val;
		} else if (val !== null && typeof val === "object" && !Array.isArray(val)) {
			result[key] = sanitizeTruliooLabelsFromPayload(val as object);
		} else if (Array.isArray(val)) {
			result[key] = val.map((item) =>
				item !== null && typeof item === "object"
					? sanitizeTruliooLabelsFromPayload(item as object)
					: item
			);
		}
	}
	return result as T;
}
