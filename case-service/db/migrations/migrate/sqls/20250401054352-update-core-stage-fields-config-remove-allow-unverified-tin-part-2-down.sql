/* Replace with your SQL commands */
UPDATE onboarding_schema.data_customer_stage_fields_config
SET config = jsonb_set(
    config,
    '{fields}', 
    (
        SELECT jsonb_agg(
            CASE 
                WHEN field_data->>'name' = 'Tax ID Number/Employer Identification Number' 
                     AND field_data ? 'sub_fields'
                     AND field_index <> 0 THEN
                    field_data || jsonb_build_object(
                        'sub_fields',
                        (field_data->'sub_fields')::jsonb || jsonb_build_object(
                            'name', 'Allow Unverified TIN Submissions',
                            'status', false,
                            'description', 'When enabled, applicants are able to continue onboarding in cases where TIN verification is still occurring, but will be required to be verified prior to submission.',
                            'status_data_type', 'Checkbox'
                        )
                    )
                ELSE field_data
            END
        )
        FROM jsonb_array_elements(config->'fields') WITH ORDINALITY field(field_data, field_index)
    )
)
WHERE customer_stage_id IN (
    SELECT id
    FROM onboarding_schema.data_customer_onboarding_stages
    WHERE stage_code = 'company'
) AND config->'fields' IS NOT NULL;
