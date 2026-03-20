/* Replace with your SQL commands */
UPDATE onboarding_schema.core_stage_fields_config
SET config = '{
  "fields": [
    {
      "name": "Real-Time Integration",
      "status": true,
      "description": "Enable this to allow the applicant to connect to their accounting software in real-time.",
      "status_data_type": "Toggle",
	  "section_name": "How do you want applicants to provide their accounting information?"
    },
	{
      "name": "Upload Documents",
      "status": false,
      "description": "Gather balance sheet and profit & loss statements from the applicant.",
      "status_data_type": "Toggle",
	  "section_name": "How do you want applicants to provide their accounting information?",
	  "sub_fields":[
		{
            "name": "# of Statements Required",
            "status": "2",
            "description": "Please enter # of statements required",
            "status_data_type": "Textbox"
        }
	  ]
    }
  ],
  "integrations": [],
  "additional_settings": []
}'::jsonb
WHERE id = 6 AND stage_id = 7;

UPDATE onboarding_schema.data_customer_stage_fields_config
SET config = '{
  "fields": [
    {
      "name": "Real-Time Integration",
      "status": true,
      "description": "Enable this to allow the applicant to connect to their accounting software in real-time.",
      "status_data_type": "Toggle",
	  "section_name": "How do you want applicants to provide their accounting information?"
    },
	{
      "name": "Upload Documents",
      "status": false,
      "description": "Gather balance sheet and profit & loss statements from the applicant.",
      "status_data_type": "Toggle",
	  "section_name": "How do you want applicants to provide their accounting information?",
	  "sub_fields":[
		{
            "name": "# of Statements Required",
            "status": "2",
            "description": "Please enter valid # of statements required",
            "status_data_type": "Textbox"
        }
	  ]
    }
  ],
  "integrations": [],
  "additional_settings": []
}'::jsonb
WHERE customer_stage_id IN (SELECT id FROM onboarding_schema.data_customer_onboarding_stages WHERE stage_code = 'accounting');