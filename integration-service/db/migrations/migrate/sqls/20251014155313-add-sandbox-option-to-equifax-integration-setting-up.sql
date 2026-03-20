/* Add SANDBOX option to equifax integration settings */
UPDATE public.data_customer_integration_settings
SET settings = jsonb_set(
    settings,
    '{equifax,options}',
    jsonb_build_array('PRODUCTION', 'SANDBOX', 'DISABLE')
)
WHERE settings ? 'equifax';