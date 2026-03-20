ALTER TABLE business_score_triggers ALTER COLUMN applicant_id DROP NOT NULL;

ALTER TABLE business_score_triggers ADD COLUMN trigger_type VARCHAR default 'ONBOARDING_INVITE' NOT NULL;
