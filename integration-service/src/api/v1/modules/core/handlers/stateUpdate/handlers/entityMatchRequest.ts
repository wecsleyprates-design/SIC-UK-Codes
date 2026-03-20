import { logger } from "#helpers/logger";
import { rerunIntegration } from "../helpers";
import type { StateUpdateHandler } from "../types";

const TRIGGER_FIELDS = [
	"data_businesses.tin",
	"data_business_names.__self",
	"data_business_addresses.__self",
	"data_business_owners.__self"
];

export const entityMatchStateUpdateHandler: StateUpdateHandler = {
	trigger: "asynchronous",
	id: "entity-match-rerun-on-update",
	description: "Re-run entity matching when core business fields change",
	platformCode: "ENTITY_MATCHING",
	taskCode: "fetch_business_entity_verification",
	fields: TRIGGER_FIELDS,
	run: async context => {
		logger.info({ context }, "[businessStateUpdate][entityMatch] Triggering rerunIntegrations for entity matching");

		const result = await rerunIntegration(context.businessId, entityMatchStateUpdateHandler);
		logger.debug({ result, context }, "Successfully processed EntityMatchRequest");
	}
};
