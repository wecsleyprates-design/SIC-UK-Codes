-- Delete all risk alerts for integration_failure risk type
DELETE FROM data_risk_alerts
USING core_risk_alerts_config, data_risk_alerts_config, core_risk_sub_types
WHERE data_risk_alerts.risk_alert_config_id = data_risk_alerts_config.id 
AND core_risk_alerts_config.id = data_risk_alerts_config.risk_alert_config_id
AND core_risk_alerts_config.risk_sub_type = core_risk_sub_types.id 
AND code = 'integration_failure';

-- Delete risk alert configuration for integration_failure risk type
DELETE FROM data_risk_alerts_config
USING core_risk_alerts_config, core_risk_sub_types
WHERE core_risk_alerts_config.id = data_risk_alerts_config.risk_alert_config_id
AND core_risk_alerts_config.risk_sub_type = core_risk_sub_types.id 
AND code = 'integration_failure';

-- Delete core risk alert configuration for integration_failure risk type
DELETE FROM core_risk_alerts_config
USING core_risk_sub_types
WHERE core_risk_alerts_config.risk_sub_type = core_risk_sub_types.id 
AND code = 'integration_failure';

-- Delete risk sub type for integration_failure risk type
DELETE FROM core_risk_sub_types
WHERE code = 'integration_failure';