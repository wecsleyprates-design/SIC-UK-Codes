import type { UUID } from "crypto";
import { createAdapter } from "../shared/createAdapter";
import type { IntegrationProcessFunction } from "../types";
import { processWithExistingBusinessScoreTrigger } from "../shared/processWithExistingScoreTrigger";

const process: IntegrationProcessFunction = async params => {
	return processWithExistingBusinessScoreTrigger(
		params.business_id as UUID,
		"ENTITY_MATCHING",
		"fetch_business_entity_verification"
	);
};

export const entityMatchingAdapter = createAdapter({
	getMetadata: async () => ({}),
	isValidMetadata: () => true,
	factNames: [],
	process
});
