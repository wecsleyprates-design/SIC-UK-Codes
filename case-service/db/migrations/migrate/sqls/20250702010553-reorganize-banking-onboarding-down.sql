
-- Remove section_name from "Deposit Account" and "Upload Statements" field
update onboarding_schema.data_customer_stage_fields_config
set config = jsonb_set(
  config,
  '{fields}',
  (
    SELECT jsonb_agg(
      CASE 
        WHEN field->>'name' = 'Deposit Account' or field->>'name' = 'Upload Statements'
        THEN field - 'section_name'
        ELSE field
      END
    )
    FROM jsonb_array_elements(config->'fields') AS field
  )
) WHERE customer_stage_id IN (SELECT id FROM onboarding_schema.data_customer_onboarding_stages WHERE stage_code = 'banking');

-- Remove "Manual Account Verification" field
update onboarding_schema.data_customer_stage_fields_config
set config = jsonb_set(
  config,
  '{fields}',
  COALESCE(
    (
      SELECT jsonb_agg(field)
      FROM jsonb_array_elements(config->'fields') AS field
      WHERE field->>'name' != 'Manual Account Verification'
    ),
    '[]'::jsonb
  )
) WHERE customer_stage_id IN (SELECT id FROM onboarding_schema.data_customer_onboarding_stages WHERE stage_code = 'banking');

-- Remove sub_fields from "Upload Statements" field
update onboarding_schema.data_customer_stage_fields_config
set config = jsonb_set(
  config,
  '{fields}',
  (
    SELECT jsonb_agg(
      CASE 
        WHEN field->>'name' = 'Upload Statements' 
        THEN field - 'sub_fields'
        ELSE field
      END
    )
    FROM jsonb_array_elements(config->'fields') AS field
  )
) WHERE customer_stage_id IN (SELECT id FROM onboarding_schema.data_customer_onboarding_stages WHERE stage_code = 'banking');

-- Rename Upload Statements to Upload Documents
UPDATE onboarding_schema.data_customer_stage_fields_config
SET config = jsonb_set(
  config,
  '{fields}',
  (
    SELECT jsonb_agg(
      CASE 
        WHEN field->>'name' = 'Upload Statements' 
        THEN jsonb_set(field, '{name}', '"Upload Documents"')
        ELSE field
      END
    )
    FROM jsonb_array_elements(config->'fields') AS field
  )
)
WHERE customer_stage_id IN (
  SELECT id
  FROM onboarding_schema.data_customer_onboarding_stages
  WHERE stage_code = 'banking'
);

-- Move "Real-Time Integration" from fields back to integrations array
update onboarding_schema.data_customer_stage_fields_config
set config = jsonb_set(
  jsonb_set(
    config,
    '{fields}',
    COALESCE(
      (
        SELECT jsonb_agg(field)
        FROM jsonb_array_elements(config->'fields') AS field
        WHERE field->>'name' != 'Real-Time Integration'
      ),
      '[]'::jsonb
    )
  ),
  '{integrations}',
  COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'name', 'Real-Time Integration',
          'is_enabled', true,
          'description', 'When this integration is on, applicants can connect directly to their accounts.'
        )
      )
      FROM jsonb_array_elements(config->'fields') AS field
      WHERE field->>'name' = 'Real-Time Integration'
    ),
    '[]'::jsonb
  )
) WHERE customer_stage_id IN (SELECT id FROM onboarding_schema.data_customer_onboarding_stages WHERE stage_code = 'banking');

-- Put it back
update onboarding_schema.core_stage_fields_config
set config = '{
  "fields": [
    {
      "name": "Upload Documents",
      "status": "Optional",
      "description": "Ask for and collect previous bank statements. This can be the main or an alternative way to gather banking together when integrations are turn on.",
      "status_data_type": "Dropdown"
    },
    {
      "name": "Deposit Account",
      "status": "Hidden",
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
  ],
  "additional_settings": []
}'::jsonb where id = 4;