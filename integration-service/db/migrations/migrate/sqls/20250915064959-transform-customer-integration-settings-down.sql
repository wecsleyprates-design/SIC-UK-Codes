/* Optional rollback: collapse back to legacy booleans */
UPDATE public.data_customer_integration_settings
SET settings = jsonb_build_object(
	'isBJLEnabled', COALESCE((settings->'bjl'->>'status') = 'ACTIVE', false),
	'isGiactGverifyEnabled', COALESCE((settings->'gverify'->>'status') = 'ACTIVE', false),
	'isGiactGauthenticateEnabled', COALESCE((settings->'gauthenticate'->>'status') = 'ACTIVE', false),
	'isAdverseMediaEnabled', COALESCE((settings->'adverse_media'->>'status') = 'ACTIVE', false)
);