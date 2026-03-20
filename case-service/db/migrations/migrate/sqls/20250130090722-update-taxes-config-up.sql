UPDATE onboarding_schema.core_stage_fields_config
SET config = jsonb_set(
    config, 
    '{fields}', 
    jsonb_build_array(jsonb_build_object(
        'name', 'IRS eSign',
        'status', false,
        'description', 'Save applicants time by gathering tax documents directly from the IRS with an eSignature.',
        'section_name', 'HOW DO YOU WANT APPLICANTS TO PROVIDE THEIR TAX INFORMATION?',
        'status_data_type', 'Toggle'
    )) || (config->'fields')
)
WHERE stage_id = 8;

UPDATE onboarding_schema.data_customer_stage_fields_config
SET config = jsonb_set(
        config, 
        '{fields}', 
        jsonb_build_array(jsonb_build_object(
            'name', 'IRS eSign',
            'status', false,
            'description', 'Save applicants time by gathering tax documents directly from the IRS with an eSignature.',
            'section_name', 'HOW DO YOU WANT APPLICANTS TO PROVIDE THEIR TAX INFORMATION?',
            'status_data_type', 'Toggle'
        )) || (config->'fields')
    )
WHERE customer_stage_id IN (
    SELECT id
    FROM onboarding_schema.data_customer_onboarding_stages
    WHERE stage_code = 'tax_consent'
);
