-- Drop the new constraint
ALTER TABLE integration_data.business_entity_website_data 
DROP CONSTRAINT unique_task_id_category_url;

-- Re-add the original constraint
ALTER TABLE integration_data.business_entity_website_data 
ADD CONSTRAINT unique_task_id_category 
UNIQUE (business_integration_task_id, category);