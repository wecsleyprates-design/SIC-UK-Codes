/* Replace with your SQL commands */
UPDATE onboarding_schema.data_customer_stage_fields_config
SET config = jsonb_set(
    config,
    '{fields}',
    to_jsonb(
        ARRAY(
            SELECT elem
            FROM jsonb_array_elements(config->'fields') AS elem
            WHERE elem->>'name' != 'Identity Verification'
        )
    )
)
WHERE customer_stage_id IN (SELECT id FROM onboarding_schema.data_customer_onboarding_stages WHERE stage_code = 'ownership');

UPDATE onboarding_schema.core_stage_fields_config
SET config = jsonb_set(
    config,
    '{fields}',
    to_jsonb(
        ARRAY(
            SELECT elem
            FROM jsonb_array_elements(config->'fields') AS elem
            WHERE elem->>'name' != 'Identity Verification'
        )
    )
)
WHERE id = 5;