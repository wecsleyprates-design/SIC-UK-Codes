-- Drop data_integrations
ALTER TABLE data_integrations DROP CONSTRAINT IF EXISTS unique_business_integration;
ALTER TABLE data_integrations DROP CONSTRAINT IF EXISTS integration_id_fk;
DROP TABLE IF EXISTS data_integrations;

-- Drop core_integrations
ALTER TABLE core_integrations DROP CONSTRAINT IF EXISTS category_id_fk;
DROP TABLE IF EXISTS core_integrations;

-- Drop core_integration_categories
DROP TABLE IF EXISTS core_integration_categories;

-- Drop functions
DROP FUNCTION IF EXISTS trigger_set_timestamp();

-- Drop enum
DROP TYPE IF EXISTS integration_status;

