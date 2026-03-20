/* Replace with your SQL commands */
UPDATE core_configs
SET config = jsonb_set(
  config,
  '{categories,business_entity_verification,platforms}',
  (
    SELECT jsonb_agg(elem)
    FROM jsonb_array_elements(config->'categories'->'business_entity_verification'->'platforms') AS t(elem)
    WHERE elem->>'name' NOT IN ('worth_website_scanning', 'canada_open')
  )
)
WHERE code = 'score_config';

UPDATE data_customer_configs
SET config = jsonb_set(
  config,
  '{categories,business_entity_verification,platforms}',
  (
    SELECT jsonb_agg(elem)
    FROM jsonb_array_elements(config->'categories'->'business_entity_verification'->'platforms') AS t(elem)
    WHERE elem->>'name' NOT IN ('worth_website_scanning', 'canada_open')
  )
)
WHERE config_id = 1;
