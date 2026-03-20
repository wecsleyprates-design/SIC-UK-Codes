--- Add core_cron_config table
CREATE TABLE core_cron_config (
    id SERIAL PRIMARY KEY,
    job_type VARCHAR(30) NOT NULL,
    config JSON NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER update_core_cron_config_timestamp
BEFORE UPDATE ON core_cron_config
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

INSERT INTO core_cron_config (job_type, config) VALUES ('ARCHIVE_CASES', '{"transition_days": "30"}');
INSERT INTO core_cron_config (job_type, config) VALUES ('UMR_CASES', '{"transition_days": "30"}');