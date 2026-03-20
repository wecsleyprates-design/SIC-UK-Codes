/* Replace with your SQL commands */
UPDATE onboarding_schema.data_customer_stage_fields_config 
SET config = jsonb_set(
    config,
    '{fields}',
    (
        SELECT jsonb_agg(
            CASE
                WHEN field->>'name' = 'Full Name' -- Reverting 'Full Name' to 'Name'
                THEN field - 'section_name' || jsonb_build_object('name', 'Name')
                WHEN field->>'name' IN ('Title', 'Ownership Percentage') 
                THEN field - 'section_name'  -- Removing 'section_name'
                WHEN field->>'name' IN ('Phone Number', 'Email Address') 
                THEN field - 'section_name' -- Removing 'status' and 'section_name'
                WHEN field->>'name' = 'Home Address' 
                THEN field - 'section_name'  -- Removing 'section_name'
                WHEN field->>'name' IN ('Social Security Number', 'Date of Birth') 
                THEN field - 'section_name'  -- Removing 'section_name'
                WHEN field->>'name' = 'Identity Verification'
                THEN field - 'sub_fields' || jsonb_build_object('section_name', 'IDENTITY') -- Removing section and sub_fields
                ELSE field
            END
        )
        FROM jsonb_array_elements(config->'fields') AS field
    ),
    true
)
WHERE customer_stage_id IN (SELECT id FROM onboarding_schema.data_customer_onboarding_stages WHERE stage_code = 'ownership');

UPDATE onboarding_schema.data_customer_stage_fields_config 
SET config = jsonb_set(
    config,
    '{fields}',
    (
        SELECT jsonb_agg(field ORDER BY 
            CASE 
                WHEN field->>'name' = 'Name' THEN 1
                WHEN field->>'name' = 'Title' THEN 2
                WHEN field->>'name' = 'Ownership Percentage' THEN 3
                WHEN field->>'name' = 'Phone Number' THEN 4
                WHEN field->>'name' = 'Email Address' THEN 5
                WHEN field->>'name' = 'Social Security Number' THEN 6
                WHEN field->>'name' = 'Date of Birth' THEN 7
                WHEN field->>'name' = 'Home Address' THEN 8
                WHEN field->>'name' = 'Identity Verification' THEN 9
                ELSE 10 -- Default for any new fields
            END
        )
        FROM jsonb_array_elements(config->'fields') AS field
    ),
    true
)
WHERE customer_stage_id IN (SELECT id FROM onboarding_schema.data_customer_onboarding_stages WHERE stage_code = 'ownership');

UPDATE onboarding_schema.core_stage_fields_config
SET config = '{"fields": [{"name": "Name", "status": "Always Required", "description": "Gather the first and last name of the owner or control person.", "status_data_type": "Dropdown"}, {"name": "Title", "status": "Required", "description": "Gather the title of the owner or control person.", "status_data_type": "Dropdown"}, {"name": "Ownership Percentage", "status": "Required", "description": "Gather the ownership percentage of the owner or control person.", "status_data_type": "Dropdown"}, {"name": "Phone Number", "status": "Optional", "description": "Gather the phone number of the owner or control person.", "status_data_type": "Dropdown"}, {"name": "Email Address", "status": "Optional", "description": "Gather the email of the owner or control person.", "status_data_type": "Dropdown"}, {"name": "Social Security Number", "status": "Required", "description": "Gather the SSN of the owner or control person.", "status_data_type": "Dropdown"}, {"name": "Date of Birth", "status": "Required", "description": "Gather the DOB of the owner or control person.", "status_data_type": "Dropdown"}, {"name": "Home Address", "status": "Required", "description": "Gather the home address of the owner or control person.", "status_data_type": "Dropdown"}, {"name": "Identity Verification", "status": true, "description": "We’ll verify and collect sensitive information including Social Security Number and Date of Birth. This data is encrypting using the highest industry standards.", "section_name": "IDENTITY", "status_data_type": "Toggle"}], "integrations": [], "additional_settings": []}'::jsonb
WHERE id = 5 AND stage_id = 6;
