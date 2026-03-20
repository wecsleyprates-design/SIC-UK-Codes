/* Replace with your SQL commands */
UPDATE onboarding_schema.core_stage_fields_config
SET config = '{"fields":[{"name":"Full Name","status":"Always Required","description":"Gather the first and last name of the owner or control person.","status_data_type":"Dropdown","section_name":"Basic Details"},{"name":"Title","status":"Required","description":"Gather the title of the owner or control person.","status_data_type":"Dropdown","section_name":"Basic Details"},{"name":"Ownership Percentage","status":"Required","description":"Gather the ownership percentage of the owner or control person.","status_data_type":"Dropdown","section_name":"Basic Details"},{"name":"Phone Number","status":"Required","description":"Gather the phone number of the owner or control person.","status_data_type":"Dropdown","section_name":"Contact Details"},{"name":"Email Address","status":"Required","description":"Gather the email of the owner or control person.","status_data_type":"Dropdown","section_name":"Contact Details"},{"name":"Home Address","status":"Required","description":"Gather the home address of the owner or control person.","status_data_type":"Dropdown","section_name":"Contact Details"},{"name":"Identity Verification","status":true,"description":"We’ll verify and collect sensitive information including Social Security Number and Date of Birth. This data is encrypting using the highest industry standards.","section_name":"Identity","status_data_type":"Toggle","sub_fields":[{"name":"Conduct Liveliness Check","description":"When enabled, the applicant will have to provide a selfie to verify against their provided identification.","status":false,"status_data_type":"Checkbox"},{"name":"Collect Driver’s License","description":"When enabled, the applicant will have to provide a copy of their valid driver’s license.","status":false,"status_data_type":"Checkbox"}]},{"name":"Social Security Number","status":"Required","description":"Gather the SSN of the owner or control person.","status_data_type":"Dropdown","section_name":"Identity"},{"name":"Date of Birth","status":"Required","description":"Gather the DOB of the owner or control person.","status_data_type":"Dropdown","section_name":"Identity"}],"integrations":[],"additional_settings":[]}'::jsonb
WHERE id = 5 AND stage_id = 6;

UPDATE onboarding_schema.data_customer_stage_fields_config
SET config = jsonb_set(
    config,
    '{fields}',
    (
        SELECT jsonb_agg(
            CASE
                WHEN field->>'name' = 'Name'
                THEN field || jsonb_build_object('name', 'Full Name', 'section_name', 'Basic Details')
                WHEN field->>'name' IN ('Title', 'Ownership Percentage')
                THEN field || jsonb_build_object('section_name', 'Basic Details')
                WHEN field->>'name' IN ('Phone Number', 'Email Address')
                THEN field || jsonb_build_object('status', 'Required', 'section_name', 'Contact Details')
                WHEN field->>'name' = 'Home Address'
                THEN field || jsonb_build_object('section_name', 'Contact Details')
                WHEN field->>'name' IN ('Social Security Number', 'Date of Birth')
                THEN field || jsonb_build_object('section_name', 'Identity')
                WHEN field->>'name' = 'Identity Verification'
                THEN field || jsonb_build_object(
                    'section_name', 'Identity',
                    'sub_fields', jsonb_build_array(
                        jsonb_build_object(
                            'name', 'Conduct Liveliness Check',
                            'description', 'When enabled, the applicant will have to provide a selfie to verify against their provided identification.',
                            'status', false,
                            'status_data_type', 'Checkbox'
                        ),
                        jsonb_build_object(
                            'name', 'Collect Driver’s License',
                            'description', 'When enabled, the applicant will have to provide a copy of their valid driver’s license.',
                            'status', false,
                            'status_data_type', 'Checkbox'
                        )
                    )
                )
                ELSE field
            END
        )
        FROM jsonb_array_elements(config->'fields') AS field
    )
)
WHERE customer_stage_id IN (SELECT id FROM onboarding_schema.data_customer_onboarding_stages WHERE stage_code = 'ownership');

UPDATE onboarding_schema.data_customer_stage_fields_config 
SET config = jsonb_set(
    config,
    '{fields}',
    (
        SELECT jsonb_agg(field ORDER BY 
            CASE 
                WHEN field->>'name' = 'Full Name' THEN 1
                WHEN field->>'name' = 'Title' THEN 2
                WHEN field->>'name' = 'Ownership Percentage' THEN 3
                WHEN field->>'name' = 'Phone Number' THEN 4
                WHEN field->>'name' = 'Email Address' THEN 5
                WHEN field->>'name' = 'Home Address' THEN 6
                WHEN field->>'name' = 'Identity Verification' THEN 7
                WHEN field->>'name' = 'Social Security Number' THEN 8
                WHEN field->>'name' = 'Date of Birth' THEN 9
                ELSE 10 -- Default for any new fields
            END
        )
        FROM jsonb_array_elements(config->'fields') AS field
    ),
    true
)
WHERE customer_stage_id IN (SELECT id FROM onboarding_schema.data_customer_onboarding_stages WHERE stage_code = 'ownership');
