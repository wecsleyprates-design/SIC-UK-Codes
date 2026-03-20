/* Replace with your SQL commands */

-- add core integration platform
INSERT INTO "integrations"."core_integrations_platforms" ("id", "code", "label", "category_id") 
VALUES (31, 'ai_naics_enrichment', 'AI NAICS Enrichment', 9);

-- add core_task
INSERT INTO "integrations"."core_tasks" ("id", "code", "label") 
VALUES (23, 'perform_business_enrichment', 'Enrich Business Data');

-- add rel-task
INSERT INTO "integrations"."rel_tasks_integrations" ("id", "task_category_id", "platform_id") 
VALUES (66, (SELECT "id" FROM "integrations"."core_tasks" WHERE "code" = 'perform_business_enrichment'), 31);
