-- Add Trulioo PSC platform for deferrable PSC screening (watchlist checks on US business owners)
INSERT INTO "integrations"."core_integrations_platforms" ("id", "code", "label", "category_id")
VALUES (42, 'trulioo_psc', 'Trulioo PSC Screening', 7);

-- Add watchlist hits task
INSERT INTO "integrations"."core_tasks" ("id", "code", "label")
VALUES (25, 'fetch_watchlist_hits', 'Fetch Watchlist Hits');

-- Map the task to the platform
INSERT INTO "integrations"."rel_tasks_integrations" ("id", "task_category_id", "platform_id")
VALUES (82, (SELECT "id" FROM "integrations"."core_tasks" WHERE "code" = 'fetch_watchlist_hits'), 42);
