-- table for business entity website data
CREATE TABLE IF NOT EXISTS integration_data.business_entity_website_data
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    business_integration_task_id uuid NOT NULL, -- foreign key referencing the business integration task
    business_id uuid NOT NULL,
    url varchar(255) NOT NULL,
    creation_date varchar(50) NOT NULL,
    expiration_date varchar(50) NOT NULL,
    category varchar(255) NOT NULL,
    category_url varchar(255) NOT NULL,
    category_text varchar(512) NOT NULL,
    category_image_link varchar(512) NOT NULL,
    meta jsonb NOT NULL,
    created_at timestamp NOT NULL DEFAULT now(),
    updated_at timestamp NOT NULL DEFAULT now(),
    CONSTRAINT pk_business_entity_website_data PRIMARY KEY (id),
    CONSTRAINT fk_business_integration_tasks_id_business_entity_website_data FOREIGN KEY (business_integration_task_id)
        REFERENCES integrations.data_business_integrations_tasks (id) MATCH SIMPLE
        ON UPDATE RESTRICT
        ON DELETE CASCADE, -- on deletion of the referenced record, delete this record as well
    CONSTRAINT unique_task_id_category UNIQUE(business_integration_task_id, category)
);


--- create new trigger to update the updated_at column
CREATE OR REPLACE TRIGGER update_business_entity_website_data_timestamp
    BEFORE UPDATE ON integration_data.business_entity_website_data
    FOR EACH ROW
EXECUTE PROCEDURE update_updated_at();


INSERT INTO integrations.core_tasks (id, code, label) 
VALUES (15,'fetch_business_entity_website_details', 'Fetch Business Entity Website Details') ON CONFLICT DO NOTHING;

INSERT INTO integrations.rel_tasks_integrations (id, task_category_id, platform_id) 
VALUES (47, 15, 16) ON CONFLICT DO NOTHING;

