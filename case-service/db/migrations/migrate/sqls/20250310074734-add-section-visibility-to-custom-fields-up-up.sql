CREATE TYPE section_visibility AS ENUM (
  'Default',
  'Hidden'
);

--- Add column section_visibility as enum
ALTER TABLE IF EXISTS onboarding_schema.data_custom_fields ADD COLUMN section_visibility section_visibility NOT NULL DEFAULT 'Default';

--- Update existing csv sections as Default
UPDATE onboarding_schema.data_custom_fields SET section_visibility = 'Default'::section_visibility;
