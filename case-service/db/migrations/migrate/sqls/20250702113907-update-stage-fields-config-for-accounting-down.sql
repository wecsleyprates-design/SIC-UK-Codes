/* Replace with your SQL commands */
UPDATE onboarding_schema.data_customer_stage_fields_config
SET config = '{
  "fields": [
    {
      "name": "Upload Documentation",
      "status": "Optional",
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
  ],
  "additional_settings": []
}'
WHERE customer_stage_id IN (SELECT id FROM onboarding_schema.data_customer_onboarding_stages WHERE stage_code = 'accounting');

UPDATE onboarding_schema.core_stage_fields_config
SET config = '{
  "fields": [
    {
      "name": "Upload Documentation",
      "status": "Optional",
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
  ],
  "additional_settings": []
}'
WHERE id = 6 AND stage_id = 7;