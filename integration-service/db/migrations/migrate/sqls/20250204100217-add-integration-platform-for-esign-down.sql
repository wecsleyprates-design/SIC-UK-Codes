/* Replace with your SQL commands */
DELETE FROM integrations.rel_tasks_integrations WHERE task_category_id = 19 AND platform_id = 25;

DELETE FROM integrations.core_tasks WHERE id = 19;

DELETE FROM integrations.core_integrations_platforms WHERE id = 25;
