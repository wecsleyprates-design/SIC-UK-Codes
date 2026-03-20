UPDATE integrations.core_giact_response_codes
SET description = 'Savings Account Verified – The account was found to be an open and valid savings account.'
WHERE id = 3
AND verification_type = 'gVerify'
AND code = '_5555';