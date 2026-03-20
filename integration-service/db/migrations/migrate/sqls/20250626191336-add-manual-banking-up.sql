INSERT INTO "integrations"."core_integrations_platforms" ("id", "code", "label", "category_id") VALUES (34, 'manual_banking', 'Manual Banking', 3);
-- link "manual" platform to "fetch_asset_data" task
INSERT INTO "integrations"."rel_tasks_integrations" ("id", "task_category_id", "platform_id") 
VALUES (69, (SELECT "id" FROM "integrations"."core_tasks" WHERE "code" = 'fetch_assets_data'), 34);