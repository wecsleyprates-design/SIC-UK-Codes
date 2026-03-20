export const WEBHOOK_EVENTS = {
	INTEGRATION_CONNECTED: "integration.connected",
	INTEGRATION_DISCONNECTED: "integration.disconnected",
	INTEGRATION_FAILED: "integration.failed",
	RISK_ALERT: "risk.alert",
	WORTH_SCORE_REFRESHED: "score.refreshed",
	WORTH_SCORE_GENERATED: "score.generated",
	ONBOARDING_INVITED: "onboarding.invited",
	ONBOARDING_INVITE_ACCEPTED: "onboarding.invite_accepted",
	ONBOARDING_INVITE_COMPLETED: "onboarding.invite_completed",
	ONBOARDING_INVITE_EXPIRED: "onboarding.invite_expired",
	BUSINESS_UPDATED: "business.updated"
} as const;
