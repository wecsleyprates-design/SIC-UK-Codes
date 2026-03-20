/* Replace with your SQL commands */
UPDATE onboarding_schema.core_stage_fields_config
SET config = jsonb_set(
    config,
    '{fields}',
    COALESCE(
        (config->'fields')::jsonb || '[{"name": "Identity Verification", "description": "We’ll verify and collect sensitive information including Social Security Number and Date of Birth. This data is encrypting using the highest industry standards.","status":true,"status_data_type":"Toggle","section_name":"IDENTITY"}]'::jsonb
    )
)
WHERE id = 5;

UPDATE onboarding_schema.data_customer_stage_fields_config
SET config = jsonb_set(
    config,
    '{fields}',
    COALESCE(
        (config->'fields')::jsonb || '[{"name": "Identity Verification", "description": "We’ll verify and collect sensitive information including Social Security Number and Date of Birth. This data is encrypting using the highest industry standards.","status":true,"status_data_type":"Toggle","section_name":"IDENTITY"}]'::jsonb
    )
)
WHERE customer_stage_id IN (SELECT id FROM onboarding_schema.data_customer_onboarding_stages WHERE stage_code = 'ownership');
