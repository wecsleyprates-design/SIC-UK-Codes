INSERT INTO onboarding_schema.core_onboarding_setup_types (id, code, label)
VALUES
(5, 'equifax_credit_score_setup', 'Equifax Credit Score Setup');

INSERT INTO onboarding_schema.rel_customer_setup_status (setup_id, customer_id, is_enabled)
SELECT 
    5 AS setup_id, 
    customer_id, 
    false AS is_enabled
FROM 
    (SELECT DISTINCT customer_id FROM onboarding_schema.rel_customer_setup_status) AS unique_customers;