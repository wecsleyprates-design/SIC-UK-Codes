import type { OpenCorporateResponse } from "#lib/opencorporates/types";
import { sources } from "../sources";
import { simpleFactToFacts, type Fact, type SimpleFact } from "../types";
import { logger } from "#helpers/index";

/**
 * Canada-specific facts
 *
 * business_id is intentionally here to make sure businessDetails is pulled into scope (needed for TIN)
 */

const simpleFacts: SimpleFact = {
	business_id: {
		businessDetails: "id"
	},
	canada_business_number_found: {
		canadaopen: "business.business_number",
		opencorporates: async (_, oc: OpenCorporateResponse) => {
			if (oc?.firmographic?.business_number) {
				// BC has business_number ending in `.0`
				if ((oc.firmographic.jurisdiction_code = "ca_bc")) {
					return oc.firmographic.business_number.replace(/\.0$/, "");
				}
			}
		}
	},
	canada_corporate_id_found: {
		canadaopen: "business.corporate_id"
	},
	canada_business_number_match: {
		description: "A boolean value indicating if a provided ID matches the Canadian Business Number for the matched business record",
		calculated: {
			dependencies: ["canada_business_number_found"],
			fn: async (engine): Promise<boolean> => {
				const tin = engine.getSource("businessDetails")?.rawResponse?.tin;
				const canadaOpenSource = engine.getSource("canadaopen");
				const rawResponse = canadaOpenSource?.rawResponse;

				// The first match in all_matches is the highest confidence match
				const topMatch = rawResponse?.all_matches?.[0];

				if (!topMatch) {
					return false;
				}

				// We want to check if extra_verification result is available and use it as our primary source of truth.
				const canadaBusinessNumberMatchResult = topMatch?.extra_verification?.canada_open_business_number_match;

				// if the result is null, fall back to direct comparison
				return canadaBusinessNumberMatchResult ?? (tin && topMatch?.integration_business?.business_number == tin);
			}
		}
	},
	canada_corporate_id_match: {
		description: "A boolean value indicating if a provided ID matches any Canadian registry ID number",
		calculated: {
			dependencies: ["canada_corporate_id_found"],
			fn: async (engine): Promise<boolean> => {
				const tin = engine.getSource("businessDetails")?.rawResponse?.tin;
				const canadaOpenSource = engine.getSource("canadaopen");
				const rawResponse = canadaOpenSource?.rawResponse;

				// The first match in all_matches is the highest confidence match
				const topMatch = rawResponse?.all_matches?.[0];

				if (!topMatch) {
					return false;
				}

				// We want to check if extra_verification result is available and use it as our primary source of truth.
				const canadaCorporateIdMatchResult = topMatch?.extra_verification?.canada_open_corporate_id_match;

				// if the result is null, fall back to direct comparison
				return canadaCorporateIdMatchResult ?? (tin && topMatch?.integration_business?.corporate_id == tin);
			}
		}
	},
	canada_id_number_match: {
		description: "A boolean value indicating if a provided ID matches any Canadian registry ID number",
		calculated: {
			dependencies: ["canada_corporate_id_match", "canada_business_number_match"],
			fn: async (engine): Promise<boolean> => {
				const corpId = engine.getResolvedFact("canada_corporate_id_match")?.value;
				const bn = engine.getResolvedFact("canada_business_number_match")?.value;
				return bn || corpId;
			}
		}
	}
};

export const facts: readonly Fact[] = simpleFactToFacts(simpleFacts, sources);
