UPDATE onboarding_schema.data_customer_stage_fields_config
SET config = jsonb_set(
    config,
    '{fields}',
    (SELECT jsonb_agg(elem)
        FROM jsonb_array_elements(config->'fields') elem
        WHERE (elem->>'name') <> 'IRS eSign')
)
WHERE customer_stage_id IN (
    SELECT id
    FROM onboarding_schema.data_customer_onboarding_stages
    WHERE stage_code = 'tax_consent'
);


UPDATE onboarding_schema.core_stage_fields_config
SET config = jsonb_set(
    config,
    '{fields}',
    (SELECT jsonb_agg(elem)
    FROM jsonb_array_elements(config->'fields') elem
    WHERE (elem->>'name') <> 'IRS eSign')
)
WHERE stage_id = 8;
