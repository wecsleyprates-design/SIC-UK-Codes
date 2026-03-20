/* Replace with your SQL commands */
UPDATE onboarding_schema.core_stage_fields_config
SET config = '{
  "fields": [
    {
      "name": "Full Name",
      "status": "Always Required",
      "description": "Gather the first and last name of the owner or control person.",
      "section_name": "Basic Details",
      "status_data_type": "Dropdown"
    },
    {
      "name": "Title",
      "status": "Required",
      "description": "Gather the title of the owner or control person.",
      "section_name": "Basic Details",
      "status_data_type": "Dropdown"
    },
    {
      "name": "Ownership Percentage",
      "status": "Required",
      "description": "Gather the ownership percentage of the owner or control person.",
      "section_name": "Basic Details",
      "status_data_type": "Dropdown"
    },
    {
      "name": "Phone Number",
      "status": "Required",
      "description": "Gather the phone number of the owner or control person.",
      "section_name": "Contact Details",
      "status_data_type": "Dropdown"
    },
    {
      "name": "Email Address",
      "status": "Required",
      "description": "Gather the email of the owner or control person.",
      "section_name": "Contact Details",
      "status_data_type": "Dropdown"
    },
    {
      "name": "Home Address",
      "status": "Required",
      "description": "Gather the home address of the owner or control person.",
      "section_name": "Contact Details",
      "status_data_type": "Dropdown"
    },
    {
      "name": "Identity Verification",
      "status": true,
      "sub_fields": [
        {
          "name": "Conduct Liveliness Check",
          "status": false,
          "description": "When enabled, the applicant will have to provide a selfie to verify against their provided identification.",
          "status_data_type": "Checkbox"
        },
        {
          "name": "Collect Driver’s License",
          "status": false,
          "description": "When enabled, the applicant will have to provide a copy of their valid driver’s license.",
          "status_data_type": "Checkbox"
        }
      ],
      "description": "We’ll verify and collect sensitive information including Social Security Number and Date of Birth. This data is encrypting using the highest industry standards.",
      "section_name": "Identity",
      "status_data_type": "Toggle"
    },
    {
      "name": "Social Security Number",
      "status": "Required",
      "description": "Gather the SSN of the owner or control person.",
      "section_name": "Identity",
      "status_data_type": "Dropdown"
    },
    {
      "name": "Date of Birth",
      "status": "Required",
      "description": "Gather the DOB of the owner or control person.",
      "section_name": "Identity",
      "status_data_type": "Dropdown"
    }
  ],
  "integrations": [],
  "additional_settings": []
}'
WHERE stage_id = 6;

UPDATE onboarding_schema.data_customer_stage_fields_config
SET config = jsonb_build_object(
    'fields', jsonb_build_array(
        -- Basic Details
        jsonb_build_object(
            'name', 'Full Name',
            'status', 'Always Required',
            'description', 'Gather the first and last name of the owner or control person.',
            'section_name', 'Basic Details',
            'status_data_type', 'Dropdown'
        ),
        jsonb_build_object(
            'name', 'Title',
            'status', 'Required',
            'description', 'Gather the title of the owner or control person.',
            'section_name', 'Basic Details',
            'status_data_type', 'Dropdown'
        ),
        jsonb_build_object(
            'name', 'Ownership Percentage',
            'status', 'Required',
            'description', 'Gather the ownership percentage of the owner or control person.',
            'section_name', 'Basic Details',
            'status_data_type', 'Dropdown'
        ),

        -- Contact Details
        jsonb_build_object(
            'name', 'Phone Number',
            'status', 'Required',
            'description', 'Gather the phone number of the owner or control person.',
            'section_name', 'Contact Details',
            'status_data_type', 'Dropdown'
        ),
        jsonb_build_object(
            'name', 'Email Address',
            'status', 'Required',
            'description', 'Gather the email of the owner or control person.',
            'section_name', 'Contact Details',
            'status_data_type', 'Dropdown'
        ),
        jsonb_build_object(
            'name', 'Home Address',
            'status', 'Required',
            'description', 'Gather the home address of the owner or control person.',
            'section_name', 'Contact Details',
            'status_data_type', 'Dropdown'
        ),

        -- Identity Verification (restore original field)
        (
            SELECT jsonb_build_object(
                'name', 'Identity Verification',
                'status', ev_field->'status',
                'description', 'We’ll verify and collect sensitive information including Social Security Number and Date of Birth. This data is encrypting using the highest industry standards.',
                'section_name', 'Identity',
                'status_data_type', 'Toggle',
                'sub_fields', (
                    SELECT jsonb_agg(
                      sf || jsonb_build_object('status_data_type', 'Checkbox')
                    )
                    FROM jsonb_array_elements(ev_field->'sub_fields') AS sf
                    WHERE sf->>'name' NOT IN (
                      'Custom Plaid Template ID',
                      'Plaid Template ID'
                    )
                )
            )
            FROM jsonb_array_elements(config->'fields') AS field(ev_field)
            WHERE ev_field->>'name' = 'Enable Identity Verification'
        ),

        -- Identity Fields
        jsonb_build_object(
            'name', 'Social Security Number',
            'status', 'Required',
            'description', 'Gather the SSN of the owner or control person.',
            'section_name', 'Identity',
            'status_data_type', 'Dropdown'
        ),
        jsonb_build_object(
            'name', 'Date of Birth',
            'status', 'Required',
            'description', 'Gather the DOB of the owner or control person.',
            'section_name', 'Identity',
            'status_data_type', 'Dropdown'
        )
    ),
    'integrations', config->'integrations',
    'additional_settings', config->'additional_settings'
)
WHERE customer_stage_id IN (SELECT id FROM onboarding_schema.data_customer_onboarding_stages WHERE stage_code = 'ownership');
