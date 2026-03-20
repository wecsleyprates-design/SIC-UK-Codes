INSERT INTO onboarding_schema.rel_customer_setup_status (setup_id, customer_id, is_enabled)
SELECT 
    6 AS setup_id, 
    customer_id, 
    false AS is_enabled
FROM 
    (SELECT DISTINCT customer_id FROM onboarding_schema.rel_customer_setup_status) AS unique_customers  
ON CONFLICT (setup_id, customer_id) DO NOTHING;
