CREATE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE SCHEMA subscriptions;

CREATE TYPE "subscriptions"."status" AS ENUM (
  'SUBSCRIBED',
  'UNSUBSCRIBED',
  'NOT_SUBSCRIBED',
  'PAYMENT_DECLINED'
);

CREATE TABLE "subscriptions"."data_businesses_subscriptions" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "business_id" uuid NOT NULL UNIQUE,
  "stripe_customer_id" VARCHAR(30) NOT NULL UNIQUE,
  "stripe_subscription_id" VARCHAR(30),
  "status" subscriptions.status NOT NULL DEFAULT 'NOT_SUBSCRIBED',
  "created_at" timestamp NOT NULL DEFAULT current_timestamp,
  "created_by" uuid NOT NULL,
  "updated_at" timestamp NOT NULL DEFAULT current_timestamp,
  "updated_by" uuid NOT NULL,
  CONSTRAINT "fk_business_id" FOREIGN KEY ("business_id") REFERENCES "data_businesses" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT
);

CREATE TRIGGER update_data_businesses_subscription_timestamp
    AFTER UPDATE
    ON
    subscriptions.data_businesses_subscriptions
    FOR EACH ROW
EXECUTE PROCEDURE update_updated_at();

CREATE TABLE "subscriptions"."data_subscriptions_history" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "subscription_id" uuid NOT NULL,
  "stripe_subscription_id" VARCHAR(30),
  "status" subscriptions.status NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT current_timestamp,
  CONSTRAINT "fk_subscriptions_id" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"."data_businesses_subscriptions" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT
);

-- Create a function to insert a row in "subscriptions.data_subscriptions_history" on update of "subscriptions.data_businesses_subscriptions"
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

-- Create a trigger on "subscriptions.data_businesses_subscriptions" to execute the function on update
CREATE TRIGGER update_business_subscription_history
AFTER INSERT OR UPDATE ON subscriptions.data_businesses_subscriptions
FOR EACH ROW
EXECUTE FUNCTION capture_business_subscriptions();
