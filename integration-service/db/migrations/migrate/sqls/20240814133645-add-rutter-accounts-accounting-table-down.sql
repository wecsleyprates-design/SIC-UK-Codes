-- Delete the inserted rows from the integrations.rel_tasks_integrations table
DELETE FROM integrations.rel_tasks_integrations
WHERE task_category_id = 17
AND platform_id IN (5, 6, 7, 8, 9, 10, 11);

-- Delete the inserted row from the integrations.core_tasks table
DELETE FROM integrations.core_tasks
WHERE id = 17;

-- Drop the table integration_data.accounting_accounts
DROP TABLE IF EXISTS integration_data.accounting_accounts;
