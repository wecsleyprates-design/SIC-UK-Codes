-- Alter review_id column to TEXT
ALTER TABLE integration_data.reviews
ALTER COLUMN review_id TYPE TEXT;

-- Add metadata column
ALTER TABLE integration_data.reviews
ADD COLUMN metadata JSONB;

-- Add unique constraint to review_id
ALTER TABLE integration_data.reviews
ADD CONSTRAINT unique_review_id UNIQUE (review_id);

-- Comment explaining the changes
COMMENT ON TABLE integration_data.reviews IS 'Table for storing review data. review_id is now TEXT to accommodate various formats, has a unique constraint, and metadata column added for additional flexible data storage.';