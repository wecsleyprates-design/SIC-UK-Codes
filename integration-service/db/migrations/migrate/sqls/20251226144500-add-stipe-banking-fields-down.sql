ALTER TABLE "integration_data"."bank_accounts"
    DROP COLUMN IF EXISTS "account_holder_name",
    DROP COLUMN IF EXISTS "account_holder_type";

DROP TYPE IF EXISTS integration_data.account_holder_type;