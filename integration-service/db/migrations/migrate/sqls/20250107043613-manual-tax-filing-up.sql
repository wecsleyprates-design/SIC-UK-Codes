INSERT INTO integrations.core_tasks(id, code, label) VALUES(18, 'manual_tax_filing', 'Manual Tax Filing');

INSERT INTO integrations.rel_tasks_integrations (id, task_category_id, platform_id) VALUES (59, 18, 21);