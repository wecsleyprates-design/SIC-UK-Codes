import { EVENTS } from "#constants";
import { kafkaToQueue } from "#messaging";
import { taskQueue } from "#workers/taskHandler";
import { logger } from "#helpers/logger";
import type { StateUpdateHandler } from "../types";

const TRIGGER_FIELDS = ["data_businesses.official_website"];

const extractWebsite = (currentState: Record<string, any>): string | undefined => {
	const rawWebsite = currentState?.data_businesses?.official_website ?? currentState?.data_businesses?.public_website;
	// regex proper url
	const url = rawWebsite?.match(/https?:\/\/[^\s]+/);
	if (url) {
		return url[0];
	}
	return undefined;
};

export const websiteScanBusinessStateUpdateHandler: StateUpdateHandler = {
	trigger: "asynchronous",
	id: "worth-website-scan-on-update",
	description: "Trigger Worth website scan when website changes",
	platformCode: "WORTH_WEBSITE_SCANNING",
	taskCode: "fetch_business_entity_website_details",
	fields: TRIGGER_FIELDS,
	run: async context => {
		const website = extractWebsite(context.currentState ?? {});

		logger.info({ context, website }, "[onUpdate][websiteScan] Enqueuing Worth website scan");

		if (website) {
			await kafkaToQueue(taskQueue, EVENTS.FETCH_WORTH_BUSINESS_WEBSITE_DETAILS, {
				business_id: context.businessId,
				website
			});
		}
	}
};
