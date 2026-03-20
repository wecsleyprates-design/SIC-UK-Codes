--- Add indexes on table to perform fast read & delete queries
--- We are facing deadlocks when deleting business data

CREATE INDEX IF NOT EXISTS idx_transactions_business_integrations_task 
ON integration_data.bank_account_transactions 
USING btree(business_integration_task_id ASC NULLS LAST)
TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_accounting_balancesheet_business_integrations_task 
ON integration_data.accounting_balancesheet 
USING btree(business_integration_task_id ASC NULLS LAST)
TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_accounting_incomestatement_business_integrations_task 
ON integration_data.accounting_incomestatement 
USING btree(business_integration_task_id ASC NULLS LAST)
TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_accounting_cashflow_business_integrations_task 
ON integration_data.accounting_cashflow 
USING btree(business_integration_task_id ASC NULLS LAST)
TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_tax_filings_business_integrations_task 
ON integration_data.tax_filings 
USING btree(business_integration_task_id ASC NULLS LAST)
TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_banking_balances_business_integrations_task 
ON integration_data.banking_balances 
USING btree(business_integration_task_id ASC NULLS LAST)
TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_bureau_credit_score_business_integrations_task 
ON integration_data.bureau_credit_score
USING btree(business_integration_task_id ASC NULLS LAST)
TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_identity_verification_business_integrations_task 
ON integration_data.identity_verification 
USING btree(business_integration_task_id ASC NULLS LAST)
TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_public_records_business_integrations_task 
ON integration_data.public_records
USING btree(business_integration_task_id ASC NULLS LAST)
TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_reviews_business_integrations_task 
ON integration_data.reviews 
USING btree(business_integration_task_id ASC NULLS LAST)
TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_business_score_trigger_id 
ON integrations.data_business_integrations_tasks 
USING btree(business_score_trigger_id ASC NULLS LAST)
TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_connection_id 
ON integrations.data_business_integrations_tasks 
USING btree(connection_id ASC NULLS LAST)
TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_business_task_events_business_integrations_task
ON integrations.business_integration_tasks_events 
USING btree(business_integration_task_id ASC NULLS LAST)
TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_business_id
ON integrations.business_score_triggers 
USING btree(business_id ASC NULLS LAST)
TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_cases_score_trigger_id 
ON data_cases
USING btree(score_trigger_id ASC NULLS LAST)
TABLESPACE pg_default;