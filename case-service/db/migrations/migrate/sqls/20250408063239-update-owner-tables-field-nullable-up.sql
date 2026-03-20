-- This migration updates the data_owners table to make the first_name and last_name fields nullable.
ALTER TABLE public.data_owners ALTER COLUMN first_name DROP NOT NULL;
ALTER TABLE public.data_owners ALTER COLUMN last_name DROP NOT NULL;

-- This migration updates the rel_business_owners table to make the owner_type field nullable.
ALTER TABLE public.rel_business_owners ALTER COLUMN owner_type DROP NOT NULL;

