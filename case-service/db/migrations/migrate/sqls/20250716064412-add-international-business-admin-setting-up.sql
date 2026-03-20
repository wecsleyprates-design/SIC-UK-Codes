-- 1. Insert a new setup type into the core table

INSERT INTO onboarding_schema.core_onboarding_setup_types (id, code, label)
VALUES
(7, 'international_business_setup', 'International Business Setup');

-- 2. Assign this setup to all existing customers with default value "false"

INSERT INTO onboarding_schema.rel_customer_setup_status (setup_id, customer_id, is_enabled)
SELECT 
    7 AS setup_id, 
    customer_id, 
    false AS is_enabled
FROM 
    (SELECT DISTINCT customer_id FROM onboarding_schema.rel_customer_setup_status) AS unique_customers;