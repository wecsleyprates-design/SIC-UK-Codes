/* Rollback: Remove SANDBOX option from identity_verification integration settings */
UPDATE public.data_customer_integration_settings
SET settings = jsonb_set(
    settings,
    '{identity_verification,options}',
    jsonb_build_array('PRODUCTION', 'DISABLE')
)
WHERE settings ? 'identity_verification';