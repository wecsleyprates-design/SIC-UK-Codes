/* Replace with your SQL commands */
UPDATE onboarding_schema.data_customer_stage_fields_config
SET config = jsonb_set(
        config,
        '{fields}',
        (config->'fields') || jsonb_build_array(jsonb_build_object(
            'name', 'Primary Provider’s NPI Number*',
            'status', 'Optional',
            'description', 'NPI (National Provider Identifier) is a unique 10-digit identification number assigned to healthcare providers in the United States by the Centers for Medicare & Medicaid Services (CMS). When enabled, we’ll collect and verify the status of the provided NPI number.',
            'status_data_type', 'Dropdown'
        ))
    )
WHERE customer_stage_id IN (
    SELECT id
    FROM onboarding_schema.data_customer_onboarding_stages
    WHERE stage_code = 'company'
);
