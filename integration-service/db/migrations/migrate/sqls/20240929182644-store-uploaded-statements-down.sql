DROP INDEX IF EXISTS idx_uploaded_statements_business_id;

DROP TRIGGER IF EXISTS update_uploaded_statements_updated_at ON integration_data.uploaded_statements;

DROP TABLE IF EXISTS integration_data.uploaded_statements;