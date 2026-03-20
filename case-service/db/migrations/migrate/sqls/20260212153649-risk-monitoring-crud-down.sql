DROP TRIGGER IF EXISTS set_timestamp_rel_risk_alert_rule ON monitoring.rel_risk_alert_rule;
DROP TRIGGER IF EXISTS set_timestamp_monitoring_templates ON monitoring.monitoring_templates;
DROP TRIGGER IF EXISTS set_timestamp_risk_alert ON monitoring.risk_alert;
DROP TRIGGER IF EXISTS set_timestamp_risk_bucket ON monitoring.risk_bucket;
DROP TRIGGER IF EXISTS set_timestamp_risk_category ON monitoring.risk_category;

DROP TABLE IF EXISTS monitoring.rel_business_monitoring_run;
DROP TABLE IF EXISTS monitoring.rel_monitoring_rules;
DROP TABLE IF EXISTS monitoring.rel_monitoring_template_business;
DROP TABLE IF EXISTS monitoring.rel_integration_group_monitoring_template;
DROP TABLE IF EXISTS monitoring.rel_risk_alert_rule;
DROP TABLE IF EXISTS monitoring.rel_case_risk_alert;

DROP TABLE IF EXISTS monitoring.monitoring_run;
DROP TABLE IF EXISTS monitoring.monitoring_templates;

DROP TYPE IF EXISTS monitoring.monitoring_run_status_enum;
DROP TYPE IF EXISTS monitoring.monitoring_cadence_enum;
DROP TYPE IF EXISTS monitoring.monitoring_association_enum;

DROP TABLE IF EXISTS monitoring.risk_alert;
DROP TABLE IF EXISTS monitoring.risk_bucket;
DROP TABLE IF EXISTS monitoring.risk_category;
DROP TABLE IF EXISTS monitoring.business_states;

DROP SCHEMA IF EXISTS monitoring;