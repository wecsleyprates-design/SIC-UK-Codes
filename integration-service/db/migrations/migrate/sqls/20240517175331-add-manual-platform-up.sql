insert into integrations.core_tasks (id, code, label) values(16, 'manual', 'Manual Data Upload');
insert into integrations.core_categories (id, code, label) values(9, 'manual', 'Manual Data Upload');
insert into integrations.core_integrations_platforms (id, code, label, category_id) values(21, 'manual', 'Manual', 9);
insert into integrations.rel_tasks_integrations (id, task_category_id, platform_id) values(48, 16, 21);
