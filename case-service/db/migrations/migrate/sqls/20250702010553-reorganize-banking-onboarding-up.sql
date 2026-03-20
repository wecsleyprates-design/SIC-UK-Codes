
update onboarding_schema.core_stage_fields_config
set config = '{
  "fields": [
    {
      "name": "Real-Time Integration",
      "status": true,
      "description": "When this integration is on, applicants can connect directly to their accounts.",
      "status_data_type": "Toggle",
      "section_name": "How do you want applicants to provide their banking information?"
    },
    {
      "name": "Manual Account Verification",
      "status": false,
      "description": "When this feature is enabled, applicants can provide their bank account information manually. This option is useful for verifying bank accounts without collecting statements.",
      "status_data_type": "Toggle",
      "section_name": "How do you want applicants to provide their banking information?"
    },
    {
      "name": "Upload Statements",
      "status": false,
      "description": "Ask for and collect previous bank statements. This can be the main or an alternative way to gather banking together when integrations are turned on.",
      "status_data_type": "Toggle",
      "section_name": "How do you want applicants to provide their banking information?",
      "sub_fields": [
        {
          "name": "# of Statements Required",
          "status": "2",
          "description": "Please enter # of statements required",
          "status_data_type": "Textbox"
        }
      ]
    },
    {
      "name": "Deposit Account",
      "status": "Hidden",
      "description": "If you happen to make deposits to your customers, you can collect the account where the applicant would prefer these deposits be made. ",
      "status_data_type": "Dropdown",
      "section_name": "Additional Pages"
    }
  ],
  "integrations": [],
  "additional_settings": []
}'::jsonb where id = 4;

-- Step 1: Add missing fields first
update onboarding_schema.data_customer_stage_fields_config
set config = jsonb_set(
  config,
  '{fields}',
  config->'fields' || 
  CASE 
    WHEN NOT (config->'fields' @> '[{"name": "Real-Time Integration"}]'::jsonb) 
    AND NOT (config->'integrations' @> '[{"name": "Real-Time Integration"}]'::jsonb) THEN
      jsonb_build_array(
        jsonb_build_object(
          'name', 'Real-Time Integration',
          'status', true,
          'description', 'When this integration is on, applicants can connect directly to their accounts.',
          'status_data_type', 'Toggle',
          'section_name', 'How do you want applicants to provide their banking information?'
        )
      )
    ELSE '[]'::jsonb
  END ||
  CASE 
    WHEN NOT (config->'fields' @> '[{"name": "Manual Account Verification"}]'::jsonb) THEN
      jsonb_build_array(
        jsonb_build_object(
          'name', 'Manual Account Verification',
          'status', false,
          'description', 'When this feature is enabled, applicants can provide their bank account information manually. This option is useful for verifying bank accounts without collecting statements.',
          'status_data_type', 'Toggle',
          'section_name', 'How do you want applicants to provide their banking information?'
        )
      )
    ELSE '[]'::jsonb
  END ||
  CASE 
    WHEN NOT (config->'fields' @> '[{"name": "Upload Documents"}]'::jsonb) THEN
      jsonb_build_array(
        jsonb_build_object(
          'name', 'Upload Statements',
          'status', false,
          'description', 'Ask for and collect previous bank statements. This can be the main or an alternative way to gather banking together when integrations are turn on.',
          'status_data_type', 'Toggle',
          'section_name', 'How do you want applicants to provide their banking information?',
          'sub_fields', jsonb_build_array(
            jsonb_build_object(
              'name', '# of Statements Required',
              'status', '2',
              'description', 'Please enter # of statements required',
              'status_data_type', 'Textbox'
            )
          )
        )
      )
    ELSE '[]'::jsonb
  END ||
  CASE 
    WHEN NOT (config->'fields' @> '[{"name": "Deposit Account"}]'::jsonb) THEN
      jsonb_build_array(
        jsonb_build_object(
          'name', 'Deposit Account',
          'status', 'Hidden',
          'description', 'If you happen to make deposits to your customers, you can collect the account where the applicant would prefer these deposits be made. ',
          'status_data_type', 'Dropdown',
          'section_name', 'Additional Pages'
        )
      )
    ELSE '[]'::jsonb
  END
) 
WHERE customer_stage_id IN (SELECT id FROM onboarding_schema.data_customer_onboarding_stages WHERE stage_code = 'banking');

-- Step 2: Update existing fields and move Real-Time Integration from integrations
update onboarding_schema.data_customer_stage_fields_config
set config = jsonb_set(
  jsonb_set(
    config,
    '{fields}',
    (
      SELECT jsonb_agg(field ORDER BY 
        CASE field->>'name'
          WHEN 'Real-Time Integration' THEN 1
          WHEN 'Manual Account Verification' THEN 2
          WHEN 'Upload Statements' THEN 3
          WHEN 'Deposit Account' THEN 4
          ELSE 5
        END
      )
      FROM (
        -- Keep existing fields that are not the ones we want to transform
        SELECT field
        FROM jsonb_array_elements(config->'fields') AS field
        WHERE field->>'name' NOT IN ('Real-Time Integration', 'Manual Account Verification', 'Upload Statements', 'Deposit Account', 'Upload Documents')
        
        UNION ALL
        
        -- Transform existing Real-Time Integration field
        SELECT jsonb_build_object(
          'name', 'Real-Time Integration',
          'status', field->>'status',
          'description', 'When this integration is on, applicants can connect directly to their accounts.',
          'status_data_type', 'Toggle',
          'section_name', 'How do you want applicants to provide their banking information?'
        )
        FROM jsonb_array_elements(config->'fields') AS field
        WHERE field->>'name' = 'Real-Time Integration'
        
        UNION ALL
        
        -- Move Real-Time Integration from integrations array to fields
        SELECT jsonb_build_object(
          'name', 'Real-Time Integration',
          'status', CASE WHEN integration->>'is_enabled' = 'true' THEN true ELSE false END,
          'description', 'When this integration is on, applicants can connect directly to their accounts.',
          'status_data_type', 'Toggle',
          'section_name', 'How do you want applicants to provide their banking information?'
        )
        FROM jsonb_array_elements(config->'integrations') AS integration
        WHERE integration->>'name' = 'Real-Time Integration'
        
        UNION ALL
        
        -- Transform existing Manual Account Verification field
        SELECT jsonb_build_object(
          'name', 'Manual Account Verification',
          'status', CASE when field->>'status' = 'true' THEN true ELSE false END,
          'description', 'When this feature is enabled, applicants can provide their bank account information manually. This option is useful for verifying bank accounts without collecting statements.',
          'status_data_type', 'Toggle',
          'section_name', 'How do you want applicants to provide their banking information?'
        )
        FROM jsonb_array_elements(config->'fields') AS field
        WHERE field->>'name' = 'Manual Account Verification'
        
        UNION ALL
        
        -- Transform existing Upload Documents to UploadStatements field
        SELECT jsonb_build_object(
          'name', 'Upload Statements',
          'status', CASE when field->>'status' = 'Hidden' THEN false ELSE true END,
          'description', 'Ask for and collect previous bank statements. This can be the main or an alternative way to gather banking together when integrations are turn on.',
          'status_data_type', 'Toggle',
          'section_name', 'How do you want applicants to provide their banking information?',
          'sub_fields', jsonb_build_array(
            jsonb_build_object(
              'name', '# of Statements Required',
              'status', '2',
              'description', 'Please enter # of statements required',
              'status_data_type', 'Textbox'
            )
          )
        )
        FROM jsonb_array_elements(config->'fields') AS field
        WHERE field->>'name' = 'Upload Documents'
        
        UNION ALL
        
        -- Transform existing Deposit Account field
        SELECT jsonb_build_object(
          'name', 'Deposit Account',
          'status', field->>'status',
          'description', 'If you happen to make deposits to your customers, you can collect the account where the applicant would prefer these deposits be made. ',
          'status_data_type', 'Dropdown',
          'section_name', 'Additional Pages'
        )
        FROM jsonb_array_elements(config->'fields') AS field
        WHERE field->>'name' = 'Deposit Account'
      ) as all_fields
    )
  ),
  '{integrations}',
  '[]'::jsonb
) 
WHERE customer_stage_id IN (SELECT id FROM onboarding_schema.data_customer_onboarding_stages WHERE stage_code = 'banking');
