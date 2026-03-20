import { logger } from "#helpers/logger";
import { rerunIntegration } from "../helpers";
import type { StateUpdateHandler } from "../types";

const TRIGGER_FIELDS = [
	"data_businesses.tin",
	"data_business_names.__self",
	"data_business_addresses.__self",
	"data_business_owners.__self"
];

export const baselayerBusinessStateUpdateHandler: StateUpdateHandler = {
	trigger: "synchronous",
	id: "baselayer-rerun-on-update",
	description: "Re-run Baselayer business verification when core business fields change",
	platformCode: "BASELAYER",
	taskCode: "fetch_business_entity_verification",
	fields: TRIGGER_FIELDS,
	run: async context => {
		logger.info({ context }, "[businessStateUpdate][baselayer] Triggering rerunIntegrations for Baselayer");

		const result = await rerunIntegration(context.businessId, baselayerBusinessStateUpdateHandler);
		logger.debug({ result, context }, "Ran Baselayer");
	}
};
