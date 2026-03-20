/* Replace with your SQL commands */
DROP TABLE IF EXISTS integration_data.accounting_incomestatement;
DROP TABLE IF EXISTS integration_data.accounting_balancesheet;
DROP TABLE IF EXISTS integration_data.accounting_cashflow;
DROP TABLE IF EXISTS integration_data.request_response;
DROP TABLE IF EXISTS integration_data.accounting_business_info;
DROP TABLE IF EXISTS integration_data.accounting_pandl;

DROP INDEX IF EXISTS integrations.idx_connections_access_token;
DROP INDEX IF EXISTS integrations.idx_connections_connection_id;

ALTER TABLE integrations.data_business_integrations_tasks ALTER column ID drop default;
ALTER TABLE integrations.business_integration_tasks_events ALTER column ID drop default;
ALTER TABLE integrations.data_connections_history ALTER column ID drop default;

DELETE FROM integrations.rel_tasks_integrations where platform_id between 5 and 14;

DELETE FROM integrations.core_tasks where id between 5 and 9;
DELETE from integrations.core_integrations_platforms where id between 5 and 14;
DELETE FROM integrations.core_categories where id=6 and code = 'commerce';


