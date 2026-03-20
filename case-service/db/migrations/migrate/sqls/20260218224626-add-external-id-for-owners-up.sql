-- Add external_id column to rel_business_owners table
ALTER TABLE public.rel_business_owners ADD COLUMN IF NOT EXISTS external_id VARCHAR NULL;

-- Drop existing unique constraint on business_id and external_id for idempotency
ALTER TABLE public.rel_business_owners DROP CONSTRAINT IF EXISTS rel_business_owners_external_id_unique;

-- Add new unique constraint on business_id and external_id
ALTER TABLE public.rel_business_owners ADD CONSTRAINT rel_business_owners_external_id_unique
    UNIQUE (business_id, external_id);
