import { db } from "#helpers/knex";

/* Map to handle display names for columns being translated to actual column names in the database for a particular db interface/type*/
export const columnToActualMap = {
	IBusinessIntegrationTaskEnriched: {
		business_id: "data_connections.business_id",
		task_code: "core_tasks.code",
		platform_id: db.raw("core_integrations_platforms.id::text"),
		platform_code: "core_integrations_platforms.code",
		platform_category_code: "core_categories.code",
		trigger_type: "business_score_triggers.trigger_type",
		trigger_version: db.raw("business_score_triggers.version::text"),
		task_label: "core_tasks.label",
		id: db.raw("data_business_integrations_tasks.id::text"),
		case_id: "data_cases.id",
		task_status: "data_business_integrations_tasks.task_status",
		reference_id: "data_business_integrations_tasks.reference_id"
	},
	IRequestResponse: {
		id: db.raw("request_id::text")
	},
	business_info: {
		id: db.raw("id::text")
	}
} as const;
