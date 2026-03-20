/* Replace with your SQL commands */
UPDATE core_configs
SET config = jsonb_set(
  config,
  '{categories,accounting,platforms}',
  (
    SELECT jsonb_agg(elem)
    FROM (
      SELECT elem
      FROM jsonb_array_elements(config->'categories'->'accounting'->'platforms') AS t(elem)
      WHERE elem->>'name' <> 'manual_accounting' -- Avoid duplicates
      UNION ALL
      SELECT jsonb_build_object('name', 'manual_accounting', 'required', false)
    ) AS combined
  )
)
WHERE code = 'score_config';


UPDATE data_customer_configs
SET config = jsonb_set(
  config,
  '{categories,accounting,platforms}',
  (
    SELECT jsonb_agg(elem)
    FROM (
      SELECT elem
      FROM jsonb_array_elements(config->'categories'->'accounting'->'platforms') AS t(elem)
      WHERE elem->>'name' <> 'manual_accounting' -- Avoid duplicates
      UNION ALL
      SELECT jsonb_build_object('name', 'manual_accounting', 'required', false)
    ) AS combined
  )
)
WHERE config_id = 1;