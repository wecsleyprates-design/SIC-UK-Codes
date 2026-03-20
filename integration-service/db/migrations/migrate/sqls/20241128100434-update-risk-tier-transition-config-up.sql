WITH unique_customers AS (
    SELECT DISTINCT customer_id
    FROM data_risk_alerts_config
    WHERE risk_alert_config_id = 10
)
INSERT INTO data_risk_alerts_config (
    risk_alert_config_id, 
    is_enabled, 
    measurement_config, 
    risk_level, 
    customer_id, 
    created_by, 
    updated_by
)
SELECT 
    10 AS risk_alert_config_id,
    TRUE AS is_enabled, 
    '{"from": "LOW", "to": "HIGH"}'::JSON AS measurement_config, 
    'HIGH' AS risk_level, 
    customer_id, 
    'e9d43901-3fc6-4ee9-97be-74cd23b39aa0' AS created_by, 
    'e9d43901-3fc6-4ee9-97be-74cd23b39aa0' AS updated_by
FROM unique_customers;
