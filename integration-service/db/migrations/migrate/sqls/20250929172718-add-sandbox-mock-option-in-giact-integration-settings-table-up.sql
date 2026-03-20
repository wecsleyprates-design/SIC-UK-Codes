/* Add SANDBOX and MOCK options to gverify and gauthenticate integration settings */
UPDATE public.data_customer_integration_settings
SET settings = jsonb_set(
	jsonb_set(
		settings::jsonb,
		'{gverify,options}',
		jsonb_build_array('PRODUCTION', 'SANDBOX', 'DISABLE')
	),
	'{gauthenticate,options}',
	jsonb_build_array('PRODUCTION', 'SANDBOX', 'DISABLE')
)::jsonb;