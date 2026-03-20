-- Replace NULL values in first_name and last_name with a default value (e.g., empty string or placeholder)
UPDATE public.data_owners
SET first_name = ''
WHERE first_name IS NULL;

UPDATE public.data_owners
SET last_name = ''
WHERE last_name IS NULL;

UPDATE public.rel_business_owners
SET owner_type = 'BENEFICIARY'
WHERE owner_type IS NULL;
-- Now set the columns to NOT NULL
ALTER TABLE public.data_owners ALTER COLUMN first_name SET NOT NULL;
ALTER TABLE public.data_owners ALTER COLUMN last_name SET NOT NULL;

-- This down migration restores the NOT NULL constraint on the rel_business_owners table's owner_type field.
ALTER TABLE public.rel_business_owners ALTER COLUMN owner_type SET NOT NULL;
