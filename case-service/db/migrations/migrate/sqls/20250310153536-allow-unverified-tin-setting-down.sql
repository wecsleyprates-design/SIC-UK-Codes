/* Down migration to remove only the specific subfield */
UPDATE onboarding_schema.data_customer_stage_fields_config
SET config = jsonb_set(
        config,
        '{fields}',
        (
            SELECT jsonb_agg(
                CASE 
                    WHEN field->>'name' = 'Tax ID Number/Employer Identification Number'
                        AND field ? 'sub_fields' -- Ensure it has sub_fields to avoid errors
                        AND EXISTS (
                            SELECT 1 FROM jsonb_array_elements(field->'sub_fields') sub
                            WHERE sub->>'name' = 'Allow Unverified TIN Submissions'
                        ) -- Ensure the specific subfield exists, in case we have others to keep
                    THEN field || jsonb_build_object(
                        'sub_fields', (
                            SELECT jsonb_agg(sub)
                            FROM jsonb_array_elements(field->'sub_fields') sub
                            WHERE sub->>'name' != 'Allow Unverified TIN Submissions'
                        )
                    )
                    ELSE field
                END
            )
            FROM jsonb_array_elements(config->'fields') field
        )
    )
WHERE customer_stage_id IN (
    SELECT id
    FROM onboarding_schema.data_customer_onboarding_stages
    WHERE stage_code = 'company'
);
