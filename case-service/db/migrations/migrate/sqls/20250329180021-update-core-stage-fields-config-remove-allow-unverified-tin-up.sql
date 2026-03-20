-- Remove "Allow Unverified TIN Submission" subfield from core config table
UPDATE onboarding_schema.core_stage_fields_config
SET config = jsonb_set(
    config,
    '{fields,0,sub_fields}', 
    COALESCE(
        (
            SELECT jsonb_agg(elem)
            FROM jsonb_array_elements(config->'fields'->0->'sub_fields') elem
            WHERE elem->>'name' <> 'Allow Unverified TIN Submissions'
        ),
        '[]'::jsonb  -- Fallback to an empty array instead of NULL
    )
)
WHERE stage_id = 3 AND config->'fields'->0->'sub_fields' IS NOT NULL;

-- Remove "Allow Unverified TIN Submission" subfield from data customer config table
UPDATE onboarding_schema.data_customer_stage_fields_config
SET config = jsonb_set(
    config,
    '{fields,0,sub_fields}', 
    COALESCE(
        (
            SELECT jsonb_agg(elem)
            FROM jsonb_array_elements(config->'fields'->0->'sub_fields') elem
            WHERE elem->>'name' <> 'Allow Unverified TIN Submissions'
        ),
        '[]'::jsonb  -- Fallback to an empty array instead of NULL
    )
)
WHERE customer_stage_id IN (
    SELECT id
    FROM onboarding_schema.data_customer_onboarding_stages
    WHERE stage_code = 'company'
) AND config->'fields'->0->'sub_fields' IS NOT NULL;