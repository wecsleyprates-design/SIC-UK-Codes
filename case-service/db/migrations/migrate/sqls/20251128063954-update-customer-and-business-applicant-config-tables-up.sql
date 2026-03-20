-- 1. Rename business table
ALTER TABLE public.business_applicant_configs
RENAME TO data_business_applicant_configs;

-- 2. Rename customer table
ALTER TABLE public.customer_applicant_configs
RENAME TO data_customer_applicant_configs;

-- 3. Add is_enabled to business table
ALTER TABLE public.data_business_applicant_configs
ADD COLUMN is_enabled boolean NOT NULL DEFAULT true;

-- 4. Add is_enabled to customer table
ALTER TABLE public.data_customer_applicant_configs
ADD COLUMN is_enabled boolean NOT NULL DEFAULT true;