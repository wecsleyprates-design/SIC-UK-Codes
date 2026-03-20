import { getCustomerWithPermissions, getFlagValue, logger, producer, sqlQuery } from "../../helpers/index";
import { DateTime } from "luxon";
import { kafkaTopics, kafkaEvents, SCORE_TRIGGER, FEATURE_FLAGS } from "../../constants/index";

export const refreshSubscriptionScores = async () => {
	logger.info("=============== Executing Cron Job to Refresh Integration Data ===============");
	// Fetch the latest data / score refresh config
	const refreshConfig = await sqlQuery({
		sql: "SELECT refresh_type, config->>'refresh_value' AS refresh_cycle_in_days FROM public.core_score_refresh_config where config->>'refresh_value' is not null"
	});
	let subscriptionRefreshCycle, monitoringRefreshCycle;

	refreshConfig.rows.forEach(row => {
		if (row.refresh_type === "MONITORING_REFRESH") {
			monitoringRefreshCycle = row.refresh_cycle_in_days;
		} else if (row.refresh_type === "SUBSCRIPTION_REFRESH") {
			subscriptionRefreshCycle = row.refresh_cycle_in_days;
		} else {
			subscriptionRefreshCycle = 30;
			monitoringRefreshCycle = 7;
		}
	});

	// Fetch all the businesses with active subscriptions
	let { rows: activeBusinessSubscriptions } = await sqlQuery({
		sql: `SELECT subscriptions.data_businesses_subscriptions.business_id FROM subscriptions.data_businesses_subscriptions
			LEFT JOIN data_businesses db ON db.id = subscriptions.data_businesses_subscriptions.business_id
			WHERE subscriptions.data_businesses_subscriptions.status = 'SUBSCRIBED' AND db.is_deleted = false`,
		values: []
	});
	activeBusinessSubscriptions = activeBusinessSubscriptions.map(sub => sub.business_id);

	// Fetch all the businesses that are being monitored
	const activeMonitoringQuery = `SELECT rel_business_customer_monitoring.business_id, rel_business_customer_monitoring.customer_id
	FROM rel_business_customer_monitoring 
	LEFT JOIN data_businesses db on rel_business_customer_monitoring.business_id = db.id 
	WHERE rel_business_customer_monitoring.is_monitoring_enabled = true AND db.is_deleted = false`;
	let activeMonitoring = await sqlQuery({ sql: activeMonitoringQuery, values: [] });
	const activeMonitoringBusinesses = [];
	activeMonitoring = activeMonitoring.rows.reduce((result, row) => {
		const { business_id: businessID, customer_id: customerID } = row;
		if (!result[businessID]) {
			result[businessID] = { customers: [] };
			activeMonitoringBusinesses.push(businessID);
		}
		result[businessID].customers.push(customerID);
		return result;
	}, {});

	let businesses = new Set(activeBusinessSubscriptions.concat(activeMonitoringBusinesses));

	// check FF status
	const flagStatus = await getFlagValue(FEATURE_FLAGS.PAT_566_SCORE_REFRESH_FOR_LATEST_30_DAYS_BUSINESSES);

	// if flag is enabled, fetch only those businesses that have onboarded in the last 30 days
	if (flagStatus) {
		logger.info(`refreshSubscriptionScores: Business count pre-30 days filter: ${businesses.size}`);
		const thirtyDaysAgo = DateTime.now().minus({ days: 30 });
		const recentOnboardedBusinesses = await sqlQuery({
			sql: `SELECT id FROM data_businesses WHERE created_at >= $1 AND is_deleted = false`,
			values: [thirtyDaysAgo.toISO()]
		});

		const recentBusinessIds = new Set(recentOnboardedBusinesses.rows.map(row => row.id));

		businesses = new Set([...businesses].filter(business => recentBusinessIds.has(business)));
		logger.info(`refreshSubscriptionScores: Business count post-30 days filter: ${businesses.size}`);
	}

	if (businesses?.size > 0) {
		// Fetch all the customers who have the permission to monitor the business
		const result = await getCustomerWithPermissions({ permissions: ["risk_monitoring_module:write"] });
		const monitoringAllowedCustomers = Object.hasOwn(result, "risk_monitoring_module:write")
			? result["risk_monitoring_module:write"]
			: [];

		// Fetch the latest scores for the businesses but only for the trigger types MONITORING_REFRESH, SUBSCRIPTION_REFRESH or ONBOARDING_INVITE
		// We can ignore the scores for APPLICATION_EDIT and MANUAL_REFRESH as they are not used for refreshing the integrations
		const latestScoresQuery = `SELECT DISTINCT ON (business_id, trigger_type, customer_id) business_id, score_trigger_id, trigger_type, customer_id, data_business_scores.created_at
		FROM data_business_scores 
		LEFT JOIN data_businesses db ON db.id = data_business_scores.business_id
		WHERE business_id IN (${[...businesses].map(business => `'${business}'`).join(",")}) 
		AND trigger_type NOT IN (${`'${SCORE_TRIGGER.APPLICATION_EDIT}', '${SCORE_TRIGGER.MANUAL_REFRESH}'`}) 
		AND db.is_deleted = false
		ORDER BY business_id, trigger_type, customer_id, data_business_scores.created_at DESC`;

		const latestScores = await sqlQuery({ sql: latestScoresQuery });

		const today = new Date();

		const businessesToBeRefreshed = new Set();
		const addedBusinesses = new Map();
		latestScores.rows.forEach(row => {
			// only refresh the integrations for the customers who have the permission to monitor the business
			// or if the customer_id is null

			let shouldAddBusiness = false;
			if (!row.customer_id || monitoringAllowedCustomers.includes(row.customer_id)) {
				const business = {
					business_id: row.business_id,
					customer_id: row.customer_id ? row.customer_id : null,
					trigger_type: null
				};
				// if the last updated score for MONITORING_REFRESH trigger type is more than or equal to the monitoringRefreshCycle then refresh the integrations + score
				if (
					row.trigger_type === "MONITORING_REFRESH" &&
					DateTime.fromJSDate(today).diff(DateTime.fromJSDate(row.created_at), "days").days >= monitoringRefreshCycle
				) {
					if (
						activeMonitoringBusinesses.includes(row.business_id) &&
						activeMonitoring[row.business_id].customers.includes(row.customer_id)
					) {
						business.trigger_type = "MONITORING_REFRESH";
						shouldAddBusiness = true;
					}
				} else if (
					row.trigger_type === "SUBSCRIPTION_REFRESH" &&
					DateTime.fromJSDate(today).diff(DateTime.fromJSDate(row.created_at), "days").days >= subscriptionRefreshCycle
				) {
					// if the last updated score for SUBSCRIPTION_REFRESH trigger type is more than or equal to the subscriptionRefreshCycle then refresh the integrations + score
					if (activeBusinessSubscriptions.includes(row.business_id)) {
						business.trigger_type = "SUBSCRIPTION_REFRESH";
						shouldAddBusiness = true;
					}
				} else if (row.trigger_type === "ONBOARDING_INVITE") {
					// Check if the same business_id already has MONITORING_REFRESH or SUBSCRIPTION_REFRESH in latestScores
					const hasMonitoringOrSubscriptionRefresh = latestScores.rows.some(
						score =>
							score.business_id === row.business_id &&
							(score.trigger_type === "MONITORING_REFRESH" || score.trigger_type === "SUBSCRIPTION_REFRESH")
					);

					// If MONITORING_REFRESH or SUBSCRIPTION_REFRESH exists, skip further steps
					if (hasMonitoringOrSubscriptionRefresh) {
						return; // Skip this row and move to the next iteration
					}

					// if the last updated score was during ONBOARDING_INVITE and there were no triggers / score calculated for SUBSCRIPTION_REFRESH or MONITORING_REFRESH previously, then check explicitly
					if (
						activeMonitoringBusinesses.includes(row.business_id) &&
						DateTime.fromJSDate(today).diff(DateTime.fromJSDate(row.created_at), "days").days >=
							monitoringRefreshCycle &&
						activeMonitoring[row.business_id].customers.includes(row.customer_id)
					) {
						business.trigger_type = "MONITORING_REFRESH";
						shouldAddBusiness = true;
					}
					if (
						activeBusinessSubscriptions.includes(row.business_id) &&
						DateTime.fromJSDate(today).diff(DateTime.fromJSDate(row.created_at), "days").days >=
							subscriptionRefreshCycle
					) {
						business.trigger_type = "SUBSCRIPTION_REFRESH";
						shouldAddBusiness = true;
					}
				}

				if (shouldAddBusiness) {
					const existingTriggerType = addedBusinesses.get(row.business_id);

					// If the business_id is already present with MONITORING_REFRESH or SUBSCRIPTION_REFRESH, don't add it again
					if (
						!existingTriggerType ||
						existingTriggerType !== "MONITORING_REFRESH" ||
						existingTriggerType !== "SUBSCRIPTION_REFRESH"
					) {
						businessesToBeRefreshed.add(JSON.stringify(business));
						addedBusinesses.set(row.business_id, business.trigger_type); // Track the added business and its trigger_type
					}
				}
			}
		});

		const businessesToBeRefreshedArray = Array.from(businessesToBeRefreshed).map(business => JSON.parse(business));
		logger.info(
			`refreshSubscriptionScores: Business count for refreshing scores: ${businessesToBeRefreshedArray.length}`
		);

		// if there are no businesses that needs to be refreshed, then stop the job
		if (!businessesToBeRefreshedArray.length) {
			logger.info(
				"=============== Cron Job to Refresh Integration Data has been exited as there are no jobs to run. ==============="
			);
			return;
		}

		logger.info({ businessesToBeRefreshedArray }, "refreshSubscriptionScores");

		await Promise.all(
			businessesToBeRefreshedArray.map(async business => {
				const payload = {
					topic: kafkaTopics.SCORES,
					messages: [
						{
							key: business.business_id,
							value: {
								event: kafkaEvents.REFRESH_BUSINESS_SCORE,
								...business
							}
						}
					]
				};

				await producer.send(payload);
			})
		);
	}
	logger.info("=============== Cron Job to Refresh Integration Data has been executed. ===============");
};
