/* Replace with your SQL commands */
CREATE TABLE IF NOT EXISTS onboarding_schema.core_onboarding_types(
    id serial NOT NULL PRIMARY KEY, -- id of the onboarding type
    code varchar NOT NULL UNIQUE, -- code of the onboarding type
    label varchar NOT NULL -- label of the onboarding type
);


-- Insert default onboarding types
INSERT INTO onboarding_schema.core_onboarding_types (id, code ,label)
VALUES
(1, 'normal_onboarding', 'Normal Onboarding'),
(2, 'lightning_onboarding', 'Lightning Onboarding');

-- Truncate the table
TRUNCATE TABLE core_onboarding_stages RESTART IDENTITY CASCADE;

-- move table from public to onboarding schema
ALTER TABLE public.core_onboarding_stages SET SCHEMA onboarding_schema;

ALTER TABLE onboarding_schema.core_onboarding_stages
ADD COLUMN code VARCHAR NOT NULL, -- Unique code for each stage
ADD COLUMN is_removable BOOLEAN NOT NULL DEFAULT TRUE, -- Indicates if the stage is removable
ADD COLUMN is_orderable BOOLEAN NOT NULL DEFAULT TRUE; --  Indicates if the stage is orderable

-- Insert default onboarding stages
INSERT INTO onboarding_schema.core_onboarding_stages (
    id, stage, completion_weightage, allow_back_nav, is_skippable, is_enabled,
    next_stage, prev_stage, priority_order, code, is_removable, is_orderable
) VALUES
(1, 'Login', 0, false, false, false, 2, NULL, 1, 'login', false, false),
(2, 'Get Started', 0, false, false, false, 3, 1, 2, 'get_started', false, false),
(3, 'Company', 15, false, false, true, 4, NULL, 3, 'company', true, true),
(4, 'Company Additional Info', 5, true, false, true, 5, 3, 4,'company_additional_info', true, true),
(5, 'Banking', 20, true, false, true, 6, 4, 5, 'banking', true, true),
(6, 'Ownership', 20, true, false, true, 7, 5, 6, 'ownership', true, true),
(7, 'Accounting', 20, true, false, true, 8, 6, 7, 'accounting', true, true),
(8, 'Taxes', 20, true, true, true, 10, 7, 8, 'tax_consent', true, true),
(9, 'Processing History', 5, false, false, false, NULL, NULL, 9, 'processing_history', true, true),
(10, 'Custom Fields', 0, true, false, true, 11, 8, 10,'custom_fields', true, true),
(11, 'Review', 0, true, false, true, NULL, 10, 11, 'review', true, true),
(12, 'Landing Page', 0, false, false, false, 12, NULL, 12, 'landing_page', false, false),
(13, 'Company Verification', 0, false, false, false, NULL, 12, 13, 'company_verification', false, false);

CREATE TABLE IF NOT EXISTS onboarding_schema.rel_onboarding_stage_type(
    onboarding_type_id INT NOT NULL, -- References the onboarding type
    stage_id INT NOT NULL, -- References the onboarding stage
    CONSTRAINT fk_rel_onboarding_stage_type_stage_id FOREIGN KEY (stage_id) REFERENCES onboarding_schema.core_onboarding_stages(id),
    CONSTRAINT fk_rel_onboarding_stage_type_id FOREIGN KEY (onboarding_type_id) REFERENCES onboarding_schema.core_onboarding_types(id)
);


-- Insert default rel_onboarding_stage_type

INSERT INTO onboarding_schema.rel_onboarding_stage_type (onboarding_type_id, stage_id)
VALUES
(1,1),
(1,2),
(1,3),
(1,4),
(1,5),
(1,6),
(1,7),
(1,8),
(1,9),
(1,10),
(1,11),
(2,12),
(2,13);


CREATE TABLE IF NOT EXISTS onboarding_schema.core_onboarding_setup_types (
    id serial NOT NULL PRIMARY KEY, -- Unique identifier for each setup type
    code varchar NOT NULL UNIQUE, -- Unique code for each setup type
    label varchar NOT NULL -- Label for each setup type
);
-- Insert default onboarding setup types
INSERT INTO onboarding_schema.core_onboarding_setup_types (id, code, label)
VALUES
(1, 'onboarding_setup', 'Onboarding Setup'),
(2, 'white_label_setup', 'White Label Setup'),
(3, 'modify_pages_fields_setup', 'Modify Pages And Fields Setup'),
(4, 'lightning_verification_setup', 'Lightning Verification Setup');


CREATE TABLE IF NOT EXISTS onboarding_schema.rel_customer_setup_status (
    setup_id INT NOT NULL, -- References the ID of the core page
    customer_id UUID NOT NULL, -- References the ID of the customer
    is_enabled  BOOLEAN NOT NULL DEFAULT FALSE, -- Indicates if the setup is enabled
    CONSTRAINT fk_rel_customer_setup_status_setup_id FOREIGN KEY (setup_id) REFERENCES onboarding_schema.core_onboarding_setup_types(id)
);

CREATE TABLE IF NOT EXISTS onboarding_schema.core_stage_fields_config (
    id SERIAL PRIMARY KEY, -- Unique identifier for each customization
    stage_id INTEGER NOT NULL, -- References the ID of the core page
    config JSONB NOT NULL, -- JSON configuration for form field requirements
    CONSTRAINT fk_core_stage_fields_config FOREIGN KEY (stage_id) REFERENCES onboarding_schema.core_onboarding_stages(id)
);


-- Optional: Add an index on page_id for better performance
CREATE INDEX idx_core_stage_fields_config_id ON onboarding_schema.core_stage_fields_config (stage_id);



INSERT INTO onboarding_schema.core_stage_fields_config(id, stage_id, config)
VALUES
(1, 1, '{
  "fields":[{
    "name":"Login with Email & Password",
    "status":true,
    "description":"When enabled, applicants will be required to provide an email and password to begin and edit their application.",
    "status_data_type":"Boolean"
  }], "integrations":[], "additional_settings":[] }'),
(2, 2, '{
  "fields":[{
    "name":"Company Name",
    "status":"Always Required",
    "description":"Collect the company’s name.",
    "status_data_type":"Dropdown"
  },
  {
    "name":"Company Address",
    "status":"Always Required",
    "description":"Collect the company’s address.",
    "status_data_type":"Dropdown"
  }], "integrations":[], "additional_settings":[] }'),
(3, 3, '{
  "fields": [
    {
      "name": "Tax ID Number/Employer Identification Number",
      "status": "Required",
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
(4, 5, '{
  "fields": [
    {
      "name": "Upload Documents",
      "status": "Required",
      "description": "Ask for and collect previous bank statements. This can be the main or an alternative way to gather banking together when integrations are turn on.",
      "status_data_type": "Dropdown"
    },
    {
      "name": "Deposit Account",
      "status": "Required",
      "description": "If you happen to make deposits to your customers, you can collect the account where the applicant would prefer these deposits be made. ",
      "status_data_type": "Dropdown"
    }
  ],
  "integrations": [
    {
      "name": "Real-Time Integration",
      "is_enabled": true,
      "description": "When this integration is on, applicants can connect directly to their accounts."
    }
  ], "additional_settings": [] }'),
(5, 6, '{
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
}'),
(6, 7, '{
  "fields": [
    {
      "name": "Upload Documentation",
      "status": "Required",
      "description": "Gather balance sheet and profit & loss statements from the applicant.",
      "status_data_type": "Dropdown"
    }
  ],
  "integrations": [
    {
      "name": "Accounting Softwares",
      "is_enabled": true,
      "description": "Enable this to allow the applicant to connect to their accounting software in real-time."
    }
  ], "additional_settings": [] }'),
(7, 8, '{
  "fields": [
    {
      "name": "Upload Documentation",
      "status": "Required",
      "description": "Gather business tax returns from the applicant",
      "status_data_type": "Dropdown"
    }
  ],
  "integrations": [
    {
      "name": "IRS",
      "is_enabled": true,
      "description": "When enabled, applicants can consent to provide their tax information directly from IRS."
    }
  ],
  "additional_settings": [
    {
      "name": "Gather personal tax returns",
      "is_enabled": true
    }
  ]
}'),
(8, 9, '{
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
}'),
(9, 12, '{
  "fields": [
    {
      "name": "Begin Application",
      "status": null,
      "description": "A basic landing page is provided where businesses can agree to terms and conditions and privacy policy prior to providing their information.",
      "status_data_type": null
    }
  ], "integrations": [], "additional_settings": [] }'),
(10, 13, '{
  "fields": [
    {
      "name": "Tax ID Number/Employer Identification Number",
      "status": "Required",
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
      "name": "Company Address",
      "status": "Required",
      "description": "Collect a company’s main address. Applicants can also provide a mailing address if different from this address.",
      "status_data_type": "Dropdown"
    }
  ],
  "integrations": [],
  "additional_settings": []
}');


-- Drop the table if it already exists
DROP TABLE IF EXISTS data_customer_onboarding_stages;

-- Create the table with the updated schema
CREATE TABLE IF NOT EXISTS onboarding_schema.data_customer_onboarding_stages (
    id UUID DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,  -- Unique identifier for each record
    customer_id UUID NOT NULL,                              -- Reference to the customer in the data_customers table
    version INTEGER NOT NULL DEFAULT 1,                     -- Version of the customer's configuration
    stage VARCHAR NOT NULL,                                 -- Name of the stage
    stage_code VARCHAR NULL,                                -- Code for the stage
    completion_weightage INTEGER NULL,                      -- Weightage for progress tracking, nullable
    allow_back_nav BOOLEAN NOT NULL DEFAULT TRUE,           -- Indicates if back navigation is allowed, default is true
    is_skippable BOOLEAN NOT NULL DEFAULT FALSE,            -- Indicates if the stage is skippable, default is false
    is_enabled BOOLEAN NOT NULL DEFAULT FALSE,              -- Indicates if the stage is enabled, default is false
    is_removable BOOLEAN NOT NULL DEFAULT FALSE,            -- Indicates if the stage is removable, default is false
    is_orderable BOOLEAN NOT NULL DEFAULT FALSE,            -- Indicates if the stage is orderable, default is false
    next_stage UUID NULL,                                   -- UUID of the next stage, nullable
    prev_stage UUID NULL,                                   -- UUID of the previous stage, nullable
    priority_order INTEGER NULL,                            -- Custom ordering of the stage, specific to the customer
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,            -- Date and time of creation
    created_by UUID NOT NULL,                               -- UUID of the user who created this record
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL,            -- Date and time of the last update
    updated_by UUID NOT NULL,                             -- UUID of the user who updated this record,
    UNIQUE (customer_id, stage_code, version)               -- Enforces uniqueness for a combination of customer_id, stage_code, and version
);

CREATE TABLE IF NOT EXISTS onboarding_schema.data_customer_stage_fields_config (
    id SERIAL PRIMARY KEY, -- Unique identifier for the configuration
    customer_id UUID NOT NULL, -- Foreign key referencing the customer
    customer_stage_id UUID NOT NULL, -- ID of the core page (e.g., company)
    config JSONB NOT NULL, -- JSON configuration specifying required or optional fields
    CONSTRAINT fk_data_customer_stage_fields_config_id FOREIGN KEY (customer_stage_id) REFERENCES onboarding_schema.data_customer_onboarding_stages(id)
);

-- Optional: Add indexes for performance optimization
CREATE INDEX idx_data_customer_stage_fields_config_id ON onboarding_schema.data_customer_stage_fields_config (customer_id);
CREATE INDEX idx_data_customer_stage_fields_config_stage_id ON onboarding_schema.data_customer_stage_fields_config (customer_stage_id);









