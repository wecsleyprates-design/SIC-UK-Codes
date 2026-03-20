ALTER TABLE "integration_data"."identity_verification"
    DROP COLUMN IF EXISTS document_s3_keys,
    DROP COLUMN IF EXISTS documents_uploaded_at;

