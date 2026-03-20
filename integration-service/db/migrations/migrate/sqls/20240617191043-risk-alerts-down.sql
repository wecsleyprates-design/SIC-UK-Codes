--- remove constraints from data_risk_alerts
ALTER TABLE data_risk_alerts DROP CONSTRAINT IF EXISTS fk_risk_alert_config;

-- Drop table data_risk_alerts
DROP TABLE IF EXISTS data_risk_alerts;

--- remove constraints from data_risk_alerts_config
ALTER TABLE data_risk_alerts_config DROP CONSTRAINT IF EXISTS fk_risk_alert_config;

-- down script for CREATE TABLE data_risk_alerts_config
DROP TABLE IF EXISTS data_risk_alerts_config;

-- down script for CREATE TRIGGER data_risk_alerts_config_updated_at
DROP TRIGGER IF EXISTS data_risk_alerts_config_updated_at ON data_risk_alerts_config;

-- down script for CREATE TYPE risk_level
DROP TYPE IF EXISTS risk_level_type;

--- remove constraints from core_risk_alerts_config
ALTER TABLE core_risk_alerts_config DROP CONSTRAINT IF EXISTS fk_risk_type;
ALTER TABLE core_risk_alerts_config DROP CONSTRAINT IF EXISTS fk_risk_sub_type;

-- down script for CREATE TABLE core_risk_alerts_config
DROP TABLE IF EXISTS core_risk_alerts_config;

-- down script for CREATE TYPE risk_condition_measurement
DROP TYPE IF EXISTS risk_condition_measurement_type;

--- remove constraints from core_risk_sub_types
ALTER TABLE core_risk_sub_types DROP CONSTRAINT IF EXISTS fk_parent_risk_type;

-- down script for CREATE TABLE core_risk_sub_types
DROP TABLE IF EXISTS core_risk_sub_types;

-- down script for CREATE TABLE core_risk_types
DROP TABLE IF EXISTS core_risk_types;