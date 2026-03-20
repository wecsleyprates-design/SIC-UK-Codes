--- create reviews table
CREATE TABLE integration_data.reviews (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_integration_task_id uuid NOT NULL,
    review_id VARCHAR(30) DEFAULT NULL,
    star_rating INTEGER NOT NULL,
    text VARCHAR,
    review_datetime TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT current_timestamp,
    updated_at TIMESTAMP NOT NULL DEFAULT current_timestamp,
    CONSTRAINT "fk_business_integrations_tasks" FOREIGN KEY ("business_integration_task_id") REFERENCES "integrations"."data_business_integrations_tasks" ("id") ON DELETE CASCADE ON UPDATE RESTRICT
);

CREATE TRIGGER update_integration_data_reviews
    AFTER UPDATE
    ON
    integration_data.reviews
    FOR EACH ROW
EXECUTE PROCEDURE update_updated_at();

--Add google reviews to core_integration_platforms
INSERT INTO integrations.core_integrations_platforms
(id, code, label, category_id) 
VALUES (19, 'google_reviews', 'Google Reviews', 5);

INSERT INTO integrations.core_tasks (id,code,label) values(14,'fetch_google_reviews','Fetch reviews from google') on conflict do nothing;

INSERT INTO integrations.rel_tasks_integrations (id, task_category_id, platform_id) values (44,14,19) on conflict do nothing;