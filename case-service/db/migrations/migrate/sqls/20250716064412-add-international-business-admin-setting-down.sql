-- 1. Remove the customer assignments for international business setup (setup_id = 7)
DELETE FROM onboarding_schema.rel_customer_setup_status
WHERE setup_id = 7;

-- 2. Remove the setup type definition from the core table
DELETE FROM onboarding_schema.core_onboarding_setup_types
WHERE id = 7 AND code = 'international_business_setup';