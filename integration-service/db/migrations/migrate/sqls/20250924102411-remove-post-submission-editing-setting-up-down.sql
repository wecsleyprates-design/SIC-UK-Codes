/* Rollback: Add back `post_submission_editing` setting to customer integration settings */
UPDATE public.data_customer_integration_settings
SET settings = settings || jsonb_build_object(
	'post_submission_editing', jsonb_build_object(
		'status', 'INACTIVE',
		'code', 'POST_SUBMISSION_EDITING',
		'label', 'Post-Submission Editing',
		'description', 'Enable applicants to upload documents and edit applications after application has been submitted.',
		'mode', 'PRODUCTION',
		'options', jsonb_build_array('PRODUCTION', 'DISABLE')
	)
);