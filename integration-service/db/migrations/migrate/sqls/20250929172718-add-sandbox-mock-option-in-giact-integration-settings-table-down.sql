/* Rollback: Remove SANDBOX and MOCK options from gverify and gauthenticate integration settings */
UPDATE public.data_customer_integration_settings
SET settings = jsonb_set(
	jsonb_set(
		settings::jsonb,
		'{gverify,options}',
		jsonb_build_array('PRODUCTION', 'DISABLE')
	),
	'{gauthenticate,options}',
	jsonb_build_array('PRODUCTION', 'DISABLE')
)::jsonb;