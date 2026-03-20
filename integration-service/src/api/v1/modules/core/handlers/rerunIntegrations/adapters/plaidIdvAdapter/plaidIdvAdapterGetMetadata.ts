import type { IntegrationFactGetMetadata } from "../types";
import { logger } from "#helpers/logger";
import { getOwners } from "#helpers/api";
import type { PlaidIdvMetadata } from "./types";
import { UUID } from "crypto";

/**
 * Adapter that fetches owner information for Plaid Identity Verification.
 *
 * Unlike other integrations that primarily rely on business-level facts (business_name, address, etc.),
 * Plaid IDV operates on individual owners/applicants associated with the business.
 *
 * This adapter:
 * - Fetches unencrypted owner data from the case service
 * - Returns the owners array for enrollment in identity verification
 * - Does not depend on the fact engine since owner data comes from the case service
 *
 * Note: Each owner will be enrolled individually via the PlaidIdv.enrollApplicant() method
 * during the process phase.
 */
export const plaidIdvAdapterGetMetadata: IntegrationFactGetMetadata<PlaidIdvMetadata> = async businessID => {
	try {
		/** 1. Fetch owners from the case service */
		const owners = await getOwners(businessID as UUID);

		/** 2. Validate that we have owners to process */
		if (!owners || !Array.isArray(owners) || owners.length === 0) {
			logger.debug({ businessID }, "Plaid IDV adapter: No owners found for business");
			return undefined;
		}

		/** 3. Filter out owners with insufficient data for IDV */
		const validOwners = owners.filter(owner => {
			const hasRequiredFields = owner.first_name && owner.last_name && owner.address_line_1 && owner.address_city;

			if (!hasRequiredFields) {
				logger.debug(
					{ businessID, owner },
					"Plaid IDV adapter: Owner missing required fields (first_name, last_name, address_line_1, address_city)"
				);
			}

			return hasRequiredFields;
		});

		/** 4. Return undefined if no valid owners */
		if (validOwners.length === 0) {
			logger.debug({ businessID }, "Plaid IDV adapter: No valid owners with required fields");
			return undefined;
		}

		/** 5. Return metadata with valid owners */
		return { owners: validOwners };
	} catch (error) {
		logger.error({ businessID, error }, "Plaid IDV adapter: Error fetching owners");
		return undefined;
	}
};
