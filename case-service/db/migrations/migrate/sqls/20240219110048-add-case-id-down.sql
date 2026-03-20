ALTER TABLE IF EXISTS data_invites DROP CONSTRAINT IF EXISTS fk_data_invites_data_cases_case_id;
ALTER TABLE IF EXISTS data_invites DROP COLUMN IF EXISTS case_id;
