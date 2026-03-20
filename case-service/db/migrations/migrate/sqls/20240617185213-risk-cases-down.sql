--- Drop foreign key constraint
ALTER TABLE IF EXISTS rel_risk_cases DROP CONSTRAINT IF EXISTS case_id_fk;

--- Drop table rel_risk_cases
DROP TABLE IF EXISTS rel_risk_cases;