/* Remove `options` array from integration settings JSON */
UPDATE public.data_customer_integration_settings
SET settings = jsonb_build_object(
	'bjl', (settings->'bjl') - 'options',
	'equifax', (settings->'equifax') - 'options',
	'gverify', (settings->'gverify') - 'options',
	'gauthenticate', (settings->'gauthenticate') - 'options',
	'website', (settings->'website') - 'options',
	'npi', (settings->'npi') - 'options',
	'identity_verification', (settings->'identity_verification') - 'options',
	'adverse_media', (settings->'adverse_media') - 'options',
	'post_submission_editing', (settings->'post_submission_editing') - 'options'
);
