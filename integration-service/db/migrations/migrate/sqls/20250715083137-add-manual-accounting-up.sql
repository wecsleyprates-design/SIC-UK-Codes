INSERT INTO "integrations"."core_integrations_platforms" ("id", "code", "label", "category_id") VALUES (35, 'manual_accounting', 'Manual Accounting', 1);
-- link "manual" platform to "fetch_asset_data" task
INSERT INTO "integrations"."rel_tasks_integrations" ("id", "task_category_id", "platform_id") 
VALUES (70, (SELECT "id" FROM "integrations"."core_tasks" WHERE "code" = 'fetch_balance_sheet'), 35);

INSERT INTO "integrations"."rel_tasks_integrations" ("id", "task_category_id", "platform_id") 
VALUES (71, (SELECT "id" FROM "integrations"."core_tasks" WHERE "code" = 'fetch_profit_and_loss_statement'), 35);

INSERT INTO "integrations"."rel_tasks_integrations" ("id", "task_category_id", "platform_id") 
VALUES (72, (SELECT "id" FROM "integrations"."core_tasks" WHERE "code" = 'fetch_cash_flow'), 35);

INSERT INTO "integrations"."rel_tasks_integrations" ("id", "task_category_id", "platform_id") 
VALUES (73, (SELECT "id" FROM "integrations"."core_tasks" WHERE "code" = 'fetch_accounting_records'), 35);

INSERT INTO "integrations"."rel_tasks_integrations" ("id", "task_category_id", "platform_id") 
VALUES (74, (SELECT "id" FROM "integrations"."core_tasks" WHERE "code" = 'fetch_accounting_business_info'), 35);

INSERT INTO "integrations"."rel_tasks_integrations" ("id", "task_category_id", "platform_id") 
VALUES (75, (SELECT "id" FROM "integrations"."core_tasks" WHERE "code" = 'fetch_accounting_accounts'), 35);