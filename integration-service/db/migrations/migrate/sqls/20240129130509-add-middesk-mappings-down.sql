-- Remove Seed data
DELETE FROM "integrations"."rel_tasks_integrations" WHERE "platform_id" = 16;

-- -- Remove Seed data
DELETE FROM "integrations"."rel_tasks_integrations"
WHERE "task_category_id" = (SELECT id FROM integrations.core_tasks WHERE code = 'fetch_business_entity_verification');

-- Remove Seed data
DELETE FROM "integrations"."core_tasks" WHERE "id" = 12;


-- -- Remove Seed data
DELETE FROM "integrations"."core_tasks"
WHERE "code" = 'fetch_business_entity_verification';