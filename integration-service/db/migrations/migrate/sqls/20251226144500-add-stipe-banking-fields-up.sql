CREATE TYPE "integration_data"."account_holder_type" AS ENUM (
    'business',
    'personal'
);

ALTER TABLE "integration_data"."bank_accounts"
    ADD COLUMN IF NOT EXISTS "account_holder_name" VARCHAR(255),
    ADD COLUMN IF NOT EXISTS "account_holder_type" integration_data.account_holder_type;

