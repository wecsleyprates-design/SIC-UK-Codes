CREATE OR REPLACE FUNCTION capture_business_subscriptions()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert a new row into "subscriptions.data_subscriptions_history" with the updated values from "subscriptions.data_businesses_subscriptions"
  INSERT INTO subscriptions.data_subscriptions_history (subscription_id, stripe_subscription_id, status)
  (SELECT NEW.id as subscription_id, NEW.stripe_subscription_id, NEW.status FROM subscriptions.data_businesses_subscriptions
  WHERE id = NEW.id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

ALTER TABLE IF EXISTS "subscriptions"."data_subscriptions_history" DROP COLUMN IF EXISTS "created_by";

DROP TRIGGER IF EXISTS update_data_customers_updated_at ON "subscriptions"."data_customers";

ALTER TABLE IF EXISTS "subscriptions"."data_customers" DROP CONSTRAINT IF EXISTS "fk_business_id";
ALTER TABLE IF EXISTS "subscriptions"."data_customers" DROP CONSTRAINT IF EXISTS "unique_business_id_applicant_id_key";
DROP TABLE IF EXISTS "subscriptions"."data_customers";

ALTER TABLE IF EXISTS "subscriptions"."data_businesses_subscriptions" DROP COLUMN IF EXISTS "applicant_id";