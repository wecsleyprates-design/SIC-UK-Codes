UPDATE core_configs
SET config = jsonb_set(
  config,
  '{categories,manual,platforms}',
  (
    SELECT jsonb_agg(elem)
    FROM jsonb_array_elements(config->'categories'->'manual'->'platforms') AS t(elem)
    WHERE elem->>'name' <> 'ai_naics_enrichment'
  )
)
WHERE code = 'score_config';
