/* Replace with your SQL commands */

/* Replace with your SQL commands */
-- add core integration platform
INSERT INTO "integrations"."core_integrations_platforms" ("id", "code", "label", "category_id") 
VALUES (39, 'serp_google_profile', 'SERP Google Profile', 7);

INSERT INTO "integrations"."core_tasks" ("id", "code", "label") 
VALUES (24, 'fetch_google_profile', 'Fetch Google Profile');

-- add rel-task
INSERT INTO "integrations"."rel_tasks_integrations" ("id", "task_category_id", "platform_id") 
VALUES (80, (SELECT "id" FROM "integrations"."core_tasks" WHERE "code" = 'fetch_google_profile'), 39);