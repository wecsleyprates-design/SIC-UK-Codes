/* Update the existing field to add the missing subfield */
UPDATE onboarding_schema.data_customer_stage_fields_config
SET config = jsonb_set(
        config,
        '{fields}',
        (
            SELECT jsonb_agg(
                CASE 
                    WHEN field->>'name' = 'Tax ID Number/Employer Identification Number'
                    THEN field || jsonb_build_object(
                        'sub_fields', jsonb_build_array(jsonb_build_object(
                            'name', 'Allow Unverified TIN Submissions',
                            'status', false,
                            'description', 'When enabled, applicants are able to continue onboarding in cases where TIN verification is still occurring, but will be required to be verified prior to submission.',
                            'status_data_type', 'Checkbox'
                        ))
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