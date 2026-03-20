-- Delete the task-platform association first to avoid foreign key constraint violations
DELETE FROM integrations.rel_tasks_integrations
WHERE id = '61';

-- Delete the task definition
DELETE FROM integrations.core_tasks
WHERE id = '20';

-- Delete the integration platform entry for GIACT
DELETE FROM integrations.core_integrations_platforms
WHERE id = '26';
