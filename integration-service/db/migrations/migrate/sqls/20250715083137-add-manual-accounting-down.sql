-- Disconnect manual from fetch_assets_data task
DELETE FROM "integrations"."rel_tasks_integrations" WHERE "id" IN (70, 71, 72, 73, 74, 75);

DELETE FROM "integrations"."core_integrations_platforms" WHERE "id" = 35;