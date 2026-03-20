import { logger } from "#helpers/logger";
import { rerunIntegration } from "../helpers";
import type { StateUpdateHandler } from "../types";

const TRIGGER_FIELDS = [
	"data_businesses.tin",
	"data_business_names.__self",
	"data_business_addresses.__self",
	"data_business_owners.__self"
];

export const middeskBusinessStateUpdateHandler: StateUpdateHandler = {
	trigger: "synchronous",
	id: "middesk-rerun-on-update",
	description: "Re-run Middesk business verification when core business fields change",
	platformCode: "MIDDESK",
	taskCode: "fetch_business_entity_verification",
	fields: TRIGGER_FIELDS,
	run: async context => {
		logger.info({ context }, "[businessStateUpdate][middesk] Triggering rerunIntegrations for Middesk");

		const result = await rerunIntegration(context.businessId, middeskBusinessStateUpdateHandler);
		logger.debug({ result, context }, "Ran Middesk");
	}
};
