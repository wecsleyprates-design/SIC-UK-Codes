/* Replace with your SQL commands */
-- add core integration platform
INSERT INTO "integrations"."core_integrations_platforms" ("id", "code", "label", "category_id") 
VALUES (36, 'ai_website_enrichment', 'AI Website Enrichment', 9);


-- add rel-task
INSERT INTO "integrations"."rel_tasks_integrations" ("id", "task_category_id", "platform_id") 
VALUES (76, (SELECT "id" FROM "integrations"."core_tasks" WHERE "code" = 'perform_business_enrichment'), 36);