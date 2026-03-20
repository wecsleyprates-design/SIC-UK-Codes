-- Remove the missing gVerify rows that were added.
DELETE FROM integrations.core_giact_response_codes
WHERE verification_type = 'gVerify' AND response_code IN (11, 13, 16, 17, 18, 20);

-- Remove the missing gAuthenticate rows that were added.
DELETE FROM integrations.core_giact_response_codes
WHERE verification_type = 'gAuthenticate' AND response_code IN (9, 10, 11, 12, 13, 14, 15, 16, 17);
