/* Replace with your SQL commands */
/* Replace with your SQL commands */
UPDATE onboarding_schema.data_customer_stage_fields_config
SET config = jsonb_set(
    config,
    '{fields}',
    (config->'fields') || '{
      "name": "Primary Provider’s NPI Number*",
      "status": "Hidden",
      "description": "NPI (National Provider Identifier) is a unique 10-digit identification number assigned to healthcare providers in the United States by the Centers for Medicare & Medicaid Services (CMS). When enabled, we’ll collect and verify the status of the provided NPI number.",
      "section_name": "What company data would you like to collect?",
      "status_data_type": "Dropdown"
    }'::jsonb
)
WHERE customer_stage_id IN (SELECT id FROM onboarding_schema.data_customer_onboarding_stages WHERE stage_code = 'company') AND NOT jsonb_path_exists(
    config,
    '$.fields[*] ? (@.name == "Primary Provider’s NPI Number*")'
);