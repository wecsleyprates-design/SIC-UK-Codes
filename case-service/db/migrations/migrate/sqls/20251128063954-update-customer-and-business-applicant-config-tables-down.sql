-- 1. Remove is_enabled from business renamed table
ALTER TABLE public.data_business_applicant_configs
DROP COLUMN IF EXISTS is_enabled;

-- 2. Remove is_enabled from customer renamed table
ALTER TABLE public.data_customer_applicant_configs
DROP COLUMN IF EXISTS is_enabled;

-- 3. Rename back to old business table name
ALTER TABLE public.data_business_applicant_configs
RENAME TO business_applicant_configs;

-- 4. Rename back to old customer table name
ALTER TABLE public.data_customer_applicant_configs
RENAME TO customer_applicant_configs;