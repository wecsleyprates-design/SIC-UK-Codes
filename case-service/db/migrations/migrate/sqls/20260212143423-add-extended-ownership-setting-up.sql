-- Add "Extended Ownership" to config.fields for Ownership stage

-- Update core template first
UPDATE onboarding_schema.core_stage_fields_config
SET config = jsonb_set(
    config,
    '{fields}',
    COALESCE(config->'fields', '[]'::jsonb) || jsonb_build_array(
        jsonb_build_object(
            'name', 'Extended Ownership',
            'status', false,
            'sub_fields', jsonb_build_array(
                jsonb_build_object(
                	'name', 'Max # of Total Owners', 
                	'status', '5', 
                	'description', '', 
                	'status_data_type', 'Textbox'), 
                jsonb_build_object(
                	'name', 'Max # of Control Persons', 
                	'status', '', 
                	'description', '', 
                	'status_data_type', 'Textbox'), 
                jsonb_build_object(
                	'name', 'Max # of Beneficial Owners', 
                	'status', '', 
                	'description', '', 
                	'status_data_type', 'Textbox')
            ),
            'description', 'Allow additional owners to be provided beyond the default 5 (one Control Person and up to 4 additional Beneficial Owners).',
            'section_name', 'Additional Settings',
            'status_data_type', 'Toggle'
        )
    )
)
WHERE stage_id = 6;

-- Update customer-specific configurations (preserving existing values)
UPDATE onboarding_schema.data_customer_stage_fields_config
SET config = jsonb_set(
    config,
    '{fields}',
    COALESCE(
        (
            SELECT jsonb_agg(setting)
            FROM jsonb_array_elements(config->'fields') AS setting
            WHERE setting->>'name' != 'Extended Ownership'  -- Avoid duplicates if re-run
        ),
        '[]'::jsonb
    ) || jsonb_build_array(
        jsonb_build_object(
            'name', 'Extended Ownership',
            'status', false,
            'sub_fields', jsonb_build_array(
                jsonb_build_object(
                	'name', 'Max # of Total Owners', 
                	'status', '5', 
                	'description', '', 
                	'status_data_type', 'Textbox'), 
                jsonb_build_object(
                	'name', 'Max # of Control Persons', 
                	'status', '', 
                	'description', '', 
                	'status_data_type', 'Textbox'), 
                jsonb_build_object(
                	'name', 'Max # of Beneficial Owners', 
                	'status', '', 
                	'description', '', 
                	'status_data_type', 'Textbox')
            ),
            'description', 'Allow additional owners to be provided beyond the default 5 (one Control Person and up to 4 additional Beneficial Owners).',
            'section_name', 'Additional Settings',
            'status_data_type', 'Toggle'
        )
    )
)
WHERE customer_stage_id IN (
    SELECT id FROM onboarding_schema.data_customer_onboarding_stages
    WHERE stage_code = 'ownership'
);
