--- Drop column section_visibility
ALTER TABLE IF EXISTS onboarding_schema.data_custom_fields DROP COLUMN section_visibility;

--- Drop type section_visibility
DROP TYPE IF EXISTS section_visibility;