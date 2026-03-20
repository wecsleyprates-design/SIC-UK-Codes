ALTER TABLE integration_data.uploaded_statements
DROP COLUMN job_id;

DROP INDEX idx_uploaded_statements_job_id;
