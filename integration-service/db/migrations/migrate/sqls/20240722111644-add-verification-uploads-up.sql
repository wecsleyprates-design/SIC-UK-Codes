
CREATE TABLE IF NOT EXISTS integration_data.business_entity_verification_uploads (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    business_id uuid NOT NULL,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL
);