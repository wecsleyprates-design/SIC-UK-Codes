-- Down migration: Revert the config column to its previous state
UPDATE onboarding_schema.core_stage_fields_config
SET config = '{
  "fields": [
    {
      "name": "Tax ID Number/Employer Identification Number",
      "status": "Always Required",
      "description": "Gather the unique identifier for the company. Used to find publicly available data on the company.",
      "status_data_type": "Dropdown"
    },
    {
      "name": "Company Name",
      "status": "Always Required",
      "description": "Collect the company’s name and any associated DBAs.",
      "status_data_type": "Dropdown"
    },
    {
      "name": "Company Address",
      "status": "Always Required",
      "description": "Collect the company’s address.",
      "status_data_type": "Dropdown"
    },
    {
      "name": "Industry",
      "status": "Required",
      "description": "This field is presented in the case we are not able to auto-generate the company’s industry. When collected, related NAICS and MCC codes will be provided to you.",
      "status_data_type": "Dropdown"
    },
    {
      "name": "Website",
      "status": "Optional",
      "description": "When collected, we’ll run an analysis on the company’s website and check its authenticity.",
      "status_data_type": "Dropdown"
    },
    {
      "name": "Company Phone Number",
      "status": "Optional",
      "description": "Collect a company’s phone number if necessary.",
      "status_data_type": "Dropdown"
    },
    {
      "name": "Mailing Address",
      "status": "Optional",
      "description": "We’ll collect the company’s main address by default. However, this provides an additional field to collect a mailing address and confirm if it is different than the main company address.",
      "status_data_type": "Dropdown"
    },
    {
      "name": "LinkedIn",
      "status": "Optional",
      "description": "Ask for a link to the company’s LinkedIn profile.",
      "status_data_type": "Dropdown"
    }
  ],
  "integrations": [],
  "additional_settings": []
}'
WHERE stage_id = 3;
