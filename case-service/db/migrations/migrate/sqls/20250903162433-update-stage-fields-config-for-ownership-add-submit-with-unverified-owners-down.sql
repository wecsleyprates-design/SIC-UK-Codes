-- Remove "Submit with Unverified Identity" subfield from Enable Identity Verification

-- Remove from core template
UPDATE onboarding_schema.core_stage_fields_config
SET config = jsonb_set(
    config,
    '{fields}',
    (
        SELECT jsonb_agg(
            CASE
                WHEN field->>'name' = 'Enable Identity Verification'
                THEN field || jsonb_build_object(
                    'sub_fields', (
                        SELECT COALESCE(
                            jsonb_agg(sf),
                            '[]'::jsonb
                        )
                        FROM jsonb_array_elements(field->'sub_fields') AS sf
                        WHERE sf->>'name' != 'Submit with Unverified Identity'
                    )
                )
                ELSE field
            END
        )
        FROM jsonb_array_elements(config->'fields') AS field
    )
)
WHERE stage_id = 6;

-- Remove from customer-specific configurations (preserving other existing values)
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
                        -- Remove only the specific subfield, keep all others
                        SELECT COALESCE(
                            jsonb_agg(sf),
                            '[]'::jsonb
                        )
                        FROM jsonb_array_elements(field->'sub_fields') AS sf
                        WHERE sf->>'name' != 'Submit with Unverified Identity'
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
