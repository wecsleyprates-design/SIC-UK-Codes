-- Create the enum type for verification_status
CREATE TYPE verification_status_enum AS ENUM ('CREATED', 'INITIALIZED', 'IN_PROGRESS', 'SUCCESS', 'FAILED', 'ERRORED');

-- Create the table rel_banking_verifications
CREATE TABLE integration_data.rel_banking_verifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    bank_account_id uuid NOT NULL,
    case_id uuid NOT NULL,
    giact_verify_response_code_id integer,
    giact_authenticate_response_code_id integer,
    verification_status verification_status_enum NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_bank_account
        FOREIGN KEY (bank_account_id)
        REFERENCES integration_data.bank_accounts(id),
    CONSTRAINT fk_giact_verify
        FOREIGN KEY (giact_verify_response_code_id)
        REFERENCES integrations.core_giact_response_codes(id),
    CONSTRAINT fk_giact_authenticate
        FOREIGN KEY (giact_authenticate_response_code_id)
    REFERENCES integrations.core_giact_response_codes(id)
);
