/* Add `options` array to integration settings JSON */
UPDATE public.data_customer_integration_settings
SET settings = jsonb_build_object(
	'bjl', (settings->'bjl') || jsonb_build_object(
		'options', jsonb_build_array('PRODUCTION', 'DISABLE')
	),
	'equifax', (settings->'equifax') || jsonb_build_object(
		'options', jsonb_build_array('PRODUCTION', 'DISABLE')
	),
	'gverify', (settings->'gverify') || jsonb_build_object(
		'options', jsonb_build_array('PRODUCTION', 'DISABLE')
	),
	'gauthenticate', (settings->'gauthenticate') || jsonb_build_object(
		'options', jsonb_build_array('PRODUCTION', 'DISABLE')
	),
	'website', (settings->'website') || jsonb_build_object(
		'options', jsonb_build_array('PRODUCTION', 'DISABLE')
	),
	'npi', (settings->'npi') || jsonb_build_object(
		'options', jsonb_build_array('PRODUCTION', 'DISABLE')
	),
	'identity_verification', (settings->'identity_verification') || jsonb_build_object(
		'options', jsonb_build_array('PRODUCTION', 'DISABLE')
	),
	'adverse_media', (settings->'adverse_media') || jsonb_build_object(
		'options', jsonb_build_array('PRODUCTION', 'DISABLE')
	),
	'post_submission_editing', (settings->'post_submission_editing') || jsonb_build_object(
		'options', jsonb_build_array('PRODUCTION', 'DISABLE')
	)
);
