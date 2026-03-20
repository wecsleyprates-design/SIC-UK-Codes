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
            "name": "Disable Identity Verification",
            "status": false,
            "description": "Streamline onboarding if you don’t need to verify identities, and would like full control over the owner detail fields below.",
            "section_name": "Identity Verification",
            "status_data_type": "Checkbox"
        },
        {
            "name": "Enable Identity Verification",
            "status": true,
            "sub_fields": [
                {
                    "name": "Conduct Liveliness Check",
                    "status": false,
                    "description": "When enabled, the applicant will have to provide a selfie to verify against their provided identification.",
                    "status_data_type": "Toggle"
                }, 
                {
                    "name": "Collect Driver’s License",
                    "status": false,
                    "description": "When enabled, the applicant will have to provide a copy of their valid driver’s license.",
                    "status_data_type": "Toggle"
                },
                {
                    "name": "Custom Plaid Template ID",
                    "status": false,
                    "description": "Use a Plaid template that is unique to this customer.",
                    "status_data_type": "Toggle"
                },
                {
                    "name": "Plaid Template ID",
                    "status": "",
                    "description": "Please enter a Plaid Template ID.",
                    "status_data_type": "Textbox"
                }
            ], 
            "description": "Verify the identity of each applicant. Please note that some fields in the Owner Details section are required when this feature is enabled.",
            "section_name": "Identity Verification",
            "status_data_type": "Checkbox"
        },
        {
            "name": "Social Security Number",
            "status": "Required",
            "description": "Gather the SSN of the owner or control person.",
            "section_name": "Owner Details",
            "status_data_type": "Dropdown"
        }, 
        {
            "name": "Date of Birth",
            "status": "Required",
            "description": "Gather the DOB of the owner or control person.",
            "section_name": "Owner Details",
            "status_data_type": "Dropdown"
        }, 
        {
            "name": "Phone Number",
            "status": "Required",
            "description": "Gather the phone number of the owner or control person.", 
            "section_name": "Owner Details",
            "status_data_type": "Dropdown"
        }, 
        {
            "name": "Email Address",
            "status": "Required",
            "description": "Gather the email of the owner or control person.",
            "section_name": "Owner Details",
            "status_data_type": "Dropdown"
        }, 
        {
            "name": "Home Address",
            "status": "Required",
            "description": "Gather the home address of the owner or control person.",
            "section_name": "Owner Details",
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
        -- Disable Identity Verification (inverse of original Identity Verification)
        jsonb_build_object(
            'name', 'Disable Identity Verification',
            'status', NOT (config->'fields' @> '[{"name": "Identity Verification", "status": true}]'),
            'description', 'Streamline onboarding if you don’t need to verify identities, and would like full control over the owner detail fields below.',
            'section_name', 'Identity Verification',
            'status_data_type', 'Checkbox'
        ),
        -- Enable Identity Verification (reuse old value)
        (
            SELECT jsonb_build_object(
                'name', 'Enable Identity Verification',
                'status', iv_field->'status',
                'description', 'Verify the identity of each applicant. Please note that some fields in the Owner Details section are required when this feature is enabled.',
                'section_name', 'Identity Verification',
                'status_data_type', 'Checkbox',
                'sub_fields', (
                    SELECT jsonb_agg(
                        sf || jsonb_build_object('status_data_type', 'Toggle')
                    )   || jsonb_build_array(
                        jsonb_build_object(
                            'name', 'Custom Plaid Template ID',
                            'status', false,
                            'description', 'Use a Plaid template that is unique to this customer.',
                            'status_data_type', 'Toggle'
                        ),
                        jsonb_build_object(
                            'name', 'Plaid Template ID',
                            'status', '',
                            'description', 'Please enter a Plaid Template ID.',
                            'status_data_type', 'Textbox'
                        )
                    )
                    FROM jsonb_array_elements(iv_field->'sub_fields') AS sf
                )
            )
            FROM jsonb_array_elements(config->'fields') AS field(iv_field)
            WHERE iv_field->>'name' = 'Identity Verification'
        ),
        -- Owner Details
        jsonb_build_object(
            'name', 'Social Security Number',
            'status', 'Required',
            'description', 'Gather the SSN of the owner or control person.',
            'section_name', 'Owner Details',
            'status_data_type', 'Dropdown'
        ),
        jsonb_build_object(
            'name', 'Date of Birth',
            'status', 'Required',
            'description', 'Gather the DOB of the owner or control person.',
            'section_name', 'Owner Details',
            'status_data_type', 'Dropdown'
        ),
        jsonb_build_object(
            'name', 'Phone Number',
            'status', 'Required',
            'description', 'Gather the phone number of the owner or control person.',
            'section_name', 'Owner Details',
            'status_data_type', 'Dropdown'
        ),
        jsonb_build_object(
            'name', 'Email Address',
            'status', 'Required',
            'description', 'Gather the email of the owner or control person.',
            'section_name', 'Owner Details',
            'status_data_type', 'Dropdown'
        ),
        jsonb_build_object(
            'name', 'Home Address',
            'status', 'Required',
            'description', 'Gather the home address of the owner or control person.',
            'section_name', 'Owner Details',
            'status_data_type', 'Dropdown'
        )
    ),
    'integrations', config->'integrations',
    'additional_settings', config->'additional_settings'
)
WHERE customer_stage_id IN (SELECT id FROM onboarding_schema.data_customer_onboarding_stages WHERE stage_code = 'ownership');