ALTER TABLE public.rel_business_owners DROP CONSTRAINT IF EXISTS rel_business_owners_external_id_unique;
ALTER TABLE public.rel_business_owners DROP COLUMN IF EXISTS external_id;
