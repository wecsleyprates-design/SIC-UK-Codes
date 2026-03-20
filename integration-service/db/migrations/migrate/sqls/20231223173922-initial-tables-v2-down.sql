-- Drop table banking_balances
ALTER TABLE integration_data.banking_balances DROP CONSTRAINT IF EXISTS "fk_bank_accounts";
ALTER TABLE integration_data.banking_balances DROP CONSTRAINT IF EXISTS "fk_integration_tasks_balances";
DROP TABLE IF EXISTS integration_data.banking_balances;

-- Drop table integration_data.bank_account_transactions
ALTER TABLE integration_data.bank_account_transactions DROP CONSTRAINT IF EXISTS fk_bank_accounts;
ALTER TABLE integration_data.bank_account_transactions DROP CONSTRAINT IF EXISTS fk_integration_tasks_transactions;
DROP TABLE IF EXISTS integration_data.bank_account_transactions;

-- Drop table integration_data.bank_accounts
ALTER TABLE integration_data.bank_accounts DROP CONSTRAINT IF EXISTS fk_business_integration_tasks_bank_accounts;
DROP TABLE IF EXISTS integration_data.bank_accounts;

-- Drop the account_type enum
DROP TYPE IF EXISTS account_type;

-- Drop the table integration_data.identity_verification
ALTER TABLE integration_data.identity_verification DROP CONSTRAINT IF EXISTS fk_business_integration_tasks_id_verification;
DROP TABLE IF EXISTS integration_data.identity_verification;

-- Drop the table integrations.business_integration_tasks_events
ALTER TABLE integrations.business_integration_tasks_events DROP CONSTRAINT IF EXISTS fk_business_integrations_tasks;
DROP TABLE integrations.business_integration_tasks_events;

-- Drop the table integrations.data_business_integrations_tasks
ALTER TABLE integrations.data_business_integrations_tasks DROP CONSTRAINT IF EXISTS fk_business_integrations;
ALTER TABLE integrations.data_business_integrations_tasks DROP CONSTRAINT IF EXISTS fk_business_score_trigger;
ALTER TABLE integrations.data_business_integrations_tasks DROP CONSTRAINT IF EXISTS fk_integrations_tasks;
DROP TABLE IF EXISTS integrations.data_business_integrations_tasks;

-- Drop the enum integrations.integration_task_status
DROP TYPE IF EXISTS integrations.integration_task_status;

-- Drop the table data_cases
DROP TABLE IF EXISTS data_cases;

-- Drop the table integrations.business_score_triggers
DROP TABLE IF EXISTS integrations.business_score_triggers;

-- Drop the enum integrations.score_trigger
DROP TYPE IF EXISTS integrations.score_trigger;

-- Drop the table integrations.data_connections_history
ALTER TABLE integrations.data_connections_history DROP CONSTRAINT IF EXISTS fk_integrations_connections_history;
DROP TABLE IF EXISTS integrations.data_connections_history;

-- Drop the table integrations.data_connections
ALTER TABLE integrations.data_connections DROP CONSTRAINT IF EXISTS fk_integrations_connections;
DROP TABLE IF EXISTS integrations.data_connections;

-- Drop the enum integrations.connection_status
DROP TYPE IF EXISTS integrations.connection_status;

-- Drop the table integrations.rel_tasks_integrations
ALTER TABLE integrations.rel_tasks_integrations DROP CONSTRAINT IF EXISTS fk_tasks_category;
ALTER TABLE integrations.rel_tasks_integrations DROP CONSTRAINT IF EXISTS fk_integrations_variants;
DROP TABLE IF EXISTS integrations.rel_tasks_integrations;

-- Drop the table integrations.core_tasks
DROP TABLE IF EXISTS integrations.core_tasks;

-- Drop the table integrations.core_integrations_platforms
ALTER TABLE integrations.core_integrations_platforms DROP CONSTRAINT IF EXISTS fk_integration_category;
DROP TABLE IF EXISTS integrations.core_integrations_platforms;

-- Drop the table integrations.core_categories
DROP TABLE IF EXISTS integrations.core_categories;

-- Drop function update_updated_at
DROP FUNCTION IF EXISTS update_updated_at;

-- Drop schema integrations
DROP SCHEMA integrations;

-- Drop schema integrations
DROP SCHEMA integration_data;


