/* Backfill SANDBOX option for any equifax integration settings created after the initial migration */
UPDATE public.data_customer_integration_settings
SET settings = jsonb_set(
    settings,
    '{equifax,options}',
    jsonb_build_array('PRODUCTION', 'SANDBOX', 'DISABLE')
)
WHERE settings ? 'equifax'
  AND NOT (settings->'equifax'->'options' @> '"SANDBOX"'::jsonb);