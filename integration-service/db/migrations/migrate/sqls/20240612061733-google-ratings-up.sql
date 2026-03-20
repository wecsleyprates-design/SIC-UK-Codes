CREATE TABLE "integration_data"."business_ratings" (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_integration_task_id uuid NOT NULL,
    average_rating FLOAT NOT NULL,
    total_reviews INT NOT NULL,
    created_at TIMESTAMP DEFAULT current_timestamp NOT NULL,
    updated_at TIMESTAMP DEFAULT current_timestamp NOT NULL,
    CONSTRAINT "fk_business_integration_task_id" FOREIGN KEY (business_integration_task_id) REFERENCES integrations.data_business_integrations_tasks(id)
);

CREATE TRIGGER set_timestamp
BEFORE UPDATE ON integration_data.business_ratings 
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();