-- Drop the table integration_data.public_records
ALTER TABLE integration_data.public_records DROP CONSTRAINT IF EXISTS fk_business_integration_tasks_id_public_records;
DROP TABLE IF EXISTS integration_data.public_records;

-- Remove Seed data
DELETE FROM "integrations"."rel_tasks_integrations" WHERE "id" = 4;

-- Remove Seed data
DELETE FROM "integrations"."core_tasks" WHERE "id" = 4;

-- Remove Seed data
DELETE FROM "integrations"."core_integrations_platforms" WHERE "id" = 4;

-- Remove Seed data
DELETE FROM "integrations"."core_categories" WHERE "id" = 5;





