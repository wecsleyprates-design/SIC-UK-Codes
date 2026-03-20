--- This migration creates the tables and triggers for the risk alerts feature
--- The feature allows the configuration of alerts for different risk types and sub types
--- The alerts can be configured to trigger based on different conditions like new data, range, more than, less than, equals

--- TABLE core_risk_types to store the risk types
CREATE TABLE core_risk_types (
  id SERIAL PRIMARY KEY,
  code VARCHAR(20),
  label VARCHAR(20)
);

--- insert the default risk types
INSERT INTO core_risk_types (id, code, label) VALUES 
(1, 'integration','Integration'),
(2, 'score','Score');

--- TABLE core_risk_sub_types to store the risk sub types
CREATE TABLE core_risk_sub_types (
  id SERIAL PRIMARY KEY,
  code VARCHAR(20),
  label VARCHAR(20),
  parent_risk_type INTEGER NOT NULL REFERENCES core_risk_types(id),
  CONSTRAINT fk_parent_risk_type FOREIGN KEY (parent_risk_type) REFERENCES core_risk_types(id)
);

--- insert the default risk sub types
INSERT INTO core_risk_sub_types (id, code, label, parent_risk_type) VALUES 
(1, 'new_lien','New Lien', 1),
(2, 'new_bankruptcy','New Bankruptcy', 1),
(3, 'new_judgement', 'New Judgement', 1),
(4, 'equifax_credit_score','Equifax Credit Score', 1),
(5, 'score_range','Score Range', 2);

CREATE TYPE risk_condition_measurement_type AS ENUM (
  'RANGE',
  'MORE_THAN', 
  'LESS_THAN',
  'EQUALS', 
  'NEW_DATA'
);

--- TABLE core_risk_alerts_config to store the configuration of the alerts
CREATE TABLE core_risk_alerts_config (
  id SERIAL PRIMARY KEY,
  risk_type INTEGER NOT NULL REFERENCES core_risk_types(id),
  measurement_operation risk_condition_measurement_type NOT NULL,
  measurement_config_schema JSON NOT NULL, -- the schema of the measurement config which we will use to validate the measurement config
  customer_managed BOOLEAN NOT NULL DEFAULT TRUE,
  risk_sub_type INTEGER NULL REFERENCES core_risk_sub_types(id),
  created_at TIMESTAMP DEFAULT current_timestamp NOT NULL,
  CONSTRAINT fk_risk_type FOREIGN KEY (risk_type) REFERENCES core_risk_types(id),
  CONSTRAINT fk_risk_sub_type FOREIGN KEY (risk_sub_type) REFERENCES core_risk_sub_types(id)
);

--- insert the default configuration for the alerts
INSERT INTO core_risk_alerts_config (id, risk_type, measurement_operation, measurement_config_schema, customer_managed, risk_sub_type) VALUES 
(1, 1, 'NEW_DATA', '{"type": "object", "properties": {"threshold": {"type": "number"}}, "required": ["threshold"], "additionalProperties": "false"}', TRUE, 1), -- for new lien
(2, 1, 'NEW_DATA', '{"type": "object", "properties": {"threshold": {"type": "number"}}, "required": ["threshold"], "additionalProperties": "false"}', TRUE, 2), -- for new bankruptcy
(3, 1, 'NEW_DATA', '{"type": "object", "properties": {"threshold": {"type": "number"}}, "required": ["threshold"], "additionalProperties": "false"}', TRUE, 3), -- for new judgement
(4, 2, 'RANGE', '{"type": "object", "properties": {"min": {"type": "number"}, "max": {"type": "number"}}, "required": ["min", "max"], "additionalProperties": "false"}', TRUE, 5), -- for score range
(5, 2, 'LESS_THAN', '{"type": "object", "properties": {"threshold": {"type": "number"}}, "required": ["threshold"], "additionalProperties": "false"}', TRUE, 4), -- for equifax credit score
(6, 2, 'MORE_THAN', '{"type": "object", "properties": {"threshold": {"type": "number"}}, "required": ["threshold"], "additionalProperties": "false"}', TRUE, NULL),
(7, 2, 'EQUALS', '{"type": "object", "properties": {"threshold": {"type": "number"}}, "required": ["threshold"], "additionalProperties": "false"}', TRUE, NULL);

--- TYPE risk_level to store the risk level of the alert
CREATE TYPE risk_level_type AS ENUM (
  'HIGH',
  'MODERATE',
  'LOW'
);

--- TABLE data_risk_alerts_config to store the configuration of the alerts per customer
CREATE TABLE data_risk_alerts_config (
  id UUID DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  risk_alert_config_id INTEGER NOT NULL,
  measurement_config JSON NOT NULL,
  risk_level risk_level_type NOT NULL DEFAULT 'LOW',
  customer_id UUID NULL, -- null entries only for admin
  created_at TIMESTAMP DEFAULT current_timestamp NOT NULL,
  created_by UUID NOT NULL,
  updated_at TIMESTAMP DEFAULT current_timestamp NOT NULL,
  updated_by UUID NOT NULL,
  CONSTRAINT fk_risk_alert_config FOREIGN KEY (risk_alert_config_id) REFERENCES core_risk_alerts_config(id)
);

CREATE TRIGGER data_risk_alerts_config_updated_at
BEFORE UPDATE ON data_risk_alerts_config 
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

-- TABLE data_risk_alerts to store the alerts
CREATE TABLE data_risk_alerts (
  id UUID DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  risk_alert_config_id UUID NOT NULL REFERENCES data_risk_alerts_config(id),
  measurement_config JSON NOT NULL,
  customer_id UUID NOT NULL,
  cause_id UUID NOT NULL, -- the id of the cause of the alert like score trigger id or integration task id
  created_at TIMESTAMP DEFAULT current_timestamp NOT NULL,
  CONSTRAINT fk_risk_alert_config FOREIGN KEY (risk_alert_config_id) REFERENCES data_risk_alerts_config(id)
);