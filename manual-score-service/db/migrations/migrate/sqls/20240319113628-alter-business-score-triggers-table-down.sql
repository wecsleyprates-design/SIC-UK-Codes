/* Replace with your SQL commands */
ALTER TABLE business_score_triggers DROP COLUMN trigger_type;

ALTER TABLE business_score_triggers ALTER COLUMN applicant_id SET NOT NULL;