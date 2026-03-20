/* Replace with your SQL commands */
UPDATE onboarding_schema.core_stage_fields_config
SET config = jsonb_set(
    config,
    '{fields,0,sub_fields}', 
    (
        SELECT jsonb_agg(elem)
        FROM (
            SELECT jsonb_array_elements(config->'fields'->0->'sub_fields') AS elem 
            UNION ALL
            SELECT '{"name": "Allow Unverified TIN Submissions", "status": false, "description": "When enabled, applicants are able to continue onboarding in cases where TIN verification is still occurring, but will be required to be verified prior to submission.", "status_data_type": "Checkbox"}'::jsonb
        ) AS sub_fields
    )
)
WHERE stage_id = 3 AND config->'fields'->0->'sub_fields' IS NOT NULL;

-- Rollback for data_customer_stage_fields_config
UPDATE onboarding_schema.data_customer_stage_fields_config
SET config = jsonb_set(
    config,
    '{fields,0,sub_fields}', 
    (
        SELECT jsonb_agg(elem)
        FROM (
            SELECT jsonb_array_elements(config->'fields'->0->'sub_fields') AS elem
            UNION ALL
            SELECT '{"name": "Allow Unverified TIN Submissions", "status": false, "description": "When enabled, applicants are able to continue onboarding in cases where TIN verification is still occurring, but will be required to be verified prior to submission.", "status_data_type": "Checkbox"}'::jsonb
        ) AS sub_fields
    )
)
WHERE customer_stage_id IN (
    SELECT id
    FROM onboarding_schema.data_customer_onboarding_stages
    WHERE stage_code = 'company'
) AND config->'fields'->0->'sub_fields' IS NOT NULL;
