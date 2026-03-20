INSERT INTO rel_business_customer_monitoring (business_id, customer_id, created_by)
SELECT business_id, customer_id , customer_id FROM data_cases
WHERE customer_id IS NOT NULL
ON CONFLICT (business_id, customer_id) DO NOTHING;

INSERT INTO rel_business_customer_monitoring (business_id, customer_id, created_by)
SELECT business_id, customer_id, customer_id FROM data_invites
WHERE customer_id IS NOT NULL
ON CONFLICT (business_id, customer_id) DO NOTHING;
