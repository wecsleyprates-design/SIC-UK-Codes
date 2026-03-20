-- Seed data
INSERT INTO "integrations"."core_categories" ("id", "code", "label") VALUES (7, 'business_entity_verification', 'Business Entity Verification') on conflict do nothing;

-- Seed data
INSERT INTO "integrations"."core_integrations_platforms" ("id", "code", "label", "category_id") VALUES (16, 'middesk', 'Middesk', 7) on conflict do nothing;

-- -- Seed data
INSERT INTO "integrations"."core_tasks" ("id", "code", "label") VALUES (12, 'fetch_business_entity_verification', 'Fetch Business Entity Verification');

-- -- Seed data
INSERT INTO "integrations"."rel_tasks_integrations" ("id", "task_category_id", "platform_id") VALUES (42, (SELECT id FROM integrations.core_tasks WHERE code = 'fetch_business_entity_verification'), (SELECT id FROM integrations.core_integrations_platforms WHERE code = 'middesk'));