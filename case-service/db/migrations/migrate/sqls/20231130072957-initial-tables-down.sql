-- Drop table rel_business_applicants
ALTER TABLE rel_business_applicants DROP CONSTRAINT IF EXISTS business_id_fk;
DROP TABLE IF EXISTS rel_business_applicants;

-- Drop table rel_business_customer_monitoring
ALTER TABLE rel_business_customer_monitoring DROP CONSTRAINT IF EXISTS business_id_fk;
DROP TABLE IF EXISTS rel_business_customer_monitoring;

-- Drop table rel_business_owners
ALTER TABLE rel_business_owners DROP CONSTRAINT IF EXISTS business_id_fk;
ALTER TABLE rel_business_owners DROP CONSTRAINT IF EXISTS owner_id_fk;
DROP TABLE IF EXISTS rel_business_owners;

-- Drop table data_owners
ALTER TABLE data_owners DROP CONSTRAINT IF EXISTS title_fk;
DROP TRIGGER IF EXISTS set_timestamp ON data_owners;
DROP TABLE IF EXISTS data_owners;

-- Drop table core_owner_titles
DROP TABLE IF EXISTS core_owner_titles;

-- Drop table data_case_status_history
ALTER TABLE data_case_status_history DROP CONSTRAINT IF EXISTS status_fk;
ALTER TABLE data_case_status_history DROP CONSTRAINT IF EXISTS case_id_fk;
DROP TRIGGER IF EXISTS set_timestamp ON data_case_status_history;
DROP TABLE IF EXISTS data_case_status_history;

-- Drop table data_cases
ALTER TABLE data_cases DROP CONSTRAINT IF EXISTS business_id_fk;
ALTER TABLE data_cases DROP CONSTRAINT IF EXISTS status_fk;
DROP TRIGGER IF EXISTS set_timestamp ON data_cases;
DROP TABLE IF EXISTS data_cases;

-- Drop table data_businesses
DROP TRIGGER IF EXISTS set_timestamp ON data_businesses;
DROP TABLE IF EXISTS data_businesses;

-- Drop table core_case_statuses
DROP TABLE IF EXISTS core_case_statuses;