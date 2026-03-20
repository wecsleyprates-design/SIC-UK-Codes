import type { IntegrationFactGetMetadata } from "../types";
import { type BusinessAddress } from "#helpers/api";
import { allFacts, FactEngineWithDefaultOverrides, FactRules } from "#lib/facts";
import { FactName } from "#lib/facts/types";
import type { TruliooBusinessData } from "#lib/trulioo/common/types";
import { AddressUtil } from "#utils";
import { createAdapter } from "../shared/createAdapter";
import { logger } from "#helpers/logger";
import { TruliooBusiness } from "#lib/trulioo/business/truliooBusiness";
import { UUID } from "crypto";

const FACT_NAMES: FactName[] = ["business_name", "dba", "primary_address", "addresses", "tin"];

/**
 * Adapter that converts resolved facts into Trulioo business data format.
 *
 * Returns data in the same format as getBusinessDetails() so it can be used
 * directly by processKYBFlow without any conversion.
 *
 * Trulioo KYB requires:
 * - Business name (required)
 * - Country (required)
 * - Postal code (required)
 * - State, city, and address line (recommended)
 * - Registration number/TIN (optional but improves matching)
 *
 * Note: Business verification automatically extracts and screens UBOs/Directors using the PSC
 * (Person Screening) flow, following the Middesk pattern. No separate person verification adapter
 * is needed.
 */
const getMetadata: IntegrationFactGetMetadata<TruliooBusinessData> = async businessID => {
	/** 1. Set up fact engine */
	const facts = allFacts.filter(fact => FACT_NAMES.includes(fact.name));
	const factEngine = new FactEngineWithDefaultOverrides(facts, { business: businessID });
	await factEngine.applyRules(FactRules.factWithHighestConfidence);

	/** 2. Fetch data from facts */
	const businessName = factEngine.getResolvedFact<string>("business_name")?.value;
	const dba = factEngine.getResolvedFact<string[]>("dba")?.value;
	const primaryAddress = factEngine.getResolvedFact<BusinessAddress>("primary_address")?.value;
	const addresses = factEngine.getResolvedFact<string[]>("addresses")?.value;
	const tin = factEngine.getResolvedFact<string>("tin")?.value;

	/** 3. Determine the business name to use (prefer business_name over DBA) */
	const name = businessName || dba?.[0] || "";

	/** 4. Determine the primary address to use */
	let addressData: {
		line_1: string;
		city: string;
		state: string;
		postal_code: string;
		country: string;
	} | null = null;

	if (primaryAddress) {
		addressData = {
			line_1: primaryAddress.line_1 || "",
			city: primaryAddress.city || "",
			state: primaryAddress.state || "",
			postal_code: primaryAddress.postal_code?.slice(0, 10) || "",
			country: primaryAddress.country || "US"
		};
	} else if (Array.isArray(addresses) && addresses.length > 0) {
		// Fallback to parsing the first address string
		const parts = AddressUtil.stringToParts(addresses[0]);
		addressData = {
			line_1: parts.line_1 || "",
			city: parts.city || "",
			state: parts.state || "",
			postal_code: parts.postal_code?.slice(0, 10) || "",
			country: parts.country || "US"
		};
	}

	/** 5. Validate required fields */
	if (!name) {
		logger.debug({ businessID }, "Trulioo adapter: Missing required business name");
		return undefined;
	}

	if (!addressData || !addressData.country || !addressData.postal_code) {
		logger.debug(
			{ businessID, addressData },
			"Trulioo adapter: Missing required address data (country and postal code)"
		);
		return undefined;
	}

	/** 6. Build metadata in TruliooBusinessData format (same as getBusinessDetails returns) */
	const metadata: TruliooBusinessData = {
		name,
		tin,
		business_addresses: [
			{
				...addressData,
				is_primary: true
			}
		]
	};

	/** 7. Return metadata */
	return metadata;
};

/** Attach fact dependencies metadata to the adapter */
export const truliooAdapter = createAdapter<TruliooBusinessData>({
	getMetadata,
	factNames: FACT_NAMES,
	checkRunnable: async ({ business_id }) => {
		if (!business_id) return false;
		return await TruliooBusiness.canIRun(business_id as UUID);
	}
});
