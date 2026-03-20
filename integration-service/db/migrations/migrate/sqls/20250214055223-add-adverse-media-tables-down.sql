/* Replace with your SQL commands */
DROP TABLE IF EXISTS integration_data.adverse_media_articles;

DROP TABLE IF EXISTS integration_data.adverse_media;

DELETE FROM integrations.rel_tasks_integrations WHERE task_category_id = 21 AND platform_id = 27;

DELETE FROM "integrations"."core_tasks" WHERE "id" = 21;

DELETE FROM "integrations"."core_integrations_platforms" WHERE "id" = 27;
