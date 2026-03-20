-- Add column to store S3 keys for identity document images
-- JSONB structure: { "front": "s3/key", "back": "s3/key", ... }

ALTER TABLE "integration_data"."identity_verification"
    ADD COLUMN IF NOT EXISTS document_s3_keys JSONB,
    ADD COLUMN IF NOT EXISTS documents_uploaded_at TIMESTAMPTZ;
