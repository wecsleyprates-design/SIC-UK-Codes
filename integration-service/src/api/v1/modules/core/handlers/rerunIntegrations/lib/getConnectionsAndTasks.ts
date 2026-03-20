import { db } from "#helpers/knex";
import { INTEGRATION_ID, INTEGRATION_CATEGORIES } from "#constants";

export interface ConnectionWithTasks {
	connection_id: string;
	platform_id: (typeof INTEGRATION_ID)[keyof typeof INTEGRATION_ID];
	platform_code: string;
	task_codes: string[];
}

/**
 * Gets connections and their associated task codes based on filters
 */
export const getConnectionsAndTasks = async (
	businessID: string,
	platform_codes: string[] = [],
	category_codes: string[] = [],
	task_codes: string[] = []
): Promise<ConnectionWithTasks[]> => {
	// Build query to get connections and their task codes
	let query = db("data_connections")
		.distinct(
			"data_connections.id as connection_id",
			"data_connections.platform_id",
			"core_integrations_platforms.code as platform_code",
			"core_tasks.code as task_code"
		)
		.from("data_connections")
		.innerJoin("core_integrations_platforms", "core_integrations_platforms.id", "data_connections.platform_id")
		.leftJoin("rel_tasks_integrations", "rel_tasks_integrations.platform_id", "data_connections.platform_id")
		.leftJoin("core_tasks", "core_tasks.id", "rel_tasks_integrations.task_category_id")
		.where("data_connections.business_id", businessID)
		/**
		 * Omit the fetch_business_entity_website_details task for Middesk, since there's actually no task handler for that task.
		 *
		 * Instead, the logic which would normally be associated with the task handler is handled in the `handleBusinessEntityReviewUpdate`
		 * method in the BusinessEntityVerificationService, which is triggered when we receive webhook events from Middesk after an order is completed.
		 *
		 * Summarily, the logic which would normally be associated with the task handler *will* still be executed if we rerun the *other* Middesk tasks,
		 * since we will still receive a webhook event from Middesk after the order is completed.
		 */
		.whereRaw("NOT (data_connections.platform_id = ? AND core_tasks.code = ?)", [
			INTEGRATION_ID.MIDDESK,
			"fetch_business_entity_website_details"
		]);

	// Filter by platform codes
	if (platform_codes && platform_codes.length > 0) {
		const platformIds = platform_codes
			.map(code => INTEGRATION_ID[code.toUpperCase() as keyof typeof INTEGRATION_ID])
			.filter(Boolean);
		if (platformIds.length > 0) query = query.whereIn("data_connections.platform_id", platformIds);
	}

	// Filter by category codes
	if (category_codes && category_codes.length > 0) {
		const categoryIds = category_codes
			.map(code => INTEGRATION_CATEGORIES[code.toUpperCase() as keyof typeof INTEGRATION_CATEGORIES])
			.filter(Boolean);
		if (categoryIds.length > 0) query = query.whereIn("core_integrations_platforms.category_id", categoryIds);
	}

	// Filter by task codes
	if (task_codes && task_codes.length > 0) {
		query = query.whereIn(
			"core_tasks.code",
			task_codes.map(code => code.toLowerCase())
		);
	}

	query = query.orderBy("data_connections.platform_id").orderBy("core_tasks.code");

	const result = await query;

	// Group by connection and collect task codes
	const connectionMap = new Map<string, ConnectionWithTasks>();
	for (const row of result) {
		const { connection_id, platform_id, platform_code, task_code } = row;
		if (!connectionMap.has(connection_id))
			connectionMap.set(connection_id, { connection_id, platform_id, platform_code, task_codes: [] });
		if (task_code) connectionMap.get(connection_id)!.task_codes.push(task_code);
	}

	return Array.from(connectionMap.values());
};
