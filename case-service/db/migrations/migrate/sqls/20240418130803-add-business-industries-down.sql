ALTER TABLE data_businesses DROP CONSTRAINT IF EXISTS fk_business_industries;

ALTER TABLE data_businesses DROP COLUMN industry;

DROP TABLE core_business_industries;