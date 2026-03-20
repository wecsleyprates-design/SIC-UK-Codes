/* Replace with your SQL commands */
UPDATE core_configs
SET config = jsonb_set(
  config,
  '{categories,manual,platforms}',
  (
    SELECT jsonb_agg(elem)
    FROM jsonb_array_elements(config->'categories'->'manual'->'platforms') AS t(elem)
    WHERE elem->>'name' <> 'ai_sanitization'
  )
)
WHERE code = 'score_config';

UPDATE data_customer_configs
SET config = jsonb_set(
  config,
  '{categories,manual,platforms}',
  (
    SELECT jsonb_agg(elem)
    FROM jsonb_array_elements(config->'categories'->'manual'->'platforms') AS t(elem)
    WHERE elem->>'name' <> 'ai_sanitization'
  )
)
WHERE config_id = 1;
