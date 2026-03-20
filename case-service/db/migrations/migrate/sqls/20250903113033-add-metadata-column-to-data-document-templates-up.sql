-- Add new column with default empty tags array
ALTER TABLE esign.data_document_templates
ADD COLUMN metadata jsonb DEFAULT '{"tags":[]}'::jsonb NOT NULL;

-- Create GIN index for metadata queries
CREATE INDEX idx_data_document_templates_metadata_gin 
ON esign.data_document_templates 
USING gin (metadata jsonb_ops);