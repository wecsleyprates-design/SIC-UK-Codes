-- Purpose: Add score_risk_tier_transition as a new risk type and its corresponding risk alert configuration
INSERT INTO core_risk_sub_types(id, code, label, parent_risk_type) 
VALUES (8, 'score_risk_tier_transition', 'Score Risk Tier Transition', (SELECT id FROM core_risk_types WHERE code = 'score'));

-- Add risk alert configuration for score_risk_tier_transition risk type
INSERT INTO core_risk_alerts_config (id, risk_type, measurement_operation, measurement_config_schema, customer_managed, risk_sub_type) VALUES 
(10, (SELECT id FROM core_risk_types WHERE code = 'score'),'TRANSITION', '{"type": "object", "properties": {"from": {"type": "string"}, "to": {"type": "string"}}, "required": ["condition"], "additionalProperties": "false"}', TRUE, 8);

-- Add risk alert configuration for score_risk_tier_transition risk type
INSERT INTO data_risk_alerts_config (risk_alert_config_id, measurement_config, risk_level, customer_id, created_by, updated_by) VALUES 
(10, '{"from":"LOW", "to":"MODERATE"}', 'MODERATE', NULL, 'e9d43901-3fc6-4ee9-97be-74cd23b39aa0','e9d43901-3fc6-4ee9-97be-74cd23b39aa0'),
(10, '{"from":"MODERATE", "to":"HIGH"}', 'HIGH', NULL, 'e9d43901-3fc6-4ee9-97be-74cd23b39aa0','e9d43901-3fc6-4ee9-97be-74cd23b39aa0');