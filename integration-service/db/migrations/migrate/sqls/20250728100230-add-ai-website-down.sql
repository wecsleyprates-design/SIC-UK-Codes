/* Replace with your SQL commands */
/* Get rid of the AI Website Enrichment platform and task */
DELETE FROM "integrations"."rel_tasks_integrations" WHERE "id" = 76;
DELETE FROM "integrations"."core_integrations_platforms" WHERE "id" = 36;