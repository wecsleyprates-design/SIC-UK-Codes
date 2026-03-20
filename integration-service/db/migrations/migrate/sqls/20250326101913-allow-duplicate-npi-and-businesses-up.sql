-- Drop the primary key constraint on 'npi_id'
ALTER TABLE integration_data.healthcare_provider_information 
DROP CONSTRAINT healthcare_provider_information_pkey;

-- Add the new 'id' column
ALTER TABLE integration_data.healthcare_provider_information 
ADD COLUMN id UUID DEFAULT gen_random_uuid();

-- Step 4: Set 'id' as the primary key
ALTER TABLE integration_data.healthcare_provider_information 
ADD CONSTRAINT healthcare_provider_information_pkey PRIMARY KEY (id);
