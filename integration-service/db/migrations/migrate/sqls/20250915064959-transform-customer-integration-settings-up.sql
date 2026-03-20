/* Transform legacy boolean settings JSON into the new structured map. */
UPDATE public.data_customer_integration_settings
SET settings = jsonb_strip_nulls(jsonb_build_object(
	'bjl', jsonb_build_object(
		'status', CASE (settings->>'isBJLEnabled')::boolean WHEN true THEN 'ACTIVE' ELSE 'INACTIVE' END,
		'code', 'BJL',
		'label', 'Bankruptcies, Judgements, and Liens (BJL)',
		'description', 'Gather BJL records associated to the company and its owners.',
		'mode', 'PRODUCTION'
	),
	'equifax', jsonb_build_object(
		'status', 'INACTIVE',
		'code', 'EQUIFAX',
		'label', 'Personal Credit Reports',
		'description', 'View and download a company owners’ personal credit scores and reports.',
		'mode', 'PRODUCTION'
	),
	'gverify', jsonb_build_object(
		'status', CASE (settings->>'isGiactGverifyEnabled')::boolean WHEN true THEN 'ACTIVE' ELSE 'INACTIVE' END,
		'code', 'GIACT',
		'label', 'GIACT gVerify',
		'description', 'Enable integration to check if bank accounts are open, active, and in good standing.',
		'mode', 'PRODUCTION'
	),
	'gauthenticate', jsonb_build_object(
		'status', CASE (settings->>'isGiactGauthenticateEnabled')::boolean WHEN true THEN 'ACTIVE' ELSE 'INACTIVE' END,
		'code', 'GAUTHENTICATE',
		'label', 'GIACT gAuthenticate',
		'description', 'Enable integration to verify bank accounts belong to the company or owner of the company. Please note: gAuthenticate cannot run without Enhanced Bank Verification.',
		'mode', 'PRODUCTION'
	),
	'website', jsonb_build_object(
		'status', 'INACTIVE',
		'code', 'WEBSITE',
		'label', 'Website',
		'description', 'Run analysis on the company’s website and check its authenticity.',
		'mode', 'PRODUCTION'
	),
	'npi', jsonb_build_object(
		'status', 'INACTIVE',
		'code', 'NPI',
		'label', 'National Provider Identifier (NPI) Number',
		'description', 'Collect and verify the status of the primary doctor with a provided NPI number.',
		'mode', 'PRODUCTION'
	),
	'identity_verification', jsonb_build_object(
		'status', 'INACTIVE',
		'code', 'IDENTITY_VERIFICATION',
		'label', 'Identity Verification',
		'description', 'Verify the identity of each owner of the company.',
		'mode', 'PRODUCTION'
	),
	'adverse_media', jsonb_build_object(
		'status', CASE (settings->>'isAdverseMediaEnabled')::boolean WHEN true THEN 'ACTIVE' ELSE 'INACTIVE' END,
		'code', 'ADVERSE_MEDIA',
		'label', 'Adverse Media',
		'description', 'Gather media that can impact the health of the company.',
		'mode', 'PRODUCTION'
	),
	'post_submission_editing', jsonb_build_object(
		'status', 'INACTIVE',
		'code', 'POST_SUBMISSION_EDITING',
		'label', 'Post-Submission Editing',
		'description', 'Enable applicants to upload documents and edit applications after application has been submitted.',
		'mode', 'PRODUCTION'
	)
));
