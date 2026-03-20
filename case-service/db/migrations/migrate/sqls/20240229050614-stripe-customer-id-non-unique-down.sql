/* Replace with your SQL commands */
ALTER TABLE IF EXISTS "subscriptions"."data_businesses_subscriptions" ADD CONSTRAINT "data_businesses_subscriptions_stripe_customer_id_key" UNIQUE ("stripe_customer_id");
