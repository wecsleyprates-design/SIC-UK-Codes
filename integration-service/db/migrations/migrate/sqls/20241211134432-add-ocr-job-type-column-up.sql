-- Add job_id column to uploaded_statements table
ALTER TABLE integration_data.uploaded_ocr_documents
ADD COLUMN job_type TEXT;

-- Add index for job_id to improve query performance
CREATE INDEX idx_uploaded_ocr_documents_job_type ON integration_data.uploaded_ocr_documents(job_type);

-- Add comment to explain the new column
COMMENT ON COLUMN integration_data.uploaded_ocr_documents.job_type IS 'Stores the OCR job type for tracking processing status';

