DROP INDEX IF EXISTS idx_case_id;

ALTER TABLE integration_data.healthcare_provider_information  
DROP COLUMN IF EXISTS case_id;

ALTER TABLE integration_data.healthcare_provider_information
DROP column if exists case_id;

ALTER TABLE integration_data.healthcare_provider_information  
DROP constraint if exists healthcare_provider_information_pkey;

ALTER TABLE integration_data.healthcare_provider_information 
ADD column if not exists id UUID DEFAULT gen_random_uuid();

ALTER TABLE integration_data.healthcare_provider_information 
DROP column if exists is_matched;

ALTER TABLE integration_data.healthcare_provider_information 
RENAME column submitted_npi TO npi_id;

ALTER TABLE integration_data.healthcare_provider_information  
ALTER COLUMN npi_id TYPE varchar(10);

ALTER TABLE integration_data.healthcare_provider_information  
ADD CONSTRAINT healthcare_provider_information_pkey 
PRIMARY KEY (id);