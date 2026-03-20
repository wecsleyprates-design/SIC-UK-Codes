-- Remove "Extended Ownership" from config.fields for Ownership stage

-- Update core template
UPDATE onboarding_schema.core_stage_fields_config
SET config = jsonb_set(
    config,
    '{fields}',
    (
        SELECT jsonb_agg(setting)
        FROM jsonb_array_elements(config->'fields') AS setting
        WHERE setting->>'name' != 'Extended Ownership'
    )
)
WHERE stage_id = 6;

-- Update customer-specific configurations
UPDATE onboarding_schema.data_customer_stage_fields_config
SET config = jsonb_set(
    config,
    '{fields}',
    (
        SELECT jsonb_agg(setting)
        FROM jsonb_array_elements(config->'fields') AS setting
        WHERE setting->>'name' != 'Extended Ownership'
    )
)
WHERE customer_stage_id IN (
    SELECT id FROM onboarding_schema.data_customer_onboarding_stages
    WHERE stage_code = 'ownership'
);
