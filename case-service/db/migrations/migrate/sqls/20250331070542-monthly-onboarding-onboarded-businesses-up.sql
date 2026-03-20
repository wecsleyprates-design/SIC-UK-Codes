/* Replace with your SQL commands */
ALTER TABLE onboarding_schema.data_customer_onboarding_limits
    ADD COLUMN onboarded_businesses UUID[] NOT NULL DEFAULT ARRAY[]::UUID[];

ALTER TABLE onboarding_schema.data_customer_onboarding_limits_history
    ADD COLUMN onboarded_businesses UUID[] NOT NULL DEFAULT ARRAY[]::UUID[];
