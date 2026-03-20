UPDATE onboarding_schema.core_stage_fields_config
SET config = '{
  "fields": [
    {
        "name": "Tax ID Number/Employer Identification Number",
        "status": "Required",
        "description": "Gather the unique identifier for the company. Used to find publicly available data on the company.",
        "status_data_type": "Dropdown",
        "section_name": "What company data would you like to collect?",
	    "sub_fields":[
            {
                "name":"Allow Unverified TIN Submissions",
                "status":false,
                "description":"When enabled, applicants are able to continue onboarding in cases where TIN verification is still occurring, but will be required to be verified prior to submission.",
                "status_data_type":"Checkbox"
            },
            {
                "name":"Require a TIN Response",
                "status":true,
                "description":"When enabled, applicants cannot proceed past this step until their TIN has been verified.",
                "status_data_type":"Checkbox"
            },
            {
                "name":"Continue with Unverified TIN",
                "status":false,
                "description":"When enabled, applicants may continue to other steps of onboarding while TIN verification occurs in the background. Feedback is provided to correct an invalid TIN. A verified TIN is required to submit an application.",
                "status_data_type":"Checkbox"
            },
            {
                "name":"Submit with Unverified TIN",
                "status":false,
                "description":"When enabled, applicants will receive feedback when a TIN is invalid and be provided the choice to update the TIN or submit their application with their invalid TIN.",
                "status_data_type":"Checkbox"
            }
	   	]
    },
    {
        "name": "Company Name",
        "status": "Always Required",
        "description": "Collect the company’s name and any associated DBAs.",
        "status_data_type": "Dropdown",
        "section_name": "What company data would you like to collect?"
    },
    {
        "name": "Company Address",
        "status": "Always Required",
        "description": "Collect the company’s address.",
        "status_data_type": "Dropdown",
        "section_name": "What company data would you like to collect?"
    },
    {
        "name": "Industry",
        "status": "Required",
        "description": "This field is presented in the case we are not able to auto-generate the company’s industry. When collected, related NAICS and MCC codes will be provided to you.",
        "status_data_type": "Dropdown",
        "section_name": "What company data would you like to collect?"
    },
    {
        "name": "Website",
        "status": "Optional",
        "description": "When collected, we’ll run an analysis on the company’s website and check its authenticity.",
        "status_data_type": "Dropdown",
        "section_name": "What company data would you like to collect?"
    },
    {
        "name": "Company Phone Number",
        "status": "Optional",
        "description": "Collect a company’s phone number if necessary.",
        "status_data_type": "Dropdown",
        "section_name": "What company data would you like to collect?"
    },
    {
        "name": "Mailing Address",
        "status": "Optional",
        "description": "We’ll collect the company’s main address by default. However, this provides an additional field to collect a mailing address and confirm if it is different than the main company address.",
        "status_data_type": "Dropdown",
        "section_name": "What company data would you like to collect?"
    },
    {
        "name": "LinkedIn",
        "status": "Optional",
        "description": "Ask for a link to the company’s LinkedIn profile.",
        "status_data_type": "Dropdown",
        "section_name": "What company data would you like to collect?"
    },
    {
        "name": "Primary Provider’s NPI Number*",
        "status": "Optional",
        "description": "NPI (National Provider Identifier) is a unique 10-digit identification number assigned to healthcare providers in the United States by the Centers for Medicare & Medicaid Services (CMS). When enabled, we’ll collect and verify the status of the provided NPI number.",
        "status_data_type": "Dropdown",
        "section_name": "What company data would you like to collect?"
    }
  ],
  "integrations": [],
  "additional_settings": []
}'
WHERE stage_id = 3;

UPDATE onboarding_schema.data_customer_stage_fields_config
SET config = jsonb_set(
    config,
    '{fields}',
    (
        SELECT jsonb_agg(
            CASE
                WHEN field->>'name' IN ('Company Name', 'Company Address', 'Industry', 'Website', 'Company Phone Number', 'Mailing Address', 'LinkedIn', 'Primary Provider’s NPI Number*')
                THEN field || jsonb_build_object('section_name', 'What company data would you like to collect?')
                WHEN field->>'name' = 'Tax ID Number/Employer Identification Number'
                THEN field || jsonb_build_object(
                    'section_name', 'What company data would you like to collect?',
                    'sub_fields', jsonb_build_array(
                        jsonb_build_object(
                            'name', 'Allow Unverified TIN Submissions',
                            'status', false,
                            'description', 'When enabled, applicants are able to continue onboarding in cases where TIN verification is still occurring, but will be required to be verified prior to submission.',
                            'status_data_type', 'Checkbox'
                        ),
                        jsonb_build_object(
                            'name', 'Require a TIN Response',
                            'status', true,
                            'description', 'When enabled, applicants cannot proceed past this step until their TIN has been verified.',
                            'status_data_type', 'Checkbox'
                        ),
                        jsonb_build_object(
                            'name', 'Continue with Unverified TIN',
                            'description', 'When enabled, applicants may continue to other steps of onboarding while TIN verification occurs in the background. Feedback is provided to correct an invalid TIN. A verified TIN is required to submit an application.',
                            'status', false,
                            'status_data_type', 'Checkbox'
                        ),
                        jsonb_build_object(
                            'name', 'Submit with Unverified TIN',
                            'description', 'When enabled, applicants will receive feedback when a TIN is invalid and be provided the choice to update the TIN or submit their application with their invalid TIN.',
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
WHERE customer_stage_id IN (SELECT id FROM onboarding_schema.data_customer_onboarding_stages WHERE stage_code = 'company');
