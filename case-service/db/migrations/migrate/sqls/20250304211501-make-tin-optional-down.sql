-- Make Tax ID just "Required" instead of "Always Required";
UPDATE onboarding_schema.core_stage_fields_config
SET config = jsonb_set(
  config,
  '{fields}',
  (
    SELECT jsonb_agg(
      CASE
        WHEN field->>'name' = 'Tax ID Number/Employer Identification Number' THEN
          jsonb_set(field, '{status}', '"Always Required"')
        ELSE
          field
      END
    )
    FROM jsonb_array_elements(config->'fields') AS field
  )
)
WHERE config->'fields' @> '[{"name": "Tax ID Number/Employer Identification Number"}]';

UPDATE onboarding_schema.data_customer_stage_fields_config
SET config = jsonb_set(
  config,
  '{fields}',
  (
    SELECT jsonb_agg(
      CASE
        WHEN field->>'name' = 'Tax ID Number/Employer Identification Number' THEN
          jsonb_set(field, '{status}', '"AlwaysRequired"')
        ELSE
          field
      END
    )
    FROM jsonb_array_elements(config->'fields') AS field
  )
)
WHERE config->'fields' @> '[{"name": "Tax ID Number/Employer Identification Number"}]';