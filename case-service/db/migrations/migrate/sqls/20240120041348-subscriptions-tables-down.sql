DROP TRIGGER IF EXISTS capture_subscription_status ON subscriptions.data_businesses_subscriptions RESTRICT;
ALTER TABLE IF EXISTS "subscriptions"."data_subscriptions_history" DROP CONSTRAINT IF EXISTS fk_subscriptions_id;
DROP TABLE IF EXISTS "subscriptions"."data_subscriptions_history";

DROP TRIGGER IF EXISTS update_data_businesses_subscription_timestamp ON subscriptions.data_businesses_subscriptions RESTRICT;
ALTER TABLE IF EXISTS "subscriptions"."data_businesses_subscriptions" DROP CONSTRAINT IF EXISTS fk_business_id;
DROP TABLE IF EXISTS "subscriptions"."data_businesses_subscriptions";

DROP TYPE IF EXISTS "subscriptions"."status";

DROP SCHEMA IF EXISTS subscriptions;

DROP FUNCTION IF EXISTS update_updated_at;

-- Drop the trigger
DROP TRIGGER IF EXISTS update_business_subscription_history ON subscriptions.data_businesses_subscriptions;

-- Drop the function
DROP FUNCTION IF EXISTS capture_business_subscriptions();
