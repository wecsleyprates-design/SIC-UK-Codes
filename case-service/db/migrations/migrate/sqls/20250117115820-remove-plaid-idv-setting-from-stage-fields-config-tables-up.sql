UPDATE onboarding_schema.core_stage_fields_config
SET config = jsonb_set(config, '{additional_settings}', '[]', false)
WHERE stage_id = 6;

UPDATE onboarding_schema.data_customer_stage_fields_config
SET config = jsonb_set(config, '{additional_settings}', '[]', false)
WHERE customer_stage_id IN (
  SELECT id
  FROM onboarding_schema.data_customer_onboarding_stages
  WHERE stage_code = 'ownership'
);
