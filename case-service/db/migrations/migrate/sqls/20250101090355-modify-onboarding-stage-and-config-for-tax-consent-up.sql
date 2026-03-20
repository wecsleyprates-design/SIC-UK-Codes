-- Migration Script to Update JSONB Column in core_stage_fields_config and data_customer_stage_fields_config
-- Update the config JSONB column based on the code condition
-- Used CTE just to reduce code duplication and consistency in initial config for both core & customer table
WITH common_json_config AS (
  SELECT '{
    "fields": [
      {
        "section_name": "HOW DO YOU WANT APPLICANTS TO PROVIDE THEIR TAX INFORMATION?",
        "name": "Upload Tax Documents",
        "status": true,
        "description": "Allow applicants to upload their past tax documents.",
        "status_data_type": "Toggle"
      },
      {
        "section_name": "HOW DO YOU WANT APPLICANTS TO PROVIDE THEIR TAX INFORMATION?",
        "name": "Manually Add Tax Information",
        "status": true,
        "description": "Allow applicants to input recent tax details manually.",
        "status_data_type": "Toggle"
      },
      {
        "name": "Tax Document Filed/Processed Date",
        "status": "Required",
        "description": "Gather the time period of the form the data is populated from.",
        "section_name": "WHICH INFORMATION WOULD YOU LIKE TO COLLECT FROM ANNUAL TAX DOCUMENTS?",
        "status_data_type": "Dropdown"
      },
      {
        "name": "Total Sales",
        "status": "Required",
        "description": "The total sales of the company over a particular period.",
        "section_name": "WHICH INFORMATION WOULD YOU LIKE TO COLLECT FROM ANNUAL TAX DOCUMENTS?",
        "status_data_type": "Dropdown"
      },
      {
        "name": "Total Compensation",
        "status": "Required",
        "description": "The overall compensation paid during a particular period.",
        "section_name": "WHICH INFORMATION WOULD YOU LIKE TO COLLECT FROM ANNUAL TAX DOCUMENTS?",
        "status_data_type": "Dropdown"
      },
      {
        "name": "Total Wages",
        "status": "Required",
        "description": "The total wages paid during a particular period.",
        "section_name": "WHICH INFORMATION WOULD YOU LIKE TO COLLECT FROM ANNUAL TAX DOCUMENTS?",
        "status_data_type": "Dropdown"
      },
      {
        "name": "Cost of Goods Sold",
        "status": "Required",
        "description": "The direct costs of producing or purchasing the goods a business sells, including materials and labor.",
        "section_name": "WHICH INFORMATION WOULD YOU LIKE TO COLLECT FROM ANNUAL TAX DOCUMENTS?",
        "status_data_type": "Dropdown"
      },
      {
        "name": "IRS Balance",
        "status": "Required",
        "description": "The amount owed or refundable to the taxpayer based on their filed tax return.",
        "section_name": "WHICH INFORMATION WOULD YOU LIKE TO COLLECT FROM ANNUAL TAX DOCUMENTS?",
        "status_data_type": "Dropdown"
      },
      {
        "name": "IRS Liens",
        "status": "Required",
        "description": "A legal claim against a taxpayer’s property when they fail to pay their tax debt, securing the government’s interest in the assets.",
        "section_name": "WHICH INFORMATION WOULD YOU LIKE TO COLLECT FROM ANNUAL TAX DOCUMENTS?",
        "status_data_type": "Dropdown"
      },
      {
        "name": "Tax Period Ending",
        "status": "Required",
        "description": "The last date of the tax period on the form which the data is populated from.",
        "section_name": "WHICH INFORMATION WOULD YOU LIKE TO COLLECT FROM QUARTERLY TAX DOCUMENTS?",
        "status_data_type": "Dropdown"
      },
      {
        "name": "Tax Document Filed/Processed Date",
        "status": "Required",
        "description": "Gather the time period of the form the data is populated from.",
        "section_name": "WHICH INFORMATION WOULD YOU LIKE TO COLLECT FROM QUARTERLY TAX DOCUMENTS?",
        "status_data_type": "Dropdown"
      },
      {
        "name": "Amount Filed",
        "status": "Required",
        "description": "The total payroll taxes reported by an employer, including income, Social Security, and Medicare taxes withheld from employees’ wages, as well as the employer’s share of Social Security and Medicare taxes.",
        "section_name": "WHICH INFORMATION WOULD YOU LIKE TO COLLECT FROM QUARTERLY TAX DOCUMENTS?",
        "status_data_type": "Dropdown"
      },
      {
        "name": "Account Balance",
        "status": "Required",
        "description": "The amount an employer owes or overpaid in payroll taxes after filing quarterly reports on employee wages and tax withholdings.",
        "section_name": "WHICH INFORMATION WOULD YOU LIKE TO COLLECT FROM QUARTERLY TAX DOCUMENTS?",
        "status_data_type": "Dropdown"
      },
      {
        "name": "Accrued Interest",
        "status": "Required",
        "description": "The interest charged on unpaid payroll tax liabilities reported on Form 941, calculated from the due date until the balance is paid.",
        "section_name": "WHICH INFORMATION WOULD YOU LIKE TO COLLECT FROM QUARTERLY TAX DOCUMENTS?",
        "status_data_type": "Dropdown"
      },
      {
        "name": "Accrued Penalty",
        "status": "Required",
        "description": "A fine imposed for late filing, late payment, or underpayment of payroll taxes reported on Form 941.",
        "section_name": "WHICH INFORMATION WOULD YOU LIKE TO COLLECT FROM QUARTERLY TAX DOCUMENTS?",
        "status_data_type": "Dropdown"
      }
    ],
    "integrations": [
    ],
    "additional_settings": [
    ]
  }'::jsonb AS config
),
cte_table1 AS (
  UPDATE onboarding_schema.core_stage_fields_config
  SET config = (select config from common_json_config)
  FROM onboarding_schema.core_onboarding_stages
  WHERE onboarding_schema.core_stage_fields_config.stage_id = onboarding_schema.core_onboarding_stages.id
    AND onboarding_schema.core_onboarding_stages.code = 'tax_consent'
   RETURNING core_stage_fields_config.id
),
cte_table2 AS (
  UPDATE onboarding_schema.data_customer_stage_fields_config
  SET config = (select config from common_json_config)
  FROM onboarding_schema.data_customer_onboarding_stages
  WHERE onboarding_schema.data_customer_stage_fields_config.customer_stage_id = onboarding_schema.data_customer_onboarding_stages.id
    AND onboarding_schema.data_customer_onboarding_stages.stage_code = 'tax_consent'
)
SELECT * FROM cte_table1;

-- Update the stage column in data_customer_onboarding_stages
UPDATE onboarding_schema.data_customer_onboarding_stages
SET stage = 'Business Taxes'
WHERE stage_code = 'tax_consent';

-- Update the stage column in core_onboarding_stages
UPDATE onboarding_schema.core_onboarding_stages
SET stage = 'Business Taxes'
WHERE code = 'tax_consent';
