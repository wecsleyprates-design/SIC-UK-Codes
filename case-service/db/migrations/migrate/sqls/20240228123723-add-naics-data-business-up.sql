/* Replace with your SQL commands */
ALTER TABLE IF EXISTS data_businesses ADD COLUMN naics_code INTEGER NULL;

ALTER TABLE IF EXISTS data_businesses ADD COLUMN naics_title VARCHAR(100) NULL;