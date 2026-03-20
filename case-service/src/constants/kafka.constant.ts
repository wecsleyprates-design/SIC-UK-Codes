import { envConfig } from "#configs";

export const kafkaTopics = {
	USERS: envConfig.USERS || "worth.users.v1",
	USERS_NEW: envConfig.USERS_NEW || "users.v1",
	BUSINESS: envConfig.BUSINESS || "business.v1",
	CASES: envConfig.CASES || "cases.v1",
	SCORES: envConfig.SCORES || "scores.v1",
	NOTIFICATIONS: envConfig.NOTIFICATIONS || "notifications.v1",
	WEBHOOKS: envConfig.WEBHOOKS || "webhooks.v1",
	REPORTS: envConfig.REPORTS || "reports.v1"
};

export const DLQTOPIC = envConfig.DLQTOPIC || "cases.dlq.v1";

export const kafkaEvents = {
	// user events
	CREATE_APPLICANT: "create_applicant_event",
	APPLICANT_ONBOARDED: "applicant_onboarded_event",
	OWNER_UPDATED: "owner_updated_event",

	// business events
	BUSINESS_INVITED: "business_invited_event",
	BUSINESS_INVITE_ACCEPTED: "business_invite_accepted_event",
	// job events

	// case events
	CREATE_CASE_REQUEST: "create_case_request_event",
	CREATE_CASE_FOR_A_RISK_ALERT_REQUEST: "create_a_case_for_a_risk_alert_event",

	// send email
	SEND_STRIPE_SUBSCRIPTION_EMAIL: "send_stripe_subscription_email_event",

	INVITE_APPLICANT: "invite_applicant_event",
	INTEGRATION_DATA_READY: "integration_data_ready_event",

	SCORE_CALCULATED: "score_calculated_event",

	REFRESH_BUSINESS_SCORE: "refresh_business_score_event",

	MONITORING_RUN_CREATED: "monitoring_run_created_event",

	RESCORE_CASE_EVENT: "rescore_case_event",

	UPDATE_BUSINESS: "update_business_event",

	UPDATE_SUBROLE: "update_subrole_event",

	LINK_INVITEES: "link_invitees_event",

	RESEND_INVITATION: "resend_invitation_event",

	// update Naics code update for business
	UPDATE_NAICS_CODE: "update_naics_code_event",

	// update Case status
	UPDATE_CASE_STATUS_ONSUBMIT: "update_case_status_onsubmit",

	// update Case status when recieve response from integration service
	UPDATE_CASE_STATUS_ON_RESPONSE: "update_case_status_on_response",
	INTEGRATION_DATA_UPLOADED: "integration_data_uploaded_event",

	// Data pull from any integration is failed
	INTEGRATION_TASK_FAILED: "integration_task_failed_event",

	// Bank Account verification failed
	BANK_ACCOUNT_VERIFICATION_FAILED: "bank_account_verification_failed_event",

	// Data pull for all integration based on caseID
	CASE_SUBMITTED_EXECUTE_TASKS: "case_submitted_execute_tasks_event",

	// Check and Start score calculation once case has been submitted
	CASE_SUBMITTED: "case_submitted_event",

	// create stripe customer event after validate business
	CREATE_STRIPE_CUSTOMER: "create_stripe_customer_event",

	// generate task & score triggers for customer case created after applicantion edit
	LINK_SCORE_TRIGGERS: "link_score_triggers_event",

	// event to create risk alert
	CREATE_RISK_ALERT: "create_risk_alert_event",

	// event to create risk alert case
	CREATE_RISK_ALERT_CASE: "create_risk_alert_case_event",

	// event to fetch business website details from middesk
	FETCH_BUSINESS_WEBSITE_DETAILS: "fetch_business_website_details_event",

	CASE_ASSIGNMENT_UPDATED: "case_assignment_updated_event",

	// audit trail events
	CASE_CREATED_AUDIT: "case_created_audit_event",
	CASE_SUBMITTED_AUDIT: "case_submitted_audit_event",
	CASE_UPDATED_AUDIT: "case_updated_audit_event",
	CASE_STATUS_UPDATED_BY_CUSTOMER_AUDIT: "case_status_updated_by_audit_event",
	INVITATION_SENT_AUDIT: "invitation_sent_audit_event",
	INVITATION_ACCEPTED_AUDIT: "invitation_accepted_audit_event",
	INVITATION_COMPLETED_AUDIT: "invitation_completed_audit_event",
	APPLICATION_EDIT_AUDIT: "application_edit_audit_event",
	SCORE_GENERATED_AUDIT: "score_generated_audit_event",
	CASE_ASSIGNED_AUDIT: "case_assigned_audit_event",
	CASE_STATUS_UPDATED_BY_APPLICANT: "case_status_updated_by_applicant_event",
	BUSINESS_CLONED_AUDIT: "business_cloned_audit_event",

	// event to fill in official website as fallback
	ADD_WEBSITE_FALLBACK: "add_business_website_fallback_event",

	// event to purge business
	PURGE_BUSINESS: "purge_business_event",

	// event to update risk monitoring status of businesses related to customers
	UPDATE_CUSTOMER_BUSINESS_RISK_MONITORING: "update_customer_business_risk_monitoring_event",

	// send webhook event
	SEND_WEBHOOK: "send_webhook_event",

	// Get 360 report data
	FETCH_REPORT_DATA: "fetch_report_data_event",

	// Update 360 report data status
	UPDATE_REPORT_DATA: "update_report_data_event",

	SECTION_COMPLETED: "section_completed_event",

	CO_APPLICANT_REQUEST_INVITE_LINK: "co_applicant_request_invite_link_event",

	APPLICATION_READY_TO_SUBMIT: "application_ready_to_submit_event",

	ADDITIONAL_INFORMATION_REQUEST_NOTIFICATION: "additional_information_request_notification_event",
	INFORMATION_REQUESTED_AUDIT: "information_requested_audit_event",
	INFORMATION_UPDATED: "information_updated_event",

	// fetch adverse media event
	FETCH_ADVERSE_MEDIA_REPORT: "fetch_adverse_media_report_event",

	// fetch google profile event
	FETCH_GOOGLE_PROFILE: "fetch_google_profile_event",

	// Update customer's onboarding settings
	UPDATE_CUSTOMER: "update_customer_event",

	ADD_CUSTOMER_MODULE_PERMISSION_SETTINGS: "add_customer_module_permission_settings_event",
	ONBOARDING_ESIGN_COMPLETED: "onboarding_esign_completed",

	// Update customer integration settings
	UPDATE_CUSTOMER_INTEGRATION_SETTINGS: "update_customer_integration_settings_event",

	// application edit event
	APPLICATION_EDIT: "application_edit_event",

	DELETE_INTEGRATION_DATA: "delete_integration_data_event",

	CASE_STATUS_UPDATED: "case_status_updated_event",

	WORKFLOW_CHANGE_ATTRIBUTE: "workflow_change_attribute_event",

	INTEGRATION_FAILED_AUDIT: "integration_failed_audit_event",

	CASE_REASSIGNED_AUDIT: "case_reassigned_audit_event",
	CASE_REASSIGNED: "case_reassigned_event",
	CASE_UNASSIGNED_AUDIT: "case_unassigned_audit_event",
	CASE_UNASSIGNED: "case_unassigned_event",
	APPLICATION_EDIT_BEGAN_AUDIT: "application_edit_began_audit_event",
	ONBOARDING_ESIGN_COMPLETED_AUDIT: "onboarding_esign_completed_audit_event",
	// Decrypt field audit log event
	DECRYPT_FIELD_AUDIT: "decrypt_field_audit_event",
	CALCULATE_BUSINESS_FACTS: "calculate_business_facts_event",
	PURGED_BUSINESS_AUDIT: "purged_business_audit_event",
	RESTORED_BUSINESS_AUDIT: "restored_business_audit_event",
	ARCHIVED_BUSINESS_AUDIT: "archived_business_audit_event",
	UNARCHIVED_BUSINESS_AUDIT: "unarchived_business_audit_event",
	APPLICANT_REMINDER: "applicant_reminder_event",

	INTEGRATION_CATEGORY_COMPLETE: "integration_category_complete_event",

	BUSINESS_STATE_UPDATE_EVENT: "business_state_update_event",

	// event to audit custom field changes
	CUSTOM_FIELDS_UPDATED_AUDIT: "custom_fields_updated_audit_event"
};
