
-- =============================================
-- DOWN MIGRATION: Drop applicant reminder threshold tables
-- =============================================

DROP INDEX IF EXISTS idx_reminder_tracker_applicant_id;
DROP INDEX IF EXISTS idx_reminder_tracker_case_id;
DROP INDEX IF EXISTS idx_reminder_tracker_business_id;


-- Drop dependent table first (because it references the core table)
DROP TABLE IF EXISTS data_applicants_threshold_reminder_tracker CASCADE;

DROP TABLE IF EXISTS business_applicant_configs CASCADE;

DROP TABLE IF EXISTS customer_applicant_configs CASCADE;

DROP TABLE IF EXISTS core_applicant_configs CASCADE;