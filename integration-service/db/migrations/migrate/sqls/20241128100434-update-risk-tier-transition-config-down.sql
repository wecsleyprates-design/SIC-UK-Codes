/* Replace with your SQL commands */
DELETE FROM data_risk_alerts_config
WHERE risk_alert_config_id = 10
  AND measurement_config::jsonb = '{"from": "LOW", "to": "HIGH"}'::jsonb
  AND risk_level = 'HIGH'
RETURNING *;
