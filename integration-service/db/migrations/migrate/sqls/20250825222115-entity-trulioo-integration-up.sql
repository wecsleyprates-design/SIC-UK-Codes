/* Replace with your SQL commands */

-- add core integration platform
INSERT INTO "integrations"."core_integrations_platforms" ("id", "code", "label", "category_id") 
VALUES (38, 'trulioo', 'Trulioo', 7);

-- add rel-task
INSERT INTO "integrations"."rel_tasks_integrations" ("id", "task_category_id", "platform_id") 
VALUES (78, (SELECT "id" FROM "integrations"."core_tasks" WHERE "code" = 'fetch_business_entity_verification'), 38);

