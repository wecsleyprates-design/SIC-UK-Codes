-- Remove Seed data
DELETE FROM integrations.rel_tasks_integrations WHERE id = 49;
DELETE FROM integrations.core_integrations_platforms WHERE code = 'serp_scrape';

-- Drop indexes for inferred_business_classifications table
DROP INDEX IF EXISTS integration_data.idx_inferred_business_classifications_sic_code;
DROP INDEX IF EXISTS integration_data.idx_inferred_business_classifications_naics_code;
DROP INDEX IF EXISTS integration_data.idx_inferred_business_classifications_serp_query_id;

-- Drop index for serialized_website_scrapes table
DROP INDEX IF EXISTS integration_data.idx_serialized_website_scrapes_serp_query_id;

-- Drop index for google_maps_serp_queries table
DROP INDEX IF EXISTS integration_data.idx_google_maps_serp_queries_business_id;

-- Drop tables
DROP TABLE IF EXISTS integration_data.inferred_business_classifications;
DROP TABLE IF EXISTS integration_data.serialized_website_scrapes;
DROP TABLE IF EXISTS integration_data.google_maps_serp_queries;