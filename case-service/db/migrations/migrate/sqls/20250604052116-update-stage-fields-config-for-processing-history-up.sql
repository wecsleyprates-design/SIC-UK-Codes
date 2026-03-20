/* Replace with your SQL commands */
UPDATE onboarding_schema.core_stage_fields_config
SET config = '{
  "fields": [
    {
      "name": "Upload Statements",
      "status": true,
      "sub_fields": [
        {
          "name": "Enable OCR",
          "status": true,
          "description": "Auto-calculate and pre-fill the fields below when a statement uploaded.",
          "status_data_type": "Checkbox"
        }
      ],
      "description": "Allow applicants to upload a past payment processing statement. Please note: if the applicant is a new business, we’ll ask for estimates of all enabled fields below.",
      "section_name": "How do you want applicants to provide their processing history?",
      "status_data_type": "Toggle"
    },
    {
      "name": "Manually Provide Processing History",
      "status": true,
      "description": "Allow applicants to manually type details from recent processing statements or provide estimates if they are a new business.",
      "section_name": "How do you want applicants to provide their processing history?",
      "status_data_type": "Toggle"
    },
    {
      "name": "Monthly Volume",
      "status": "Optional",
      "description": "The dollar amount of total volume within a given month.",
      "section_name": "What general processing history data would you like to collect?",
      "status_data_type": "Dropdown"
    },
    {
      "name": "Annual Volume",
      "status": "Optional",
      "description": "The dollar amount of total volume within a given year.",
      "section_name": "What general processing history data would you like to collect?",
      "status_data_type": "Dropdown"
    },
    {
      "name": "Average Ticket Size",
      "status": "Optional",
      "description": "The average transaction amount within a given year.",
      "section_name": "What general processing history data would you like to collect?",
      "status_data_type": "Dropdown"
    },
    {
      "name": "High Ticket Size",
      "status": "Optional",
      "description": "The highest transaction amount that is common for the applicant business.",
      "section_name": "What general processing history data would you like to collect?",
      "status_data_type": "Dropdown"
    },
    {
      "name": "Monthly Occurrence of High Ticket",
      "status": "Optional",
      "description": "Applicant selects a range of how frequently a high ticket occurs in a given month. Current ranges are as follows: 1-5, 6-10, 11-15, 16+",
      "section_name": "What general processing history data would you like to collect?",
      "status_data_type": "Dropdown"
    },
    {
      "name": "Explanation of High Ticket",
      "status": "Optional",
      "description": "Gather context around when a high ticket occurs.",
      "section_name": "What general processing history data would you like to collect?",
      "status_data_type": "Dropdown"
    },
    {
      "name": "Desired Limit",
      "status": "Optional",
      "description": "When a statement is provided, we populate a value by taking the average monthly volume and adding a 10% buffer (e.g. $10,000 avg. monthly volume + 10% buffer = $11,000 desired limit).",
      "section_name": "What general processing history data would you like to collect?",
      "status_data_type": "Dropdown"
    },


    {
      "name": "Define Seasonal Business",
      "status": "Optional",
      "description": "Applicants are asked if their business is seasonal.",
      "section_name": "What seasonal information would you like to collect?",
      "status_data_type": "Dropdown"
    },
    {
      "name": "High Volume Months",
      "status": "Optional",
      "description": "Applicants can select which months high volumes are experienced, if the applicant business is seasonal.",
      "section_name": "What seasonal information would you like to collect?",
      "status_data_type": "Dropdown"
    },
    {
      "name": "Explanation of High Volume Months",
      "status": "Optional",
      "description": "Gather context around high volume months, if the applicant business is seasonal.",
      "section_name": "What seasonal information would you like to collect?",
      "status_data_type": "Dropdown"
    },


    {
      "name": "Monthly Volume",
      "status": "Optional",
      "description": "The summation of volume for Visa, Mastercard, and Discover cards during a given month.",
      "section_name": "What Visa, Mastercard, and Discover data would you like to collect?",
      "status_data_type": "Dropdown"
    },
    {
      "name": "Annual Volume",
      "status": "Optional",
      "description": "The summation of volume for Visa, Mastercard, and Discover cards during a given year.",
      "section_name": "What Visa, Mastercard, and Discover data would you like to collect?",
      "status_data_type": "Dropdown"
    },
    {
      "name": "Average Ticket Size",
      "status": "Optional",
      "description": "The average transaction amount across Visa, Mastercard, and Discover in total.",
      "section_name": "What Visa, Mastercard, and Discover data would you like to collect?",
      "status_data_type": "Dropdown"
    },
    {
      "name": "High Ticket Size",
      "status": "Optional",
      "description": "The highest ticket size among Visa, Mastercard, and Discover.",
      "section_name": "What Visa, Mastercard, and Discover data would you like to collect?",
      "status_data_type": "Dropdown"
    },
    {
      "name": "Desired Limit",
      "status": "Optional",
      "description": "When a statement is provided, we populate a value by taking the average monthly volume and adding a 10% buffer (e.g. $10,000 avg. monthly volume + 10% buffer = $11,000 desired limit).",
      "section_name": "What Visa, Mastercard, and Discover data would you like to collect?",
      "status_data_type": "Dropdown"
    },
    {
      "name": "Monthly Volume",
      "status": "Optional",
      "description": "The summation of volume for all American Express transactions.",
      "section_name": "What American Express data would you like to collect?",
      "status_data_type": "Dropdown"
    },
    {
      "name": "Annual Volume",
      "status": "Optional",
      "description": "The summation of volume for all American Express transactions during a given year.",
      "section_name": "What American Express data would you like to collect?",
      "status_data_type": "Dropdown"
    },
    {
      "name": "Average Ticket Size",
      "status": "Optional",
      "description": "The average transaction amount for all American Express transactions.",
      "section_name": "What American Express data would you like to collect?",
      "status_data_type": "Dropdown"
    },
    {
      "name": "High Ticket Size",
      "status": "Optional",
      "description": "The highest ticket size for American Express transactions.",
      "section_name": "What American Express data would you like to collect?",
      "status_data_type": "Dropdown"
    },
    {
      "name": "Desired Limit",
      "status": "Optional",
      "description": "When a statement is provided, we populate a value by taking the average monthly volume and adding a 10% buffer (e.g. $10,000 avg. monthly volume + 10% buffer = $11,000 desired limit).",
      "section_name": "What American Express data would you like to collect?",
      "status_data_type": "Dropdown"
    },
    {
      "name": "Card (Swiped)",
      "status": "Optional",
      "description": "Percent of point of sale volume via credit card swiping.",
      "section_name": "What Point of Sale data would you like to collect?",
      "status_data_type": "Dropdown"
    },
    {
      "name": "Card (Keyed)",
      "status": "Optional",
      "description": "Percent of point of sale volume via credit card typed manually.",
      "section_name": "What Point of Sale data would you like to collect?",
      "status_data_type": "Dropdown"
    },
    {
      "name": "Mail & Telephone",
      "status": "Optional",
      "description": "Percent of point of sale volume via mail or telephone.",
      "section_name": "What Point of Sale data would you like to collect?",
      "status_data_type": "Dropdown"
    },
    {
      "name": "eCommerce",
      "status": "Optional",
      "description": "Percent of point of sale volume via eCommerce.",
      "section_name": "What Point of Sale data would you like to collect?",
      "status_data_type": "Dropdown"
    }
  ],
  "integrations": [],
  "additional_settings": []
}'
WHERE stage_id = 9;

UPDATE onboarding_schema.data_customer_stage_fields_config
SET config = jsonb_build_object(
    'fields', (
        SELECT jsonb_agg(field)
        FROM (
            -- Existing fields
            SELECT jsonb_array_elements(config->'fields') AS field
            -- New fields
            UNION ALL
            SELECT jsonb_build_object(
                'name', 'Monthly Volume',
                'status', 'Hidden',
                'description', 'The dollar amount of total volume within a given month.',
                'section_name', 'What general processing history data would you like to collect?',
                'status_data_type', 'Dropdown'
            )
            UNION ALL
            SELECT jsonb_build_object(
                'name', 'Annual Volume',
                'status', 'Hidden',
                'description', 'The dollar amount of total volume within a given year.',
                'section_name', 'What general processing history data would you like to collect?',
                'status_data_type', 'Dropdown'
            )
            UNION ALL
            SELECT jsonb_build_object(
                'name', 'Average Ticket Size',
                'status', 'Hidden',
                'description', 'The average transaction amount within a given year.',
                'section_name', 'What general processing history data would you like to collect?',
                'status_data_type', 'Dropdown'
            )
            UNION ALL
            SELECT jsonb_build_object(
                'name', 'High Ticket Size',
                'status', 'Hidden',
                'description', 'The highest transaction amount that is common for the applicant business.',
                'section_name', 'What general processing history data would you like to collect?',
                'status_data_type', 'Dropdown'
            )
            UNION ALL
            SELECT jsonb_build_object(
                'name', 'Monthly Occurrence of High Ticket',
                'status', 'Hidden',
                'description', 'Applicant selects a range of how frequently a high ticket occurs in a given month. Current ranges are as follows: 1-5, 6-10, 11-15, 16+',
                'section_name', 'What general processing history data would you like to collect?',
                'status_data_type', 'Dropdown'
            )
            UNION ALL
            SELECT jsonb_build_object(
                'name', 'Explanation of High Ticket',
                'status', 'Hidden',
                'description', 'Gather context around when a high ticket occurs.',
                'section_name', 'What general processing history data would you like to collect?',
                'status_data_type', 'Dropdown'
            )
            UNION ALL
            SELECT jsonb_build_object(
                'name', 'Desired Limit',
                'status', 'Hidden',
                'description', 'When a statement is provided, we populate a value by taking the average monthly volume and adding a 10% buffer (e.g. $10,000 avg. monthly volume + 10% buffer = $11,000 desired limit).',
                'section_name', 'What general processing history data would you like to collect?',
                'status_data_type', 'Dropdown'
            )
            UNION ALL
            SELECT jsonb_build_object(
                'name', 'Define Seasonal Business',
                'status', 'Hidden',
                'description', 'Applicants are asked if their business is seasonal.',
                'section_name', 'What seasonal information would you like to collect?',
                'status_data_type', 'Dropdown'
            )
            UNION ALL
            SELECT jsonb_build_object(
                'name', 'High Volume Months',
                'status', 'Hidden',
                'description', 'Applicants can select which months high volumes are experienced, if the applicant business is seasonal.',
                'section_name', 'What seasonal information would you like to collect?',
                'status_data_type', 'Dropdown'
            )
            UNION ALL
            SELECT jsonb_build_object(
                'name', 'Explanation of High Volume Months',
                'status', 'Hidden',
                'description', 'Gather context around high volume months, if the applicant business is seasonal.',
                'section_name', 'What seasonal information would you like to collect?',
                'status_data_type', 'Dropdown'
            )
            UNION ALL
            SELECT jsonb_build_object(
                'name', 'Annual Volume',
                'status', 'Hidden',
                'description', 'The summation of volume for Visa, Mastercard, and Discover cards during a given year.',
                'section_name', 'What Visa, Mastercard, and Discover data would you like to collect?',
                'status_data_type', 'Dropdown'
            )
            UNION ALL
            SELECT jsonb_build_object(
                'name', 'Annual Volume',
                'status', 'Hidden',
                'description', 'The summation of volume for all American Express transactions during a given year.',
                'section_name', 'What American Express data would you like to collect?',
                'status_data_type', 'Dropdown'
            )
            UNION ALL
            SELECT jsonb_build_object(
                'name', 'Mail & Telephone',
                'status', 'Hidden',
                'description', 'Percent of point of sale volume via mail or telephone.',
                'section_name', 'What Point of Sale data would you like to collect?',
                'status_data_type', 'Dropdown'
            )
        ) AS existing_and_new_fields
    ),
    'integrations', config->'integrations',
    'additional_settings', config->'additional_settings'
)
WHERE customer_stage_id IN (SELECT id FROM onboarding_schema.data_customer_onboarding_stages WHERE stage_code = 'processing_history');