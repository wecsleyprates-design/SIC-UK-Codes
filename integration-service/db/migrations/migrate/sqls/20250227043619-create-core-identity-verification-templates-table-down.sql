-- Drop the foreign key constraint fk_template_id from integration_data.identity_verification
ALTER TABLE integration_data.identity_verification 
DROP CONSTRAINT IF EXISTS fk_template_id;

-- Drop columns template_id and shareable_url from integration_data.identity_verification
ALTER TABLE integration_data.identity_verification
DROP COLUMN IF EXISTS template_id,
DROP COLUMN IF EXISTS shareable_url;

-- Drop table core_identity_verification_templates if it exists
DROP TABLE IF EXISTS integrations.core_identity_verification_templates;

-- Drop the enum type idv_template_steps_enum if it exists
DROP TYPE IF EXISTS idv_template_steps_enum;
DROP TYPE IF EXISTS platform_enum;

