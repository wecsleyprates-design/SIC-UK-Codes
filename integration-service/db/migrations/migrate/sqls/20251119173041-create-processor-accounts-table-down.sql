DROP TRIGGER IF EXISTS update_processor_accounts_timestamp ON integration_data.payment_processor_accounts;

DROP TABLE IF EXISTS integration_data.payment_processor_accounts;

DROP INDEX IF EXISTS idx_processor_accounts_platform_id_customer_id;

DROP INDEX IF EXISTS idx_processor_accounts_business_id;

DROP INDEX IF EXISTS idx_processor_accounts_account_id;

DROP INDEX IF EXISTS idx_processor_accounts_profile_id;

DROP INDEX IF EXISTS idx_processor_accounts_customer_id;

DROP INDEX IF EXISTS uq_processor_accounts_platform_profile;
