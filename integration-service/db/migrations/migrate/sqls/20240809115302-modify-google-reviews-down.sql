-- Remove unique constraint from review_id
ALTER TABLE integration_data.reviews
DROP CONSTRAINT IF EXISTS unique_review_id;

-- Remove metadata column
ALTER TABLE integration_data.reviews
DROP COLUMN metadata;

-- Change review_id back to VARCHAR(30)
ALTER TABLE integration_data.reviews
ALTER COLUMN review_id TYPE VARCHAR(30);

-- Remove the comment
COMMENT ON TABLE integration_data.reviews IS NULL;