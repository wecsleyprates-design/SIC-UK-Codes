/* Replace with your SQL commands */
ALTER TABLE integration_data.rel_banking_verifications
DROP COLUMN IF EXISTS meta;

ALTER TABLE integrations.core_giact_response_codes
ALTER COLUMN response_code TYPE VARCHAR(50);