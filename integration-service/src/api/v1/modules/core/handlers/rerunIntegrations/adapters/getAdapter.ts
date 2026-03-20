import type { IntegrationFactAdapter } from "./types";
import { serpGoogleProfileAdapter } from "./serpGoogleProfileAdapter";
import { middeskAdapter } from "./middeskAdapter";
import { openCorporatesAdapter } from "./openCorporatesAdapter";
import { truliooAdapter } from "./truliooAdapter";
import { plaidIdvAdapter } from "./plaidIdvAdapter";
import { INTEGRATION_ID } from "#constants";
import type { IntegrationPlatformId } from "#constants";
import { verdataAdapter } from "./verdataAdapter/verdataAdapter";
import { serpScrapeAdapter } from "./serpScrapeAdapter/serpScrapeAdapter";
import { entityMatchingAdapter } from "./entityMatchingAdapter/entityMatchingAdapter";
import { worthWebsiteScanningAdapter } from "./worthWebsiteScanningAdapter";
import { matchAdapter } from "./matchAdapter/matchAdapter";
import { zoomInfoAdapter } from "./zoomInfoAdapter";
/**
 * Registry of integration adapters.
 * Maps platform IDs to their respective adapter functions.
 */
export const ADAPTER_REGISTRY: Record<IntegrationPlatformId, IntegrationFactAdapter | undefined> = {
	[INTEGRATION_ID.MIDDESK]: middeskAdapter,
	[INTEGRATION_ID.OPENCORPORATES]: openCorporatesAdapter,
	[INTEGRATION_ID.SERP_GOOGLE_PROFILE]: serpGoogleProfileAdapter,
	[INTEGRATION_ID.TRULIOO]: truliooAdapter,
	[INTEGRATION_ID.PLAID_IDV]: plaidIdvAdapter,
	[INTEGRATION_ID.VERDATA]: verdataAdapter,
	[INTEGRATION_ID.SERP_SCRAPE]: serpScrapeAdapter,
	[INTEGRATION_ID.ENTITY_MATCHING]: entityMatchingAdapter,
	[INTEGRATION_ID.WORTH_WEBSITE_SCANNING]: worthWebsiteScanningAdapter,
	[INTEGRATION_ID.MATCH]: matchAdapter,
	[INTEGRATION_ID.ZOOMINFO]: zoomInfoAdapter,
	// Add more adapters here as they are implemented
	[INTEGRATION_ID.PLAID]: undefined,
	[INTEGRATION_ID.QUICKBOOKS]: undefined,
	[INTEGRATION_ID.PERSONA]: undefined,
	[INTEGRATION_ID.RUTTER_QUICKBOOKS]: undefined,
	[INTEGRATION_ID.RUTTER_XERO]: undefined,
	[INTEGRATION_ID.RUTTER_ZOHO]: undefined,
	[INTEGRATION_ID.RUTTER_FRESHBOOKS]: undefined,
	[INTEGRATION_ID.RUTTER_QUICKBOOKSDESKTOP]: undefined,
	[INTEGRATION_ID.RUTTER_WAVE]: undefined,
	[INTEGRATION_ID.RUTTER_NETSUITE]: undefined,
	[INTEGRATION_ID.RUTTER_STRIPE]: undefined,
	[INTEGRATION_ID.RUTTER_SQUARE]: undefined,
	[INTEGRATION_ID.RUTTER_PAYPAL]: undefined,
	[INTEGRATION_ID.TAX_STATUS]: undefined,
	[INTEGRATION_ID.EQUIFAX]: undefined,
	[INTEGRATION_ID.GOOGLE_PLACES_REVIEWS]: undefined,
	[INTEGRATION_ID.GOOGLE_BUSINESS_REVIEWS]: undefined,
	[INTEGRATION_ID.MANUAL]: undefined,
	[INTEGRATION_ID.ELECTRONIC_SIGNATURE]: undefined,
	[INTEGRATION_ID.GIACT]: undefined,
	[INTEGRATION_ID.ADVERSE_MEDIA]: undefined,
	[INTEGRATION_ID.NPI]: undefined,
	[INTEGRATION_ID.AI_NAICS_ENRICHMENT]: undefined,
	[INTEGRATION_ID.CANADA_OPEN]: undefined,
	[INTEGRATION_ID.AI_SANITIZATION]: undefined,
	[INTEGRATION_ID.MANUAL_BANKING]: undefined,
	[INTEGRATION_ID.MANUAL_ACCOUNTING]: undefined,
	[INTEGRATION_ID.AI_WEBSITE_ENRICHMENT]: undefined,
	[INTEGRATION_ID.KYX]: undefined,
	[INTEGRATION_ID.STRIPE]: undefined,
	[INTEGRATION_ID.TRULIOO_PSC]: undefined,
	[INTEGRATION_ID.BASELAYER]: undefined
};

/**
 * Gets the adapter for a given platform ID.
 * @param platformId - The platform ID
 * @returns The adapter function, or undefined if no adapter exists
 */
export const getAdapter = <T = any>(platformId: IntegrationPlatformId): IntegrationFactAdapter<T> | undefined => {
	return ADAPTER_REGISTRY[platformId];
};
