ALTER TABLE data_cases
DROP COLUMN IF EXISTS customer_initiated;

DELETE FROM public.core_case_statuses 
WHERE code = 'CREATED' AND id = 20;