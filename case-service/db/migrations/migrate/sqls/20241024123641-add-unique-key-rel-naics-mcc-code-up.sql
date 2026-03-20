/* Replace with your SQL commands */
ALTER TABLE public.rel_naics_mcc ADD CONSTRAINT rel_naics_mcc_unique UNIQUE (naics_id,mcc_id);