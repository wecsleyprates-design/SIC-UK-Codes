alter table onboarding_schema.data_custom_fields add column customer_access onboarding_schema.column_access not null default 'DEFAULT';

-- Add comment for field
comment on column onboarding_schema.data_custom_fields.customer_access is 'Level of access customer users have to this custom field';