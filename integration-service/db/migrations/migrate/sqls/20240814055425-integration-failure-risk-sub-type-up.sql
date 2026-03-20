-- Purpose: Add integration_failure as a new risk type and its corresponding risk alert configuration
INSERT INTO core_risk_sub_types (id, code, label, parent_risk_type)
VALUES (7, 'integration_failure', 'Integration Failure', (SELECT id FROM core_risk_types WHERE code = 'integration'));

-- Add risk alert configuration for integration_failure risk type
INSERT INTO core_risk_alerts_config (id, risk_type, measurement_operation, measurement_config_schema, customer_managed, risk_sub_type) VALUES 
(9, 1,'BOOLEAN', '{"type": "object", "properties": {"condition": {"type": "boolean"}}, "required": ["condition"], "additionalProperties": "false"}', TRUE, 7);

-- Add risk alert configuration for integration_failure risk type
INSERT INTO data_risk_alerts_config (risk_alert_config_id, measurement_config, risk_level, customer_id, created_by, updated_by) VALUES 
(9, '{"condition":true}', 'HIGH', NULL, 'e9d43901-3fc6-4ee9-97be-74cd23b39aa0','e9d43901-3fc6-4ee9-97be-74cd23b39aa0');