-- Remove the new primary key constraint on 'id'
ALTER TABLE integration_data.healthcare_provider_information 
DROP CONSTRAINT healthcare_provider_information_pkey;

-- Remove the 'id' column
ALTER TABLE integration_data.healthcare_provider_information 
DROP COLUMN id;

-- Restore the primary key constraint on 'npi_id'
ALTER TABLE integration_data.healthcare_provider_information 
ADD CONSTRAINT healthcare_provider_information_pkey PRIMARY KEY (npi_id);