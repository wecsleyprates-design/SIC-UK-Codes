/* Replace with your SQL commands */
-- Drop foreign key constraint first
ALTER TABLE integration_data.uploaded_ocr_documents
DROP CONSTRAINT IF EXISTS fk_uploaded_ocr_documents_category_id;

-- Drop columns
ALTER TABLE integration_data.uploaded_ocr_documents
DROP COLUMN IF EXISTS category_id,
DROP COLUMN IF EXISTS case_id,
DROP COLUMN IF EXISTS is_confirmed;