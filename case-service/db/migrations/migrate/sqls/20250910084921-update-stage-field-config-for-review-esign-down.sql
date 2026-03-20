-- Revert core_stage_fields_config
UPDATE onboarding_schema.core_stage_fields_config
SET config = jsonb_set(
              config::jsonb,
              '{fields}',
              (
                SELECT jsonb_agg(
                  CASE
                    WHEN field->>'name' = 'eSign Documents'
                    THEN jsonb_set(
                           jsonb_set(field, '{name}', '"Merchant Processing Agreement (MPA)"'),
                           '{description}', '"When enabled, the applicant will be required to eSign an MPA prior to submitting their application."'
                         )
                    ELSE field
                  END
                )
                FROM jsonb_array_elements(config->'fields') field
              )
            )
WHERE stage_id = 11;

-- Revert customer stage configs linked to "review" stage
UPDATE onboarding_schema.data_customer_stage_fields_config
SET config = jsonb_set(
              config::jsonb,
              '{fields}',
              (
                SELECT jsonb_agg(
                  CASE
                    WHEN field->>'name' = 'eSign Documents'
                    THEN jsonb_set(
                           jsonb_set(field, '{name}', '"Merchant Processing Agreement (MPA)"'),
                           '{description}', '"When enabled, the applicant will be required to eSign an MPA prior to submitting their application."'
                         )
                    ELSE field
                  END
                )
                FROM jsonb_array_elements(config->'fields') field
              )
            )
WHERE customer_stage_id IN (
  SELECT id FROM onboarding_schema.data_customer_onboarding_stages WHERE stage_code = 'review'
);