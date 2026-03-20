-- Drop foreign key constraints first
ALTER TABLE public.rel_naics_mcc
DROP CONSTRAINT IF EXISTS rel_naics_mcc_core_naics_code_fk;

ALTER TABLE public.rel_naics_mcc
DROP CONSTRAINT IF EXISTS rel_naics_mcc_core_mcc_code_fk;

DROP TABLE public.rel_naics_mcc;
DROP TABLE public.core_mcc_code;
DROP TABLE public.core_naics_code;
