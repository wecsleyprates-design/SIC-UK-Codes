create type onboarding_schema.column_access as enum ('DEFAULT', 'HIDDEN', 'READ_ONLY', 'READ_WRITE','WRITE_ONLY');

alter table onboarding_schema.data_custom_fields add column applicant_access onboarding_schema.column_access not null default 'DEFAULT';
-- Add comment for field
comment on column onboarding_schema.data_custom_fields.applicant_access is 'Level of access applicants have to this custom field';