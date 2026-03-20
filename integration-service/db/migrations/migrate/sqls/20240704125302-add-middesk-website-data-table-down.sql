--- Delete middesk website details from rel_tasks_integrations
DELETE FROM integrations.rel_tasks_integrations 
WHERE id = 47;

--- Delete core task for middesk website details
DELETE FROM integrations.core_tasks 
WHERE code = 'fetch_business_entity_website_details';


-- Droping constraints first
ALTER TABLE integration_data.business_entity_website_data
DROP CONSTRAINT IF EXISTS unique_task_id_category;

ALTER TABLE integration_data.business_entity_website_data
DROP CONSTRAINT IF EXISTS fk_business_integration_tasks_id_business_entity_website_data;

ALTER TABLE integration_data.business_entity_website_data
DROP CONSTRAINT IF EXISTS pk_business_entity_website_data;

-- Droping table
DROP TABLE IF EXISTS integration_data.business_entity_website_data;

-- Droping trigger
DROP TRIGGER IF EXISTS update_business_entity_website_data_timestamp ON integration_data.business_entity_website_data;

