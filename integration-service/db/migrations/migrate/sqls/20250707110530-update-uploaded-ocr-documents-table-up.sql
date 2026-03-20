/* Replace with your SQL commands */
-- Add columns
ALTER TABLE integration_data.uploaded_ocr_documents
ADD COLUMN category_id INT,
ADD COLUMN case_id UUID DEFAULT NULL,
ADD COLUMN is_confirmed BOOLEAN DEFAULT FALSE;
-- Add indexes
CREATE INDEX idx_uploaded_ocr_documents_category_id ON integration_data.uploaded_ocr_documents (category_id);
CREATE INDEX idx_uploaded_ocr_documents_case_id ON integration_data.uploaded_ocr_documents (case_id);

-- Add foreign key constraint
ALTER TABLE integration_data.uploaded_ocr_documents
ADD CONSTRAINT fk_uploaded_ocr_documents_category_id
FOREIGN KEY (category_id)
REFERENCES integrations.core_categories(id);