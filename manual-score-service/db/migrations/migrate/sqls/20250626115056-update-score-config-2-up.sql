UPDATE core_configs
SET config = jsonb_set(
  config,
  '{categories,business_entity_verification,platforms}',
  (
    SELECT jsonb_agg(elem)
    FROM (
      -- Keep existing elements excluding the ones to be added
      SELECT elem
      FROM jsonb_array_elements(config->'categories'->'business_entity_verification'->'platforms') AS t(elem)
      WHERE elem->>'name' NOT IN ('worth_website_scanning', 'canada_open')
      
      UNION ALL

      -- Add new elements
      SELECT jsonb_build_object('name', 'worth_website_scanning', 'required', false)
      UNION ALL
      SELECT jsonb_build_object('name', 'canada_open', 'required', false)
    ) AS combined
  )
)
WHERE code = 'score_config';

UPDATE data_customer_configs
SET config = jsonb_set(
  config,
  '{categories,business_entity_verification,platforms}',
  (
    SELECT jsonb_agg(elem)
    FROM (
      -- Keep existing elements excluding the ones to be added
      SELECT elem
      FROM jsonb_array_elements(config->'categories'->'business_entity_verification'->'platforms') AS t(elem)
      WHERE elem->>'name' NOT IN ('worth_website_scanning', 'canada_open')
      
      UNION ALL

      -- Add new elements
      SELECT jsonb_build_object('name', 'worth_website_scanning', 'required', false)
      UNION ALL
      SELECT jsonb_build_object('name', 'canada_open', 'required', false)
    ) AS combined
  )
)
WHERE config_id = 1;