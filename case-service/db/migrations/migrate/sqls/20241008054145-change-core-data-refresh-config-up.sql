/* Replace with your SQL commands */
-- Change Table Name with new Name
ALTER TABLE core_data_refresh_config RENAME TO core_score_refresh_config;

ALTER TABLE core_score_refresh_config
ADD COLUMN config JSONB;

UPDATE core_score_refresh_config
SET config = jsonb_build_object('refresh_value', refresh_cycle_in_days, 'unit', 'days');

ALTER TABLE core_score_refresh_config
DROP COLUMN refresh_cycle_in_days;

INSERT INTO core_score_refresh_config (id, refresh_type, config)
VALUES (3, 'MANUAL_REFRESH', jsonb_build_object('delay_between_subsequent_refresh', 10, 'unit', 'minutes'));

