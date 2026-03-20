-- Add job_id column to uploaded_statements table
ALTER TABLE integration_data.uploaded_statements
ADD COLUMN job_id TEXT;

-- Add index for job_id to improve query performance
CREATE INDEX idx_uploaded_statements_job_id ON integration_data.uploaded_statements(job_id);

-- Add comment to explain the new column
COMMENT ON COLUMN integration_data.uploaded_statements.job_id IS 'Stores the OCR job identifier for tracking processing status';
