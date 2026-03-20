CREATE TABLE
    IF NOT EXISTS integration_data.payment_processor_accounts (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
        platform_id INTEGER NOT NULL,
        business_id UUID NOT NULL,
        customer_id UUID NOT NULL,
        account_id VARCHAR(255) NOT NULL, -- This comes directly from the payment processor.
        profile_id UUID NOT NULL,
        account JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW (),
        updated_at TIMESTAMP DEFAULT NOW ()
    );

CREATE INDEX IF NOT EXISTS idx_processor_accounts_platform_id_customer_id ON integration_data.payment_processor_accounts (platform_id, customer_id);

CREATE INDEX IF NOT EXISTS idx_processor_accounts_business_id ON integration_data.payment_processor_accounts (business_id);

CREATE INDEX IF NOT EXISTS idx_processor_accounts_account_id ON integration_data.payment_processor_accounts (account_id);

CREATE INDEX IF NOT EXISTS idx_processor_accounts_profile_id ON integration_data.payment_processor_accounts (profile_id);

CREATE INDEX IF NOT EXISTS idx_processor_accounts_customer_id ON integration_data.payment_processor_accounts (customer_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_processor_accounts_platform_profile ON integration_data.payment_processor_accounts (platform_id, profile_id);

CREATE INDEX IF NOT EXISTS uq_processor_accounts_platform ON integration_data.payment_processor_accounts (platform_id, account_id);

CREATE TRIGGER update_processor_accounts_timestamp AFTER
UPDATE ON integration_data.payment_processor_accounts FOR EACH ROW EXECUTE PROCEDURE update_updated_at ();