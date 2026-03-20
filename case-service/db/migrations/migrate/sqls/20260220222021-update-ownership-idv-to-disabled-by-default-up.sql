-- Set "Disable Identity Verification" status to true and "Enable Identity Verification" status to false (IDV disabled by default)

UPDATE onboarding_schema.core_stage_fields_config
SET config = jsonb_set(
    config,
    '{fields}',
    (
        SELECT jsonb_agg(
            CASE
                WHEN field->>'name' = 'Disable Identity Verification'
                THEN field || jsonb_build_object('status', true)
                WHEN field->>'name' = 'Enable Identity Verification'
                THEN field || jsonb_build_object('status', false)
                ELSE field
            END
        )
        FROM jsonb_array_elements(config->'fields') AS field
    )
)
WHERE stage_id = 6;
