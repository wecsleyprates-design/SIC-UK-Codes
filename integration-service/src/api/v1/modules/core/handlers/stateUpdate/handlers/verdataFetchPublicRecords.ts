import { logger } from "#helpers/logger";
import type { StateUpdateHandler } from "../types";
import { rerunIntegration } from "../helpers";

const TRIGGER_FIELDS = ["data_business_names.__self", "data_business_addresses.__self", "data_business_owners.__self"];

export const verdataFetchPublicRecordsStateUpdateHandler: StateUpdateHandler = {
	trigger: "asynchronous",
	id: "verdata-rerun-on-update",
	description: "Re-run Verdata when core business fields change",
	platformCode: "VERDATA",
	taskCode: "fetch_public_records",
	fields: TRIGGER_FIELDS,
	run: async context => {
		logger.info({ context }, "[businessStateUpdate][verdata] Triggering verdata resubmission");

		const result = await rerunIntegration(context.businessId, verdataFetchPublicRecordsStateUpdateHandler);
		logger.debug({ result, context }, "Successfully processed Verdata fetch public records task");
	}
};
