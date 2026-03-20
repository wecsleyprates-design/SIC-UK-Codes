ALTER TABLE IF EXISTS integrations.data_connections_history DROP CONSTRAINT IF EXISTS fk_integrations_connections_history;

ALTER TABLE IF EXISTS integrations.data_connections_history ADD CONSTRAINT fk_integrations_connections_history FOREIGN KEY (connection_id) REFERENCES integrations.data_connections(id) ON DELETE CASCADE ON UPDATE RESTRICT;


ALTER TABLE IF EXISTS data_cases DROP CONSTRAINT IF EXISTS fk_business_score_trigger;

ALTER TABLE IF EXISTS data_cases ADD CONSTRAINT fk_business_score_trigger FOREIGN KEY (score_trigger_id) REFERENCES integrations.business_score_triggers(id) ON DELETE CASCADE ON UPDATE RESTRICT;


ALTER TABLE IF EXISTS integration_data.tax_filings DROP CONSTRAINT IF EXISTS fk_business_integration_tasks_id_tax_filing;

ALTER TABLE IF EXISTS integration_data.tax_filings ADD CONSTRAINT fk_business_integration_tasks_id_tax_filing FOREIGN KEY (business_integration_task_id) REFERENCES integrations.data_business_integrations_tasks(id) ON DELETE CASCADE ON UPDATE RESTRICT;


ALTER TABLE IF EXISTS integration_data.business_ratings DROP CONSTRAINT IF EXISTS fk_business_integration_task_id;

ALTER TABLE IF EXISTS integration_data.business_ratings ADD CONSTRAINT fk_business_integration_task_id FOREIGN KEY (business_integration_task_id) REFERENCES integrations.data_business_integrations_tasks(id) ON DELETE CASCADE ON UPDATE RESTRICT;


ALTER TABLE IF EXISTS data_risk_alerts ADD CONSTRAINT fk_integration_task_id FOREIGN KEY (integration_task_id) REFERENCES integrations.data_business_integrations_tasks(id) ON DELETE CASCADE ON UPDATE RESTRICT;

ALTER TABLE IF EXISTS data_risk_alerts ADD CONSTRAINT fk_score_trigger_id FOREIGN KEY (score_trigger_id) REFERENCES integrations.business_score_triggers(id) ON DELETE CASCADE ON UPDATE RESTRICT;