-- Purpose: Add integration_task_id & score_trigger_id columns to data_risk_alerts table and remove cause_id column from data_risk_alerts table
ALTER TABLE data_risk_alerts ADD COLUMN integration_task_id UUID DEFAULT NULL;

ALTER TABLE data_risk_alerts ADD COLUMN score_trigger_id UUID DEFAULT NULL;

-- fill integration_task_id column with id from data_business_integrations_tasks
UPDATE data_risk_alerts
SET integration_task_id = dbit.id
FROM integrations.data_business_integrations_tasks dbit 
WHERE data_risk_alerts.cause_id = dbit.id;

-- fill score_trigger_id column with id from business_score_triggers
UPDATE data_risk_alerts
SET score_trigger_id = bst.id
FROM integrations.business_score_triggers bst
WHERE data_risk_alerts.cause_id = bst.id;

-- Add check for atleast integration_task_id & score_trigger_id column to be not null
ALTER TABLE data_risk_alerts ADD CONSTRAINT integration_task_id_score_trigger_id_not_null CHECK (integration_task_id IS NOT NULL OR score_trigger_id IS NOT NULL);

-- Remove cause_id column from data_risk_alerts table
ALTER TABLE data_risk_alerts DROP COLUMN cause_id;

-- Update risk_type for equifax credit score in core risk alert configuration to integration
UPDATE core_risk_alerts_config 
SET risk_type = (SELECT id FROM core_risk_types WHERE code = 'integration')
WHERE risk_sub_type = (SELECT id FROM core_risk_sub_types WHERE code = 'equifax_credit_score');

-- Add new enum to risk_condition_measurement_type
ALTER TYPE risk_condition_measurement_type ADD VALUE 'BOOLEAN';