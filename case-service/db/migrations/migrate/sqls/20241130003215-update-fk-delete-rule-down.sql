ALTER TABLE onboarding_schema.data_business_custom_fields DROP CONSTRAINT IF EXISTS fk_business_id;

ALTER TABLE onboarding_schema.data_business_custom_fields ADD CONSTRAINT fk_business_id FOREIGN KEY (business_id) REFERENCES data_businesses (id) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE onboarding_schema.data_business_custom_fields DROP CONSTRAINT IF EXISTS fk_case_id;

ALTER TABLE onboarding_schema.data_business_custom_fields ADD CONSTRAINT fk_case_id FOREIGN KEY (case_id) REFERENCES data_cases (id) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE rel_business_industry_naics DROP CONSTRAINT IF EXISTS fk_business_id;

ALTER TABLE rel_business_industry_naics ADD CONSTRAINT fk_business_id FOREIGN KEY (business_id) REFERENCES data_businesses (id) ON DELETE RESTRICT ON UPDATE RESTRICT;