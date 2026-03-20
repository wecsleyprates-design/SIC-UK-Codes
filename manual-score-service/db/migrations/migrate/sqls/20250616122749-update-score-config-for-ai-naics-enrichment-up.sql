UPDATE core_configs
SET config = jsonb_set(
  config,
  '{categories,manual,platforms}',
  (
    SELECT jsonb_agg(elem)
    FROM (
      SELECT elem
      FROM jsonb_array_elements(config->'categories'->'manual'->'platforms') AS t(elem)
      WHERE elem->>'name' <> 'ai_naics_enrichment' -- Avoid duplicates
      UNION ALL
      SELECT jsonb_build_object('name', 'ai_naics_enrichment', 'required', false)
    ) AS combined
  )
)
WHERE code = 'score_config';
