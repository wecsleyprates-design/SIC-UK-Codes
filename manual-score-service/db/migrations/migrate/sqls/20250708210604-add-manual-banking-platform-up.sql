/* Replace with your SQL commands */
UPDATE core_configs
SET config = jsonb_set(
  config,
  '{categories,banking,platforms}',
  (
    SELECT jsonb_agg(elem)
    FROM (
      SELECT elem
      FROM jsonb_array_elements(config->'categories'->'banking'->'platforms') AS t(elem)
      WHERE elem->>'name' <> 'manual_banking' -- Avoid duplicates
      UNION ALL
      SELECT jsonb_build_object('name', 'manual_banking', 'required', false)
    ) AS combined
  )
)
WHERE code = 'score_config';


UPDATE data_customer_configs
SET config = jsonb_set(
  config,
  '{categories,banking,platforms}',
  (
    SELECT jsonb_agg(elem)
    FROM (
      SELECT elem
      FROM jsonb_array_elements(config->'categories'->'banking'->'platforms') AS t(elem)
      WHERE elem->>'name' <> 'manual_banking' -- Avoid duplicates
      UNION ALL
      SELECT jsonb_build_object('name', 'manual_banking', 'required', false)
    ) AS combined
  )
)
WHERE config_id = 1;