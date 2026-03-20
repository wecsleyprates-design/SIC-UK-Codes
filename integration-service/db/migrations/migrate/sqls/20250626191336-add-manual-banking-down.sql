-- Disconnect manual from fetch_assets_data task
DELETE FROM "integrations"."rel_tasks_integrations" WHERE "id" = 69;

DELETE FROM "integrations"."core_integrations_platforms" WHERE "id" = 34;
