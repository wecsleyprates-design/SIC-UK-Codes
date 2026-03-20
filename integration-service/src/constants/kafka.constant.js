import { envConfig } from "#configs/index";

export const kafkaTopics = {
	USERS_NEW: envConfig.USERS_NEW || "users.v1",
	CASES: envConfig.CASES || "cases.v1",
	BUSINESS: envConfig.BUSINESS || "business.v1",
	SCORES: envConfig.SCORES || "scores.v1",
	NOTIFICATIONS: envConfig.NOTIFICATIONS || "notifications.v1",
	INTEGRATIONS: envConfig.INTEGRATIONS || "integrations.v1",
	WEBHOOKS: envConfig.WEBHOOKS || "webhooks.v1",
	REPORTS: envConfig.REPORTS || "reports.v1",
	ELECTRONIC_CONSENT: envConfig.ELECTRONIC_CONSENT || "electronic.consent.v1",
	FACTS: envConfig.FACTS_TOPIC || "facts.v1",
	WAREHOUSE: envConfig.WAREHOUSE_TOPIC || "entity_matching.v1"
};

export const kafkaProducerTopics = {
	ENTITY_MATCHING_REQUEST: envConfig.ENTITY_MATCHING_REQUEST_TOPIC || "entity_matching_request.v1"
};

export const DLQTOPIC = envConfig.DLQTOPIC || "integrations.dlq.v1";

export const kafkaEvents = {
	// user events
	CREATE_APPLICANT: "create_applicant_event",
	APPLICANT_ONBOARDED: "applicant_onboarded_event",

	// business events
	BUSINESS_INVITED: "business_invited_event",
	OWNER_UPDATED: "owner_updated_event",

	// case events
	CREATE_CASE: "create_case_event",

	// business events
	BUSINESS_INVITE_ACCEPTED: "business_invite_accepted_event",

	// fetch task events
	FETCH_PUBLIC_RECORDS_REQUEST: "fetch_public_records_request_event",

	// integration data ready event
	INTEGRATION_DATA_READY: "integration_data_ready_event",

	// integration data ready event for score-service to generate score
	INTEGRATION_DATA_FOR_SCORE: "integration_data_for_score_event",
	// Triggered when integration data is manually uploaded
	INTEGRATION_DATA_UPLOADED: "integration_data_uploaded_event",
	// Fact override created audit event (triggered when a fact override is created i.e. integration data is manually uploaded)
	// This event will be used when the fact had no previous data.
	FACT_OVERRIDE_CREATED_AUDIT: "fact_override_created_audit_event",
	// Fact override updated audit event (triggered when a fact override is updated i.e. integration data is manually uploaded)
	FACT_OVERRIDE_UPDATED_AUDIT: "fact_override_updated_audit_event",

	// Custom field updated audit event (triggered when custom fields are updated via case management inline editing)
	CUSTOM_FIELD_UPDATED_AUDIT: "custom_field_updated_audit_event",

	// score calculated event
	SCORE_CALCULATED: "score_calculated_event",

	REFRESH_BUSINESS_SCORE: "refresh_business_score_event",

	RESCORE_CASE_EVENT: "rescore_case_event",

	BUSINESS_CONNECTION_FAILED: "business_connection_failed_event",
	// update Naics code update for business
	UPDATE_NAICS_CODE: "update_naics_code_event",

	// update Case status
	UPDATE_CASE_STATUS_ONSUBMIT: "update_case_status_onsubmit",

	// update Case status
	UPDATE_CASE_STATUS_ON_RESPONSE: "update_case_status_on_response",

	// integration data fetch failed for score refresh
	INTEGRATION_DATA_FETCH_FAILED: "integration_data_fetch_failed_event",

	// Data pull from any integration is failed
	INTEGRATION_TASK_FAILED: "integration_task_failed_event",

	// Data pull for all integrations based on case ID
	CASE_SUBMITTED_EXECUTE_TASKS: "case_submitted_execute_tasks_event",

	// Check and Start score calculation once case has been submitted
	CASE_SUBMITTED: "case_submitted_event",

	// Link cases provided in the payload to score trigger of standalone_case
	LINK_SCORE_TRIGGERS: "link_score_triggers_event",

	// Link cases provided in the payload to score trigger of standalone_case and emit score_calculated event for every case
	LINK_TRIGGERS_AND_EMIT_SCORE: "link_triggers_and_emit_score_event",

	// event to fetch tax status data for cases other than in webhook
	TAX_STATUS_DATA_FETCHING: "tax_status_data_fetching_event",

	// event to create risk alert
	CREATE_RISK_ALERT: "create_risk_alert_event",

	// event to create risk alert case
	CREATE_RISK_ALERT_CASE: "create_risk_alert_case_event",

	// event to fetch business website details from middesk
	FETCH_BUSINESS_WEBSITE_DETAILS: "fetch_business_website_details_event",

	// event to fetch business website details using Worth service
	FETCH_WORTH_BUSINESS_WEBSITE_DETAILS: "fetch_worth_business_website_details_event",

	INTEGRATION_CONNECTED_AUDIT: "integration_connected_audit_event",
	INTEGRATION_DATA_FETCH_FAILED_AUDIT: "integration_data_fetch_failed_audit_event",

	// event to fill in official website as fallback
	ADD_WEBSITE_FALLBACK: "add_business_website_fallback_event",
	WHITE_LABEL_REGISTERED_NEW_DOMAIN: "white_label_registered_new_domain",
	S3_FILE: "s3_file_event",

	// BullQueue jobs that complete
	JOB_COMPLETE: "job_complete_event",
	ALL_JOBS_IN_REQUEST_COMPLETE: "job_request_complete_event",

	// event to purge business
	PURGE_BUSINESS: "purge_business_event",

	// event to create case or add an entry for a case
	CREATE_CASE_REQUEST: "create_case_request_event",
	CREATE_CASE_FOR_A_RISK_ALERT_REQUEST: "create_a_case_for_a_risk_alert_event",

	SEND_WEBHOOK: "send_webhook_event",

	// Process completion events
	PROCESS_COMPLETION_FACTS: "process_completion_facts_event",
	INTEGRATION_CATEGORY_COMPLETE: "integration_category_complete_event",

	// Get 360 report data
	FETCH_REPORT_DATA: "fetch_report_data_event",

	// Update 360 report data status
	UPDATE_REPORT_DATA: "update_report_data_event",

	SECTION_COMPLETED: "section_completed_event",

	// Add customer's risk alert config
	ADD_RISK_ALERT_CONFIG: "add_risk_alert_config_event",

	// integration updated event
	INTEGRATION_UPDATED: "integration_updated_event",

	// Add customer's risk alert config
	ADD_CUSTOMER_INTEGRATION_SETTINGS: "add_customer_integration_settings_event",

	// update customer integration settings
	UPDATE_CUSTOMER_INTEGRATION_SETTINGS: "update_customer_integration_settings_event",

	// fetch adverse media event
	FETCH_ADVERSE_MEDIA_REPORT: "fetch_adverse_media_report_event",

	// fetch google profile event
	FETCH_GOOGLE_PROFILE: "fetch_google_profile_event",

	// Bank account verification failed
	BANK_ACCOUNT_VERIFICATION_FAILED: "bank_account_verification_failed_event",

	// entity matching event
	ENTITY_MATCHING: "entity_matching_event",
	FIRMOGRAPHICS_EVENT: "firmographics_event",
	DELETE_INTEGRATION_DATA: "delete_integration_data_event",

	// document uploaded audit event
	DOCUMENT_UPLOADED_AUDIT: "document_uploaded_audit_event",
	CALCULATE_BUSINESS_FACTS: "calculate_business_facts_event",

	// Application is updated
	CASE_UPDATED_AUDIT: "case_updated_audit_event",

	// Business invitation is sent
	INVITATION_SENT: "invitation_sent_event",

	// Transaction export audit event
	TRANSACTION_EXPORTED_AUDIT: "transaction_exported_audit_event",

	// Identity document downloaded audit event
	IDENTITY_DOCUMENT_DOWNLOADED_AUDIT: "identity_document_downloaded_audit_event",

	PAYMENT_PROCESSOR_ACCOUNT_UPDATED: "payment_processor_account_updated_event",

	APPLICATION_EDIT_FACTS_READY: "application_edit_facts_ready_event",

	BUSINESS_STATE_UPDATE_EVENT: "business_state_update_event",

	ENTITY_MATCHING_REQUEST: "entity_matching_request_event"
};
