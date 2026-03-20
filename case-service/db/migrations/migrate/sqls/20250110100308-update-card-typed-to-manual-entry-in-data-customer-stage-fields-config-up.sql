UPDATE onboarding_schema.data_customer_stage_fields_config
SET config = jsonb_set(
  config,
  '{fields}',
  (
    SELECT jsonb_agg(
             CASE
               WHEN field->>'name' = 'Card (Typed)' THEN
                 field || jsonb_build_object('name', 'Card (Keyed)')
               ELSE
                 field
             END
           )
    FROM jsonb_array_elements(config->'fields') AS field
  )
)
WHERE customer_stage_id IN (
  SELECT id
  FROM onboarding_schema.data_customer_onboarding_stages
  WHERE stage_code = 'processing_history'
);
