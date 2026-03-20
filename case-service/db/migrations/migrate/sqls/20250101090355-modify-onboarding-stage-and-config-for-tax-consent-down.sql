
DO $$
BEGIN
    -- Migration Script to Update JSONB Column in core_stage_fields_config
    -- Update the config JSONB column based on the code condition
    UPDATE onboarding_schema.core_stage_fields_config
    SET config = '{
                "fields": [
                    {
                        "name": "Upload Documentation",
                        "status": "Required",
                        "description": "Gather business tax returns from the applicant",
                        "status_data_type": "Dropdown"
                    }
                ],
                "integrations": [
                    {
                        "name": "IRS",
                        "is_enabled": true,
                        "description": "When enabled, applicants can consent to provide their tax information directly from IRS."
                    }
                ],
                "additional_settings": [
                    {
                        "name": "Gather personal tax returns",
                        "is_enabled": true
                    }
                ]
            }'
    FROM onboarding_schema.core_onboarding_stages
    WHERE onboarding_schema.core_stage_fields_config.stage_id = onboarding_schema.core_onboarding_stages.id
      AND onboarding_schema.core_onboarding_stages.code = 'tax_consent';

    -- Migration Script to Update JSONB Column in data_customer_stage_fields_config
    -- Update the config JSONB column based on the stage_code condition
    UPDATE onboarding_schema.data_customer_stage_fields_config
    SET config = '{
                "fields": [
                    {
                        "name": "Upload Documentation",
                        "status": "Required",
                        "description": "Gather business tax returns from the applicant",
                        "status_data_type": "Dropdown"
                    }
                ],
                "integrations": [
                    {
                        "name": "IRS",
                        "is_enabled": true,
                        "description": "When enabled, applicants can consent to provide their tax information directly from IRS."
                    }
                ],
                "additional_settings": [
                    {
                        "name": "Gather personal tax returns",
                        "is_enabled": true
                    }
                ]
            }'
    FROM onboarding_schema.data_customer_onboarding_stages
    WHERE onboarding_schema.data_customer_stage_fields_config.customer_stage_id = onboarding_schema.data_customer_onboarding_stages.id
      AND onboarding_schema.data_customer_onboarding_stages.stage_code = 'tax_consent';


    -- Update the stage column in data_customer_onboarding_stages
    UPDATE onboarding_schema.data_customer_onboarding_stages
    SET stage = 'Taxes'
    WHERE stage_code = 'tax_consent';

    -- Update the stage column in core_onboarding_stages
    UPDATE onboarding_schema.core_onboarding_stages
    SET stage = 'Taxes'
    WHERE code = 'tax_consent';
END $$;