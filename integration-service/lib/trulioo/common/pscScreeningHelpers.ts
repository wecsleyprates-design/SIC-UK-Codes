/**
 * PSC Screening Helpers for Trulioo Integration
 * 
 * Contains helper functions for determining if PSC (Person of Significant Control) screening
 * should be performed based on customer settings and business territory.
 * 
 * This module implements the PSC screening logic:
 * - For non-US businesses (Canada, UK, etc.): PSC screening happens automatically when International KYB is enabled
 *   This is part of the standard Trulioo integration flow (BTTF-205 scope)
 * - For US businesses: PSC screening only if Advanced Watchlists toggle is enabled (future work)
 * - International KYB (Trulioo) must be enabled as a prerequisite for all PSC screening
 */

import { getBusinessCustomers } from "#helpers/api";
import { customerIntegrationSettings } from "#api/v1/modules/customer-integration-settings/customer-integration-settings";
import { logger } from "#helpers/logger";
import type { UUID } from "crypto";

/**
 * Constants for PSC screening logic
 */
const UK_COUNTRY_CODES = ["GB", "UK"] as const;
const US_COUNTRY_CODES = ["US", "USA"] as const;
const TRULIOO_INTEGRATION_CODE = "trulioo" as const;
const INTEGRATION_STATUS_ENABLED = "ENABLED" as const;
const ADVANCED_WATCHLIST_SETTING_KEY = "advanced_watchlist" as const;

/**
 * Type definitions for better type safety
 */
interface IntegrationStatus {
	integration_code: string;
	status: string;
}

export interface ScreeningDecision {
	shouldScreen: boolean;
	reason: string;
}

/**
 * Normalize country code to uppercase and trim whitespace
 * @param country - Country code (can be null/undefined)
 * @returns Normalized country code or empty string
 */
function normalizeCountryCode(country: string | null | undefined): string {
	return country?.toUpperCase().trim() || "";
}

/**
 * Check if a country code represents UK
 * @param country - Country code
 * @returns true if country is GB or UK
 */
function isUKCountry(country: string): boolean {
	const normalized = normalizeCountryCode(country);
	return UK_COUNTRY_CODES.includes(normalized as typeof UK_COUNTRY_CODES[number]);
}

/**
 * Check if a country code represents US
 * @param country - Country code
 * @returns true if country is US or USA
 */
function isUSCountry(country: string): boolean {
	const normalized = normalizeCountryCode(country);
	return US_COUNTRY_CODES.includes(normalized as typeof US_COUNTRY_CODES[number]);
}

/**
 * Find Trulioo integration status from integration status array
 * @param integrationStatus - Array of integration statuses
 * @returns Trulioo status or undefined if not found
 */
function findTruliooStatus(integrationStatus: IntegrationStatus[]): IntegrationStatus | undefined {
	return integrationStatus.find(
		(item) => item.integration_code === TRULIOO_INTEGRATION_CODE
	);
}

/**
 * Check if International KYB (Trulioo) is enabled for a customer
 * @param customerId - Customer ID
 * @returns true if Trulioo integration is enabled
 */
async function checkInternationalKYBEnabled(customerId: string): Promise<boolean> {
	const integrationStatus = await customerIntegrationSettings.getIntegrationStatusForCustomer(customerId as UUID);
	const truliooStatus = findTruliooStatus(integrationStatus);
	return truliooStatus?.status === INTEGRATION_STATUS_ENABLED;
}

/**
 * Check if Advanced Watchlists is enabled for a customer
 * @param customerId - Customer ID
 * @returns true if Advanced Watchlists setting is enabled
 */
async function checkAdvancedWatchlistsEnabled(customerId: string): Promise<boolean> {
	return await customerIntegrationSettings.isCustomerIntegrationSettingEnabled(
		customerId as UUID,
		ADVANCED_WATCHLIST_SETTING_KEY
	);
}

/**
 * Get customer ID from business
 * @param businessId - Business ID
 * @returns Customer ID or null if not found
 */
async function getCustomerIdFromBusiness(businessId: UUID): Promise<string | null> {
	const businessCustomers = await getBusinessCustomers(businessId);
	return businessCustomers?.customer_ids?.[0] || null;
}

/**
 * Check if PSC screening should be performed based on customer settings and business territory
 * 
 * Logic:
 * - International KYB (Trulioo) must be enabled as a prerequisite for all PSC screening
 * - For non-US businesses (Canada, UK, etc.): PSC screening happens automatically when International KYB is enabled
 *   This is part of the standard Trulioo integration flow (BTTF-205 scope)
 * - For US businesses: PSC screening only if Advanced Watchlists toggle is enabled (future work)
 *   Currently returns false for US businesses until Advanced Watchlists feature is fully implemented
 *
 * This follows SRP by delegating specific checks to helper functions and DRY by reusing constants.
 *
 * @param businessId - Business ID
 * @param businessCountry - Business country code
 * @returns Object with shouldScreen flag and reason
 */
export async function shouldScreenPSCsForBusiness(
	businessId: UUID,
	businessCountry: string
): Promise<ScreeningDecision> {
	try {
		// Get customer ID from business
		const customerId = await getCustomerIdFromBusiness(businessId);

		if (!customerId) {
			logger.debug({ businessId }, "Could not determine customer ID - skipping PSC screening");
			return { shouldScreen: false, reason: "No customer ID found" };
		}

		// Normalize country code
		const normalizedCountry = normalizeCountryCode(businessCountry);
		const isUS = isUSCountry(normalizedCountry);

		// Check if International KYB is enabled (this is a prerequisite)
		const internationalKYBEnabled = await checkInternationalKYBEnabled(customerId);

		if (!internationalKYBEnabled) {
			logger.debug(
				{ businessId, customerId, country: normalizedCountry },
				"International KYB (Trulioo) is not enabled - skipping PSC screening"
			);
			return { shouldScreen: false, reason: "International KYB not enabled" };
		}

		// For US businesses: PSC screening only if Advanced Watchlists toggle is enabled
		// This is future work - Advanced Watchlists toggle is for US businesses only
		if (isUS) {
			const advancedWatchlistsEnabled = await checkAdvancedWatchlistsEnabled(customerId);
			
			if (!advancedWatchlistsEnabled) {
				logger.debug(
					{ businessId, customerId, country: normalizedCountry },
					"US business - Advanced Watchlists not enabled - skipping PSC screening"
				);
				return { shouldScreen: false, reason: "Advanced Watchlists not enabled for US business" };
			}

			logger.debug(
				{ businessId, customerId, country: normalizedCountry },
				"US business - Advanced Watchlists enabled - PSC screening will proceed"
			);
			return { shouldScreen: true, reason: "Advanced Watchlists enabled for US business" };
		}

		// For non-US businesses (Canada, UK, etc.): PSC screening happens automatically
		// This is part of the standard Trulioo integration flow (BTTF-205 scope)
		// No need to check Advanced Watchlists toggle - it's automatic when International KYB is enabled
		logger.debug(
			{ businessId, customerId, country: normalizedCountry },
			"Non-US business - PSC screening enabled automatically (part of International KYB flow)"
		);
		return { shouldScreen: true, reason: "Non-US business - automatic PSC screening when International KYB is enabled" };
	} catch (error) {
		logger.error(
			{
				error: error instanceof Error ? {
					message: error.message,
					stack: error.stack,
					name: error.name
				} : String(error),
				businessId
			},
			`Error checking if PSC screening should be performed for business ${businessId}`
		);
		// Fail-closed: don't screen if we can't verify settings
		return {
			shouldScreen: false,
			reason: `Error checking settings: ${error instanceof Error ? error.message : "Unknown error"}`
		};
	}
}
