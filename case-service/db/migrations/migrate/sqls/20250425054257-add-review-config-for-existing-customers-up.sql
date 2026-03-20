-- Step 1: Update stage name to 'Review & eSign' for each customer_id where stage_code = 'review'
UPDATE onboarding_schema.data_customer_onboarding_stages
SET stage = 'Review & eSign'
WHERE stage_code = 'review';

-- Step 2: Insert MPA config for each updated customer stage (if not already exists)
INSERT INTO onboarding_schema.data_customer_stage_fields_config (customer_stage_id, customer_id, config)
SELECT
    dcos.id,
    dcos.customer_id,
    jsonb_build_object(
        'fields', jsonb_build_array(
            jsonb_build_object(
                'name', 'Merchant Processing Agreement (MPA)',
                'status', false,
                'description', 'When enabled, the applicant will be required to eSign an MPA prior to submitting their application.',
                'section_name', 'eSign',
                'status_data_type', 'Toggle',
                'sub_fields', jsonb_build_array(
                    jsonb_build_object(
                        'name', 'Template',
                        'status', false,
                        'status_data_type', 'Template'
                    )
                )
            )
        )
    )
FROM onboarding_schema.data_customer_onboarding_stages dcos
WHERE dcos.stage_code = 'review';