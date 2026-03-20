/* Replace with your SQL commands */
UPDATE onboarding_schema.data_customer_stage_fields_config
SET config = jsonb_set(
    config,
    '{fields}', 
    (
        SELECT jsonb_agg(
            CASE 
                WHEN field->>'name' = 'Tax ID Number/Employer Identification Number' 
                     AND field ? 'sub_fields' THEN 
                    field || jsonb_build_object(
                        'sub_fields',
                        COALESCE(
                            (
                                SELECT jsonb_agg(sub_field)
                                FROM jsonb_array_elements(field->'sub_fields') sub_field
                                WHERE sub_field->>'name' <> 'Allow Unverified TIN Submissions'
                            ),
                            '[]'::jsonb
                        )
                    )
                ELSE field  -- Keep other fields unchanged
            END
        )
        FROM jsonb_array_elements(config->'fields') field
    )
)
WHERE customer_stage_id IN (
    SELECT id
    FROM onboarding_schema.data_customer_onboarding_stages
    WHERE stage_code = 'company'
) AND config->'fields' IS NOT NULL;
