/* Added SQL command to drop column is_enabled */
ALTER TABLE data_risk_alerts_config
DROP COLUMN is_enabled;

-- Revert alter column length
ALTER TABLE core_risk_sub_types 
ALTER COLUMN code TYPE VARCHAR(20),
ALTER COLUMN label TYPE VARCHAR(20);