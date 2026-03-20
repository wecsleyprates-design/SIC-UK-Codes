ALTER TABLE "integration_data"."bank_accounts"
ADD COLUMN "routing_number" varchar,
ADD COLUMN "wire_routing_number" varchar,
ADD COLUMN "deposit_account" boolean DEFAULT false;
