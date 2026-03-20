/* Replace with your SQL commands */

-- add unique constraint on setup_id and customer_id
ALTER TABLE onboarding_schema.rel_customer_setup_status
ADD CONSTRAINT rel_customer_unique_setup_customer UNIQUE (setup_id, customer_id);

-- update core_onboarding_stages and set is_orderable to false
UPDATE onboarding_schema.core_onboarding_stages
SET is_removable = false, is_orderable = false
WHERE code IN ('company_additional_info','review');


UPDATE onboarding_schema.data_customer_onboarding_stages
SET is_removable = false, is_orderable = false
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
    "name":"Company Name",
    "status":"Always Required",
    "description":"Collect the company’s name and any associated DBAs.",
    "status_data_type":"Dropdown"
  },
  {
    "name":"Company Address",
    "status":"Always Required",
    "description":"Collect the company’s address.",
    "status_data_type":"Dropdown"
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
    },
    {
      "name": "LinkedIn",
      "status": "Required",
      "description": "Ask for a link to the company’s LinkedIn profile.",
      "status_data_type": "Dropdown"
    }
  ], "integrations": [], "additional_settings": [] }'
WHERE stage_id = 3;

-- update core config of ownership details
UPDATE onboarding_schema.core_stage_fields_config
SET config = '{
  "fields": [
    {
      "name": "Name",
      "status": "Always Required",
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
  "integrations": [],
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
      "description": "Allow applicants to upload a past payment processing statement. Please note: if the applicant is a new business, we’ll ask for estimates of all enabled fields below.",
      "status_data_type": "Dropdown",
      "section_name": "DOCUMENT FIELDS"
    },
    {
      "name": "OCR",
      "status": true,
      "description": "Auto-calculate and pre-fill the fields below when a statement uploaded.",
      "status_data_type": "Boolean",
      "section_name": "DOCUMENT FIELDS"
    },
    {
      "name": "Monthly Volume",
      "status": "Required",
      "description": "The summation of volume for Visa, Mastercard, and Discover cards during a given month.",
      "status_data_type": "Dropdown",
      "section_name": "VISA/MASTERCARD/DISCOVER FIELDS"
    },
    {
      "name": "Average Ticket Size",
      "status": "Required",
      "description": "The average transaction amount across Visa, Mastercard, and Discover in total.",
      "status_data_type": "Dropdown",
      "section_name": "VISA/MASTERCARD/DISCOVER FIELDS"
    },
    {
      "name": "High Ticket Size",
      "status": "Required",
      "description": "The highest ticket size among Visa, Mastercard, and Discover.",
      "status_data_type": "Dropdown",
      "section_name": "VISA/MASTERCARD/DISCOVER FIELDS"
    },
    {
      "name": "Desired Limit",
      "status": "Required",
      "description": "When a statement is provided, we populate a value by taking the average monthly volume and adding a 10% buffer (e.g. $10,000 avg. monthly volume + 10% buffer = $11,000 desired limit).",
      "status_data_type": "Dropdown",
      "section_name": "VISA/MASTERCARD/DISCOVER FIELDS"
    },
    {
      "name": "Monthly Volume",
      "status": "Required",
      "description": "The summation of volume for all American Express transactions.",
      "status_data_type": "Dropdown",
      "section_name": "AMERICAN EXPRESS FIELDS"
    },
    {
      "name": "Average Ticket Size",
      "status": "Required",
      "description": "The average transaction amount for all American Express transactions.",
      "status_data_type": "Dropdown",
      "section_name": "AMERICAN EXPRESS FIELDS"
    },
    {
      "name": "High Ticket Size",
      "status": "Required",
      "description": "The highest ticket size for American Express transactions.",
      "status_data_type": "Dropdown",
      "section_name": "AMERICAN EXPRESS FIELDS"
    },
    {
      "name": "Desired Limit",
      "status": "Required",
      "description": "When a statement is provided, we populate a value by taking the average monthly volume and adding a 10% buffer (e.g. $10,000 avg. monthly volume + 10% buffer = $11,000 desired limit).",
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
