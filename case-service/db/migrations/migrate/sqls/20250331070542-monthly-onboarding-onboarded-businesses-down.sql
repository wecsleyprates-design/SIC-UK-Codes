/* Replace with your SQL commands */
ALTER TABLE onboarding_schema.data_customer_onboarding_limits_history
    DROP COLUMN onboarded_businesses;

ALTER TABLE onboarding_schema.data_customer_onboarding_limits
    DROP COLUMN onboarded_businesses;
