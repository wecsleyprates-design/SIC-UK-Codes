--- Create a new table for case type
CREATE TABLE IF NOT EXISTS core_case_types (
  id serial NOT NULL PRIMARY KEY,
  code varchar NOT NULL UNIQUE,
  label varchar NOT NULL
);

--- Seed the case type table with the initial data
INSERT INTO core_case_types (id, code, label) VALUES
    (1, 'onboarding','ONBOARDING'),
    (2, 'refresh','REFRESH'),
    (3, 'risk','RISK');

--- Add a new column to the data_cases table for case type
ALTER TABLE data_cases ADD COLUMN case_type INT NOT NULL DEFAULT 1;

--- Add a foreign key constraint to the case_type column
ALTER TABLE data_cases ADD CONSTRAINT case_type_fk FOREIGN KEY (case_type) REFERENCES core_case_types(id);

--- Update the existing data in the data_cases table to set the case_type to 1 ie. ONBOARDING
UPDATE data_cases SET case_type = 1;