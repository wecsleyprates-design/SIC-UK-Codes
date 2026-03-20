INSERT INTO core_risk_sub_types (id, code, label, parent_risk_type) VALUES
    (6, 'worth_score_change','Worth Score Change', 2);

INSERT INTO core_risk_alerts_config (id, risk_type, measurement_operation, measurement_config_schema, customer_managed, risk_sub_type) VALUES 
(8, 2, 'LESS_THAN', '{"type": "object", "properties": {"threshold": {"type": "number"}}, "required": ["threshold"], "additionalProperties": "false"}', TRUE, 6); -- for worth score change

INSERT INTO data_risk_alerts_config (risk_alert_config_id, measurement_config, risk_level, customer_id, created_by, updated_by) VALUES 
(8, '{"threshold":50}', 'HIGH', NULL, 'e9d43901-3fc6-4ee9-97be-74cd23b39aa0','e9d43901-3fc6-4ee9-97be-74cd23b39aa0');