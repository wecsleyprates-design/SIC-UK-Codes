ALTER TABLE "subscriptions"."data_businesses_subscriptions" ADD COLUMN "applicant_id" UUID;

CREATE TABLE "subscriptions"."data_customers" (
    "id" UUID DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    "stripe_customer_id" VARCHAR NOT NULL,
    "applicant_id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "created_at" TIMESTAMP DEFAULT current_timestamp NOT NULL,
    "updated_at" TIMESTAMP DEFAULT current_timestamp NOT NULL,
    CONSTRAINT "unique_business_id_applicant_id_key" UNIQUE("applicant_id", "business_id"),
    CONSTRAINT "fk_business_id" FOREIGN KEY ("business_id") REFERENCES "data_businesses"("id") ON DELETE RESTRICT ON UPDATE RESTRICT
);

CREATE TRIGGER update_data_customers_updated_at
BEFORE UPDATE ON "subscriptions"."data_customers"
FOR EACH ROW
EXECUTE PROCEDURE update_updated_at();

ALTER TABLE "subscriptions"."data_subscriptions_history" ADD COLUMN "created_by" UUID NULL;

CREATE OR REPLACE FUNCTION capture_business_subscriptions()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert a new row into "subscriptions.data_subscriptions_history" with the updated values from "subscriptions.data_businesses_subscriptions"
  INSERT INTO subscriptions.data_subscriptions_history (subscription_id, stripe_subscription_id, status, created_by)
  (SELECT NEW.id as subscription_id, NEW.stripe_subscription_id, NEW.status, NEW.updated_by FROM subscriptions.data_businesses_subscriptions
  WHERE id = NEW.id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;