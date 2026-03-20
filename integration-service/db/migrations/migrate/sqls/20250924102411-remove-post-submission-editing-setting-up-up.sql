/* Remove `post_submission_editing` setting from customer integration settings */
UPDATE public.data_customer_integration_settings
SET settings = settings - 'post_submission_editing';