DROP TABLE IF EXISTS integration_data.tax_filings;

-- Drop the enum integration_data.business_type
DROP TYPE IF EXISTS integration_data.business_type;

-- Remove data if exists for rel_tasks_integrations
DELETE FROM "integrations"."rel_tasks_integrations" WHERE "id" = 40;

-- Remove data if exists for core_tasks
DELETE FROM "integrations"."core_tasks" WHERE "id" = 10;

-- Remove data if exists for core_integrations_platforms
DELETE FROM "integrations"."core_integrations_platforms" WHERE "id" = 15;
