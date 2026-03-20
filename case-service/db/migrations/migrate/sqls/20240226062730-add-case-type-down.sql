--- DROP CONSTRAINT from data_cases table for case_type
ALTER TABLE IF EXISTS data_cases DROP CONSTRAINT IF EXISTS case_type_fk;

--- DROP COLUMN from data_cases table for case_type
ALTER TABLE IF EXISTS data_cases DROP COLUMN IF EXISTS case_type;

--- DROP TABLE from core_case_types
DROP TABLE IF EXISTS core_case_types;