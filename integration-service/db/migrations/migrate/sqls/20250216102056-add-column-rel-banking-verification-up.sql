/* Replace with your SQL commands */
ALTER TABLE integrations.core_giact_response_codes
ALTER COLUMN response_code TYPE INTEGER USING response_code::INTEGER;

ALTER TABLE integration_data.rel_banking_verifications
ADD COLUMN meta jsonb NULL;