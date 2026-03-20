ALTER TABLE public.data_businesses ADD naics_title varchar NULL;
ALTER TABLE public.data_businesses ADD naics_code int NULL;

UPDATE data_businesses 
SET naics_code = core_naics_code.code, naics_title = core_naics_code.label 
FROM core_naics_code
WHERE data_businesses.naics_id = core_naics_code.id;

ALTER TABLE public.data_businesses DROP CONSTRAINT data_businesses_core_mcc_code_fk;
ALTER TABLE public.data_businesses DROP COLUMN mcc_id;
ALTER TABLE public.data_businesses DROP CONSTRAINT data_businesses_core_naics_code_fk;
ALTER TABLE public.data_businesses DROP COLUMN naics_id;