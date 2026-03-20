-- Create uploaded_statements table
CREATE TABLE IF NOT EXISTS integration_data.uploaded_statements (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id uuid NOT NULL,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    extracted_data JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT current_timestamp,
    updated_at TIMESTAMP NOT NULL DEFAULT current_timestamp
);

-- Create trigger for updating 'updated_at' column
CREATE OR REPLACE TRIGGER update_uploaded_statements_updated_at
BEFORE UPDATE ON integration_data.uploaded_statements
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

-- Add index for uploaded_statements table
CREATE INDEX idx_uploaded_statements_business_id ON integration_data.uploaded_statements(business_id);

-- Add comments to explain each table
COMMENT ON TABLE integration_data.uploaded_statements IS 'Stores uploaded statements for OCR processing';