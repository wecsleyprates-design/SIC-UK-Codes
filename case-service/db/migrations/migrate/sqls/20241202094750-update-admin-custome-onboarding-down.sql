/* Replace with your SQL commands */

-- remove unique constraint on setup_id and customer_id
ALTER TABLE onboarding_schema.rel_customer_setup_status
DROP CONSTRAINT rel_customer_unique_setup_customer;


UPDATE onboarding_schema.core_onboarding_stages 
SET is_removable = true, is_orderable = true
WHERE code IN ('company_additional_info','review');


UPDATE onboarding_schema.data_customer_onboarding_stages
SET is_removable = true, is_orderable = true
WHERE stage_code IN ('company_additional_info', 'company','review');


-- update core config of company details
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
      "name": "Industry",
      "status": "Required",
      "description": "This field is presented in the case we are not able to auto-generate the company’s industry. When collected, related NAICS and MCC codes will be provided to you.",
      "status_data_type": "Dropdown"
    },
    {
      "name": "Website",
      "status": "Required",
      "description": "When collected, we’ll run an analysis on the company’s website and check its authenticity.",
      "status_data_type": "Dropdown"
    },
    {
      "name": "Company Phone Number",
      "status": "Required",
      "description": "Collect a company’s phone number if necessary.",
      "status_data_type": "Dropdown"
    },
    {
      "name": "Mailing Address",
      "status": "Required",
      "description": "We’ll collect the company’s main address by default. However, this provides an additional field to collect a mailing address and confirm if it is different than the main company address.",
      "status_data_type": "Dropdown"
    }
  ], "integrations": [], "additional_settings": [] }'),
WHERE stage_id = 3;

-- update core config of ownership details
UPDATE onboarding_schema.core_stage_fields_config
SET config = '{
  "fields": [
    {
      "name": "Name",
      "status": "Required",
      "description": "Gather the first and last name of the owner or control person.",
      "status_data_type": "Dropdown"
    },
    {
      "name": "Title",
      "status": "Required",
      "description": "Gather the title of the owner or control person.",
      "status_data_type": "Dropdown"
    },
    {
      "name": "Ownership Percentage",
      "status": "Required",
      "description": "Gather the ownership percentage of the owner or control person.",
      "status_data_type": "Dropdown"
    },
    {
      "name": "Phone Number",
      "status": "Required",
      "description": "Gather the phone number of the owner or control person.",
      "status_data_type": "Dropdown"
    },
    {
      "name": "Email Address",
      "status": "Required",
      "description": "Gather the email of the owner or control person.",
      "status_data_type": "Dropdown"
    },
    {
      "name": "Social Security Number",
      "status": "Required",
      "description": "Gather the SSN of the owner or control person.",
      "status_data_type": "Dropdown"
    },
    {
      "name": "Date of Birth",
      "status": "Required",
      "description": "Gather the DOB of the owner or control person.",
      "status_data_type": "Dropdown"
    },
    {
      "name": "Home Address",
      "status": "Required",
      "description": "Gather the home address of the owner or control person.",
      "status_data_type": "Dropdown"
    }
  ],
  "integrations": [
    {
      "name": "Real-Time Integration",
      "is_enabled": true,
      "description": "When this integration is on, applicants can connect directly to their accounts."
    }
  ],
  "additional_settings": [
    {
      "name": "Enable a liveliness check",
      "is_enabled": false
    },
    {
      "name": "Enable collection of driver’s license",
      "is_enabled": false
    }
  ]
}' WHERE stage_id = 6;

-- update core config of processing history
UPDATE onboarding_schema.core_stage_fields_config
SET config = '{
  "fields": [
    {
      "name": "Upload Documentation",
      "status": "Required",
      "description": "Allow applicants to upload their past payment processing statements.",
      "status_data_type": "Dropdown",
      "section_name": "DOCUMENT FIELDS"
    },
    {
      "name": "OCR",
      "status": true,
      "description": "Auto calculate and pre-fill the fields below when statements are uploaded.",
      "status_data_type": "Boolean",
      "section_name": "DOCUMENT FIELDS"
    },
    {
      "name": "Monthly Volume",
      "status": "Required",
      "description": "Add content.",
      "status_data_type": "Dropdown",
      "section_name": "VISA/MASTERCARD/DISCOVER FIELDS"
    },
    {
      "name": "Average Ticket Size",
      "status": "Required",
      "description": "Add content.",
      "status_data_type": "Dropdown",
      "section_name": "VISA/MASTERCARD/DISCOVER FIELDS"
    },
    {
      "name": "High Ticket Size",
      "status": "Required",
      "description": "Add content.",
      "status_data_type": "Dropdown",
      "section_name": "VISA/MASTERCARD/DISCOVER FIELDS"
    },
    {
      "name": "Desired Limit",
      "status": "Required",
      "description": "Add content.",
      "status_data_type": "Dropdown",
      "section_name": "VISA/MASTERCARD/DISCOVER FIELDS"
    },
    {
      "name": "Monthly Volume",
      "status": "Required",
      "description": "Add content.",
      "status_data_type": "Dropdown",
      "section_name": "AMERICAN EXPRESS FIELDS"
    },
    {
      "name": "Average Ticket Size",
      "status": "Required",
      "description": "Add content.",
      "status_data_type": "Dropdown",
      "section_name": "AMERICAN EXPRESS FIELDS"
    },
    {
      "name": "High Ticket Size",
      "status": "Required",
      "description": "Add content.",
      "status_data_type": "Dropdown",
      "section_name": "AMERICAN EXPRESS FIELDS"
    },
    {
      "name": "Desired Limit",
      "status": "Required",
      "description": "Add content.",
      "status_data_type": "Dropdown",
      "section_name": "AMERICAN EXPRESS FIELDS"
    },
    {
      "name": "Card (Swiped)",
      "status": "Required",
      "description": "Percent of point of sale volume via credit card swiping.",
      "status_data_type": "Dropdown",
      "section_name": "POINT OF SALE VOLUME FIELDS"
    },
    {
      "name": "Card (Typed)",
      "status": "Required",
      "description": "Percent of point of sale volume via credit card typed manually.",
      "status_data_type": "Dropdown",
      "section_name": "POINT OF SALE VOLUME FIELDS"
    },
    {
      "name": "eCommerce",
      "status": "Required",
      "description": "Percent of point of sale volume via eCommerce.",
      "status_data_type": "Dropdown",
      "section_name": "POINT OF SALE VOLUME FIELDS"
    }
  ],
  "integrations": [],
  "additional_settings": []
}' WHERE stage_id = 9;


UPDATE onboarding_schema.data_customer_stage_fields_config AS target
SET
    customer_id = dcos.customer_id,
    customer_stage_id = dcos.id,
    config = csfc.config
FROM  onboarding_schema.data_customer_onboarding_stages dcos
inner join onboarding_schema.core_onboarding_stages cos on cos.code = dcos.stage_code 
inner join onboarding_schema.core_stage_fields_config csfc on csfc.stage_id = cos.id 
WHERE target.customer_stage_id = dcos.id and target.customer_id = dcos.customer_id and cos.id in (3,6,9);

