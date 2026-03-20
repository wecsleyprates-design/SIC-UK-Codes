-- Drop the existing constraint
ALTER TABLE integration_data.business_entity_website_data 
DROP CONSTRAINT unique_task_id_category;

-- Add new constraint that includes category_url
ALTER TABLE integration_data.business_entity_website_data 
ADD CONSTRAINT unique_task_id_category_url 
UNIQUE (business_integration_task_id, category, category_url);