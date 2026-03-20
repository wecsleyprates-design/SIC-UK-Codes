/* Add SANDBOX option to identity_verification integration settings */
UPDATE public.data_customer_integration_settings
SET settings = jsonb_set(
    settings,
    '{identity_verification,options}',
    jsonb_build_array('PRODUCTION', 'SANDBOX', 'DISABLE')
)
WHERE settings ? 'identity_verification';