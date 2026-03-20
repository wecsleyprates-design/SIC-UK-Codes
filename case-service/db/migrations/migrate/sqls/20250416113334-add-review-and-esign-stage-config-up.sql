-- Up Migration: Insert row or update existing row with stage_id = 11
INSERT INTO onboarding_schema.core_stage_fields_config (id, stage_id, config)
VALUES
(
    11,
    11,
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
);
