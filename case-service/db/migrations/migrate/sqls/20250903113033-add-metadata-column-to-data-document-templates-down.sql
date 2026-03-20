-- Drop the index first (otherwise Postgres will complain if the column is dropped first)
DROP INDEX IF EXISTS idx_data_document_templates_metadata_gin;

-- Remove the metadata column
ALTER TABLE esign.data_document_templates
DROP COLUMN IF EXISTS metadata;