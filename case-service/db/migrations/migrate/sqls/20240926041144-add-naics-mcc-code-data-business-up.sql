--- In future may be get mcc id instant of naics id So we will save both 
ALTER TABLE public.data_businesses ADD mcc_id int NULL;
ALTER TABLE public.data_businesses ADD naics_id int NULL;
ALTER TABLE public.data_businesses ADD CONSTRAINT data_businesses_core_mcc_code_fk FOREIGN KEY (mcc_id) REFERENCES public.core_mcc_code(id);
ALTER TABLE public.data_businesses ADD CONSTRAINT data_businesses_core_naics_code_fk FOREIGN KEY (naics_id) REFERENCES public.core_naics_code(id);


UPDATE data_businesses 
SET naics_id = core_naics_code.id 
FROM core_naics_code
WHERE data_businesses.naics_code = core_naics_code.code;

UPDATE data_businesses 
SET  mcc_id = rel_naics_mcc.mcc_id 
FROM rel_naics_mcc
WHERE data_businesses.naics_id = rel_naics_mcc.naics_id;

ALTER TABLE public.data_businesses DROP COLUMN naics_title;
ALTER TABLE public.data_businesses DROP COLUMN naics_code;