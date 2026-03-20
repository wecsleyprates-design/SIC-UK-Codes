-- Add business_id column to data_risk_alerts table
ALTER TABLE data_risk_alerts ADD COLUMN business_id uuid;

-- fill business_id column with business_id from business_score_triggers
UPDATE data_risk_alerts SET business_id = bst.business_id FROM integrations.business_score_triggers bst WHERE data_risk_alerts.cause_id = bst.id;

-- fill business_id column with business_id from data_business_integrations_tasks
UPDATE data_risk_alerts 
  SET business_id = bst.business_id 
  FROM integrations.data_business_integrations_tasks dbit
  INNER JOIN integrations.business_score_triggers bst ON dbit.business_score_trigger_id = bst.id
  WHERE data_risk_alerts.cause_id = dbit.id;

-- Add not null constraint to business_id column
ALTER TABLE data_risk_alerts ALTER COLUMN business_id SET NOT NULL;