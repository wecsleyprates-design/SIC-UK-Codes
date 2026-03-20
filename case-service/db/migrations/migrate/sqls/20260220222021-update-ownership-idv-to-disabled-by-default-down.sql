-- Revert: "Disable Identity Verification" status to false, "Enable Identity Verification" status to true (IDV enabled by default)

UPDATE onboarding_schema.core_stage_fields_config
SET config = jsonb_set(
    config,
    '{fields}',
    (
        SELECT jsonb_agg(
            CASE
                WHEN field->>'name' = 'Disable Identity Verification'
                THEN field || jsonb_build_object('status', false)
                WHEN field->>'name' = 'Enable Identity Verification'
                THEN field || jsonb_build_object('status', true)
                ELSE field
            END
        )
        FROM jsonb_array_elements(config->'fields') AS field
    )
)
WHERE stage_id = 6;
