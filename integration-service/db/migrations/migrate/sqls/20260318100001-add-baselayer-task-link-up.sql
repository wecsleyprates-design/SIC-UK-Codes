/* Replace with your SQL commands */

INSERT INTO integrations.rel_tasks_integrations (id, task_category_id, platform_id)
VALUES (83, (SELECT id FROM integrations.core_tasks WHERE code = 'fetch_business_entity_verification'), 43);
