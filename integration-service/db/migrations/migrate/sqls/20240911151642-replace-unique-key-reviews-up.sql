-- Remove existing unique constraint on review_id
ALTER TABLE integration_data.reviews
DROP CONSTRAINT IF EXISTS unique_review_id;

-- Add a new unique constraint on review_id and business_integration_task_id
ALTER TABLE integration_data.reviews
ADD CONSTRAINT unique_review_and_task UNIQUE (review_id, business_integration_task_id);
