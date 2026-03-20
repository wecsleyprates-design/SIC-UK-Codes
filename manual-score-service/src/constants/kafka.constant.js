import { envConfig } from "#configs/index";

export const kafkaTopics = {
	CASES: envConfig.CASES || "cases.v1",
	BUSINESS: envConfig.BUSINESS || "business.v1",
	SCORES: envConfig.SCORES || "scores.v1",
	AI_SCORES: envConfig.AI_SCORES || "scores.ai.v1",
	USERS: envConfig.USERS_NEW || "users.v1",
	WEBHOOKS: envConfig.WEBHOOKS || "webhooks.v1",
	REPORTS: envConfig.REPORTS || "reports.v1",
	PLAYGROUND_AI_SCORES: envConfig.PLAYGROUND_AI_SCORES || "scores.ai.playground.v1"
};

export const dlqTopic = envConfig.DLQTOPIC || "scores.dlq.v1";

export const kafkaEvents = {
	// user events
	CREATE_APPLICANT: "create_applicant_event",
	APPLICANT_ONBOARDED: "applicant_onboarded_event",

	// business events
	BUSINESS_INVITED: "business_invited_event",

	// case events
	CREATE_CASE: "create_case_event",

	// business events
	BUSINESS_INVITE_ACCEPTED: "business_invite_accepted_event",

	// fetch task events
	FETCH_PUBLIC_RECORDS_REQUEST: "fetch_public_records_request_event",

	// integration data ready event
	INTEGRATION_DATA_READY: "integration_data_ready_event",

	// collect integration data for score
	INTEGRATION_DATA_FOR_SCORE: "integration_data_for_score_event",

	// score calculated event
	SCORE_CALCULATED: "score_calculated_event",

	CUSTOMER_CREATED: "customer_created_event",

	// score calculated event
	GENERATE_AI_SCORE: "generate_ai_score_event",

	// score calculated event
	AI_SCORE_GENERATED: "ai_score_generated_event",

	REFRESH_BUSINESS_SCORE: "refresh_business_score_event",

	// Link cases provided in the payload to score trigger of standalone_case and emit score_calculated event for every case
	LINK_TRIGGERS_AND_EMIT_SCORE: "link_triggers_and_emit_score_event",

	// event to purge business
	PURGE_BUSINESS: "purge_business_event",

	// send webhook event
	SEND_WEBHOOK: "send_webhook_event",

	// Get 360 report data
	FETCH_REPORT_DATA: "fetch_report_data_event",

	// Update 360 report data status
	UPDATE_REPORT_DATA: "update_report_data_event",

	CASE_STATUS_UPDATED: "case_status_updated_event"
};
