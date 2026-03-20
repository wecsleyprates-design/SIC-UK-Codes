-- revert deleted column cause_id to data_risk_alerts table
ALTER TABLE data_risk_alerts ADD COLUMN cause_id UUID DEFAULT NULL;

-- fill cause_id column with integration_task_id
UPDATE data_risk_alerts
SET cause_id = integration_task_id
WHERE integration_task_id IS NOT NULL;

-- fill cause_id column with score_trigger_id
UPDATE data_risk_alerts
SET cause_id = score_trigger_id
WHERE score_trigger_id IS NOT NULL;

-- Add not null constraint to cause_id column
ALTER TABLE data_risk_alerts ALTER COLUMN cause_id SET NOT NULL;

ALTER TABLE data_risk_alerts DROP CONSTRAINT integration_task_id_score_trigger_id_not_null;

ALTER TABLE data_risk_alerts DROP COLUMN score_trigger_id;

ALTER TABLE data_risk_alerts DROP COLUMN integration_task_id;