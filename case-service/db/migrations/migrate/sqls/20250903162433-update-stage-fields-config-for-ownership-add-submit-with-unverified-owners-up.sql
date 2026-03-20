-- Add "Submit with Unverified Identity" subfield to Enable Identity Verification

-- Update core template first
UPDATE onboarding_schema.core_stage_fields_config
SET config = jsonb_set(
    config,
    '{fields}',
    (
        SELECT jsonb_agg(
            CASE
                WHEN field->>'name' = 'Enable Identity Verification'
                THEN field || jsonb_build_object(
                    'sub_fields', 
                    COALESCE(field->'sub_fields', '[]'::jsonb) || jsonb_build_array(
                        jsonb_build_object(
                            'name', 'Submit with Unverified Identity',
                            'status', false,
                            'description', 'When enabled, applicants will be able to submit their applications in case Identity Verification fails for any reason.',
                            'status_data_type', 'Toggle'
                        )
                    )
                )
                ELSE field
            END
        )
        FROM jsonb_array_elements(config->'fields') AS field
    )
)
WHERE stage_id = 6;

-- Update customer-specific configurations (preserving existing values)
UPDATE onboarding_schema.data_customer_stage_fields_config
SET config = jsonb_set(
    config,
    '{fields}',
    (
        SELECT jsonb_agg(
            CASE
                WHEN field->>'name' = 'Enable Identity Verification'
                THEN jsonb_build_object(
                    'name', 'Enable Identity Verification',
                    'status', field->'status',  -- Preserve existing status
                    'description', field->'description',  -- Preserve existing description  
                    'section_name', field->'section_name',  -- Preserve existing section
                    'status_data_type', field->'status_data_type',  -- Preserve existing data type
                    'sub_fields', (
                        -- Preserve existing sub_fields and add new one
                        SELECT COALESCE(
                            (
                                SELECT jsonb_agg(sf)
                                FROM jsonb_array_elements(field->'sub_fields') AS sf
                                WHERE sf->>'name' != 'Submit with Unverified Identity'  -- Avoid duplicates if re-run
                            ),
                            '[]'::jsonb
                        ) || jsonb_build_array(
                            jsonb_build_object(
                                'name', 'Submit with Unverified Identity',
                                'status', false,
                                'description', 'When enabled, applicants will be able to submit their applications in case Identity Verification fails for any reason.',
                                'status_data_type', 'Toggle'
                            )
                        )
                    )
                )
                ELSE field  -- Keep all other fields unchanged
            END
        )
        FROM jsonb_array_elements(config->'fields') AS field
    )
)
WHERE customer_stage_id IN (
    SELECT id FROM onboarding_schema.data_customer_onboarding_stages 
    WHERE stage_code = 'ownership'
);
