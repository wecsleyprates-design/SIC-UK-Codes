import type { IntegrationFactGetMetadata } from "../types";
import type { MatchTaskMetadata, MatchPrebuiltMerchant } from "#lib/match/types";
import { type BusinessAddress } from "#helpers/api";
import { allFacts, FactEngineWithDefaultOverrides, FactRules } from "#lib/facts";
import { FactName } from "#lib/facts/types";
import { matchConnection } from "#api/v1/modules/match-pro/matchConnection";
import { logger } from "#helpers/logger";
import { createAdapter } from "../shared/createAdapter";
import { Match } from "#lib/match/match";
import { AddressUtil } from "#utils";
import { normalizeCountryCode } from "#utils/addressUtil";
import { normalizePhoneNumber, removeSpecialCharacters } from "#utils/normalizer";
import { envConfig } from "#configs";
import { BusinessScoreTriggerRepository } from "#core/scoreTrigger";
import type { UUID } from "crypto";
import { OwnerData } from "#lib/facts/kyc";

const FACT_NAMES: FactName[] = [
	"business_name",
	"dba",
	"primary_address",
	"addresses",
	"business_addresses_submitted",
	"tin",
	"website",
	"business_phone",
	"mcc_code",
	"mcc_code_found",
	"mcc_code_from_naics",
	"owners_submitted"
];

/**
 * Adapter for the Mastercard MATCH integration.
 *
 * Builds a MatchPrebuiltMerchant from resolved facts and stores it in task metadata.
 * The task handler (Match.createMatchInquiryPayload) uses this to bypass the case service
 * fetch and build the TerminationInquiryRequest purely from facts.
 */
const getMetadata: IntegrationFactGetMetadata<MatchTaskMetadata> = async businessID => {
	/** 1. Set up fact engine */
	const facts = allFacts.filter(fact => FACT_NAMES.includes(fact.name));
	const factEngine = new FactEngineWithDefaultOverrides(facts, { business: businessID });
	await factEngine.applyRules(FactRules.factWithHighestConfidence);

	/** 2. Resolve facts */
	const businessName = factEngine.getResolvedFact<string>("business_name")?.value;
	const dba = factEngine.getResolvedFact<string[]>("dba")?.value;
	const primaryAddress = factEngine.getResolvedFact<BusinessAddress>("primary_address")?.value;
	const addresses = factEngine.getResolvedFact<string[]>("addresses")?.value;
	const businessAddressesSubmitted =
		factEngine.getResolvedFact<BusinessAddress[]>("business_addresses_submitted")?.value;
	const tin = factEngine.getResolvedFact<string>("tin")?.value;
	const website = factEngine.getResolvedFact<string>("website")?.value;
	const businessPhone = factEngine.getResolvedFact<string>("business_phone")?.value;
	const mccCode = factEngine.getResolvedFact<string>("mcc_code")?.value;
	const mccCodeFound = factEngine.getResolvedFact<string>("mcc_code_found")?.value;
	const mccCodeFromNaics = factEngine.getResolvedFact<string>("mcc_code_from_naics")?.value;
	const ownersSubmitted = factEngine.getResolvedFact<OwnerData[]>("owners_submitted")?.value;

	/** 3. Validate required fields */
	const name = businessName || dba?.[0] || "";
	if (!name) {
		logger.debug({ businessID }, "Match adapter: Missing required business name");
		return undefined;
	}

	/** 4. Resolve address */
	let resolvedAddress: {
		line_1: string;
		apartment?: string | null;
		city: string;
		state: string;
		postal_code: string;
		country: string;
		is_primary?: boolean;
	} | null = null;

	if (primaryAddress) {
		resolvedAddress = primaryAddress;
	} else if (businessAddressesSubmitted?.length) {
		resolvedAddress = businessAddressesSubmitted.find(a => a.is_primary) ?? businessAddressesSubmitted[0];
	} else if (Array.isArray(addresses) && addresses.length > 0) {
		const parts = AddressUtil.stringToParts(addresses[0]);
		resolvedAddress = {
			line_1: parts.line_1 || "",
			city: parts.city || "",
			state: parts.state || "",
			postal_code: parts.postal_code || "",
			country: parts.country || "US"
		};
	}

	if (!resolvedAddress) {
		logger.debug({ businessID }, "Match adapter: Missing required address");
		return undefined;
	}

	/** 5. Using the fact values, create a fact values object to be used with Match.resolveMccCode */
	const businessFactValues = {
		business_name: { value: businessName },
		business_phone: { value: businessPhone },
		website: { value: website },
		mcc_code: { value: mccCode },
		mcc_code_found: { value: mccCodeFound },
		mcc_code_from_naics: { value: mccCodeFromNaics }
	};

	const merchant: MatchPrebuiltMerchant = {
		name: removeSpecialCharacters(name),
		doingBusinessAsName: removeSpecialCharacters(dba?.[0] || name),
		phoneNumber: normalizePhoneNumber(businessPhone),
		altPhoneNumber: "",
		merchantCategory: Match.resolveMccCode(businessFactValues, null),
		nationalTaxId: envConfig.MATCH_ENV === "production" && tin ? tin : "",
		urls: website ? [website] : [],
		address: {
			addressLineOne: resolvedAddress.line_1 || "",
			addressLineTwo: resolvedAddress.apartment || "",
			city: resolvedAddress.city || "",
			isOtherCity: "N",
			countrySubdivision: resolvedAddress.state || "",
			country: normalizeCountryCode(resolvedAddress.country || ""),
			postalCode: resolvedAddress.postal_code?.slice(0, 5) || ""
		},
		principals: Match.transformOwnersToPrincipals(ownersSubmitted ?? [], businessPhone ?? null)
	};

	return { merchant };
};

export const matchAdapter = createAdapter<MatchTaskMetadata>({
	getMetadata,
	factNames: FACT_NAMES,
	checkRunnable: async params => {
		try {
			const { business_id } = params;
			if (!business_id) {
				logger.debug("Match adapter: Missing business_id, skipping");
				return false;
			}

			const businessScoreTriggerRepository = new BusinessScoreTriggerRepository();
			const businessScoreTrigger = await businessScoreTriggerRepository.getBusinessScoreTriggerByBusinessId(
				business_id as UUID
			);

			const credentials = await matchConnection.getCustomerCredentials(businessScoreTrigger.customer_id as UUID);

			if (!credentials?.isActive) {
				logger.debug(
					{ customerId: businessScoreTrigger.customer_id },
					"Match adapter: MATCH credentials are inactive or missing, skipping"
				);
				return false;
			}

			return true;
		} catch (error) {
			logger.error({ error, params }, "Match adapter: Error running matchAdapter checkRunnable");
			return false;
		}
	}
});
