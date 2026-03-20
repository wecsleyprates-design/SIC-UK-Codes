
ALTER TABLE "integration_data"."bank_accounts"
ALTER COLUMN "bank_account" TYPE VARCHAR,
ALTER COLUMN "bank_name" TYPE VARCHAR,
ALTER COLUMN "official_name" TYPE VARCHAR,
ALTER COLUMN "institution_name" TYPE VARCHAR,
ALTER COLUMN "verification_status" TYPE VARCHAR;

ALTER TABLE "integration_data"."bank_account_transactions"
ALTER COLUMN "transaction_id" TYPE VARCHAR,
ALTER COLUMN "category" TYPE VARCHAR,
ALTER COLUMN "description" TYPE VARCHAR;
