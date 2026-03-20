ALTER TABLE IF EXISTS data_cases DROP CONSTRAINT IF EXISTS data_cases_status_fkey;

ALTER TABLE IF EXISTS data_cases DROP CONSTRAINT IF EXISTS data_cases_business_id_fkey;

ALTER TABLE IF EXISTS data_case_status_history DROP CONSTRAINT IF EXISTS data_case_status_history_case_id_fkey;

ALTER TABLE IF EXISTS data_case_status_history DROP CONSTRAINT IF EXISTS data_case_status_history_status_fkey;

ALTER TABLE IF EXISTS rel_business_owners DROP CONSTRAINT IF EXISTS rel_business_owners_business_id_fkey;

ALTER TABLE IF EXISTS rel_business_owners DROP CONSTRAINT IF EXISTS rel_business_owners_owner_id_fkey;

ALTER TABLE IF EXISTS rel_business_customer_monitoring DROP CONSTRAINT IF EXISTS rel_business_customer_monitoring_business_id_fkey;

ALTER TABLE IF EXISTS rel_risk_cases DROP CONSTRAINT IF EXISTS rel_risk_cases_case_id_fkey;