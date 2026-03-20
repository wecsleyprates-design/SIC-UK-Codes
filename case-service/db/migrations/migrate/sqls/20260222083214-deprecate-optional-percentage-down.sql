-- Restore Optional Ownership Percentage status from temporary table
UPDATE onboarding_schema.data_customer_stage_fields_config dcsfc
SET config = a.old_config
FROM onboarding_schema.tmp_ownership_percentage_migration a
WHERE dcsfc.id = a.id;

DROP TABLE IF EXISTS onboarding_schema.tmp_ownership_percentage_migration;