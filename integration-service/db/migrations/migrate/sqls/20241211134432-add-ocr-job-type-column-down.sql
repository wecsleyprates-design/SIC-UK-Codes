ALTER TABLE integration_data.uploaded_ocr_documents
DROP COLUMN job_type;

DROP INDEX idx_uploaded_ocr_documents_job_type;
