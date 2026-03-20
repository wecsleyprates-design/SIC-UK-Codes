import { FactName } from "#lib/facts/types";
import type { PlaidIdvMetadata } from "./types";
import { plaidIdvAdapterGetMetadata as getMetadata } from "./plaidIdvAdapterGetMetadata";
import { plaidIdvAdapterProcess as process } from "./plaidIdvAdapterProcess";
import { createAdapter } from "../shared/createAdapter";

/**
 * Note: This adapter does not currently use the `owners` fact; instead,
 * owner/applicant data is sourced directly from the case service.
 *
 * The reason for this is because the necessary PII data for IDV enrollment
 * (dob, ssn, etc.) is not available in the facts engine.
 *
 * The `owners` fact is still included here for compatibility with the
 * `getPlatformCodesByChangedFacts` and `getPlatformIdsByChangedFacts` functions.
 *
 * @see getPlatformCodesByChangedFacts (src/api/v1/modules/core/handlers/rerunIntegrations/lib/getPlatformCodesByChangedFacts/getPlatformCodesByChangedFacts.ts) for more information.
 * @see getPlatformIdsByChangedFacts (src/api/v1/modules/core/handlers/rerunIntegrations/lib/getPlatformIdsByChangedFacts/getPlatformIdsByChangedFacts.ts) for more information.
 */
const FACT_NAMES: FactName[] = ["owners"];

/**
 * Plaid IDV adapter for the rerunIntegrations feature.
 *
 * Uses a custom process function to handle the unique enrollment pattern
 * where each owner is enrolled individually.
 */
export const plaidIdvAdapter = createAdapter<PlaidIdvMetadata>({
	getMetadata,
	factNames: FACT_NAMES,
	process
});
