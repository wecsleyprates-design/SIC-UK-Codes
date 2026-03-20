-- change the npi column to 255 characters max
ALTER TABLE integration_data.healthcare_provider_information  
alter column npi_id type varchar(255);

-- rename the npi_id column to submitted_npi to reflect user input
ALTER TABLE integration_data.healthcare_provider_information  
rename column npi_id to submitted_npi;

-- boolean toggle conveys if match was found
ALTER TABLE integration_data.healthcare_provider_information  
add column is_matched boolean default false;

-- drop the primary key
ALTER TABLE integration_data.healthcare_provider_information  
drop constraint healthcare_provider_information_pkey;

-- drop the id column in favor of the business_integration_task_id as the primary key
ALTER TABLE integration_data.healthcare_provider_information  
drop column id;

ALTER TABLE integration_data.healthcare_provider_information  
add constraint healthcare_provider_information_pkey
primary key (business_integration_task_id);

-- add a case id column to the table and make it an index
ALTER TABLE integration_data.healthcare_provider_information
add column case_id UUID;

CREATE INDEX idx_case_id ON integration_data.healthcare_provider_information (case_id);
