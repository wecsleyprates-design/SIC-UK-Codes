import { logger } from "#helpers/logger";
import { rerunIntegration } from "../helpers";
import type { StateUpdateHandler } from "../types";

const TRIGGER_FIELDS = ["data_business_names.__self", "data_business_addresses.__self", "data_business_owners.__self"];

export const serpRerunStateUpdateHandler: StateUpdateHandler = {
	trigger: "asynchronous",
	id: "serp-rerun-on-update",
	description: "Re-run Serp when core business fields change",
	platformCode: "SERP_SCRAPE",
	taskCode: "fetch_business_entity_website_details",
	fields: TRIGGER_FIELDS,
	run: async context => {
		logger.info({ context }, "[businessStateUpdate][serpScrape] Triggering rerunIntegrations for serp scrape");

		const result = await rerunIntegration(context.businessId, serpRerunStateUpdateHandler);
		logger.debug({ out: result, context }, "Successfully processed Serp rerun");
	}
};
