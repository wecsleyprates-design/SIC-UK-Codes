import {
	CONNECTION_STATUS,
	INTEGRATION_ID,
	INTEGRATION_ENABLE_STATUS,
	INTEGRATION_SETTING_KEYS,
	SCORE_TRIGGER
} from "#constants/index";
import { logger, db, getCustomerBusinessConfigs } from "#helpers/index";
import { strategyPlatformFactory } from "#helpers/strategyPlatformFactory";
import { Equifax } from "#lib/equifax";
import type { Owner } from "#types/worthApi";
import type { UUID } from "crypto";

type CreditReportPayload = Owner & { business_id: UUID; customer_id?: UUID | null };

export class CreditBureauManager {
	async fetchBureauCreditReport(body: CreditReportPayload): Promise<void> {
		// no need to run credit report for easy flow owners
		if (body.last_name && body.last_name.endsWith("__easyflow")) {
			return;
		}
		const { business_id: businessID, id: ownerID, customer_id: customerID } = body;
		let equifax: Equifax | null = null;
		const actions = {};
		let equifaxSetting = false;
		if (customerID) {
			const customerSettings = await db("public.data_customer_integration_settings")
				.select("settings")
				.where("customer_id", customerID)
				.first();
			if (!customerSettings || !customerSettings.settings) {
				logger.info(`Customer settings not found for customer ID: ${customerID}`);
			} else {
				const setting = customerSettings.settings[INTEGRATION_SETTING_KEYS.EQUIFAX];
				if (setting.status === INTEGRATION_ENABLE_STATUS.ACTIVE) {
					equifaxSetting = true;
				}
			}
		}
		const customerBusinessConfigs =
			customerID && businessID ? await getCustomerBusinessConfigs(customerID, businessID) : null;
		const businessEquifaxSetting = customerBusinessConfigs?.[0]?.config.skip_credit_check;

		equifax = await strategyPlatformFactory({ businessID, platformID: INTEGRATION_ID.EQUIFAX, customerID: customerID as UUID });
		try {
			if (equifax) {
				// Check if skip credit check is enabled for a business or not
				if (customerID) {
					const connection = equifax.getDBConnection();
					if (connection && connection.configuration?.skip_credit_check) {
						logger.info(`OWNER UPDATED: Skip Credit Check enabled for business ${businessID}`);
						return;
					}
				}

				await equifax.updateConnectionStatus(
					CONNECTION_STATUS.SUCCESS,
					JSON.stringify({ task: "fetch_bureau_score_owners" })
				);

				// we are sure that the task exists because we create when kafkaEvents.BUSINESS_INVITE_ACCEPTED is consumed
				// we need score_trigger_id to create new task for new owner
				const equifaxTask = await equifax.getLatestTask(
					businessID,
					INTEGRATION_ID.EQUIFAX,
					"fetch_bureau_score_owners",
					false,
					"business_score_triggers.customer_id as customer_id"
				);

				if (!equifaxTask) {
					throw new Error("No existing task found for fetching bureau score for the business");
				}

				if (!equifaxTask.business_score_trigger_id) {
					throw new Error("No business_score_trigger_id found for the task");
				}

				let query = db("integrations.business_score_triggers")
					.select("business_score_triggers.id", "business_score_triggers.customer_id")
					.where("business_score_triggers.business_id", businessID)
					.andWhere("business_score_triggers.trigger_type", SCORE_TRIGGER.ONBOARDING_INVITE)
					.orderBy("business_score_triggers.created_at", "asc");
				const businessScoreTriggers = await query;

				for (const trigger of businessScoreTriggers) {
					if (trigger.customer_id) {
						if (customerID && trigger.customer_id === customerID && equifaxSetting && !businessEquifaxSetting) {
							const taskId = await equifax.getOrCreateFetchBureauScoreOwnersTask(body, trigger.id);
							if (taskId) {
								await equifax.processTask({ taskId });
							}
						}
					}
					await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
				}
			}
		} catch (ex) {
			logger.error(
				`Error in enrolling ${ownerID} in Equifax for business ${businessID}. Error: ${(ex as Error).message}`
			);
			actions["equifax"] = { error: (ex as Error).message };
		}
		logger.info(
			`Owner updated: Credit report fetched for business ${businessID} & owner ${ownerID}. Actions: ${JSON.stringify(actions)}`
		);
	}
}
