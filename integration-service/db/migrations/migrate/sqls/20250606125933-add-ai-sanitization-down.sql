/* Get rid of the AI Sanitization platform and task */
DELETE FROM "integrations"."rel_tasks_integrations" WHERE "id" = 68;
DELETE FROM "integrations"."core_integrations_platforms" WHERE "id" = 33;