DROP INDEX IF EXISTS integration_data.uq_processor_accounts_platform_profile;

CREATE UNIQUE INDEX uq_processor_accounts_platform_profile ON integration_data.payment_processor_accounts (platform_id, profile_id, account_id);

ALTER TABLE integration_data.payment_processor_merchant_profiles ADD CONSTRAINT uniq_business_platform UNIQUE (business_id, platform_id);

ALTER TABLE integration_data.payment_processor_accounts ADD CONSTRAINT uniq_account_platform UNIQUE (platform_id, profile_id, account_id);