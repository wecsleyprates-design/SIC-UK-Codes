/* Replace with your SQL commands */

ALTER TABLE onboarding_schema.data_field_options
ADD COLUMN checkbox_type VARCHAR(255);

ALTER TABLE onboarding_schema.data_field_options
ADD COLUMN input_type VARCHAR(255);

ALTER TABLE onboarding_schema.data_field_options
ADD COLUMN icon VARCHAR(255);

ALTER TABLE onboarding_schema.data_field_options
ADD COLUMN icon_position VARCHAR(255);